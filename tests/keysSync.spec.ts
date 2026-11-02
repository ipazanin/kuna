import { describe, expect, it } from 'vitest'

import { syncVendorKeys } from '../src/apps/investments/prices/application/keysSync'
import type { KeysSyncResult } from '../src/apps/investments/prices/application/keysSync'
import { BEFORE_ANY_CHANGE, decodeKeysFile, encodeKeysFile, keysFileName, newestKeys } from '../src/apps/investments/prices/domain/keysFile'
import type { VendorKeyChanges } from '../src/apps/investments/prices/domain/keysFile'
import { keysDriveOn } from '../src/apps/investments/prices/infrastructure/fake/fakeKeysDrive'
import { APP_DATA_FOLDER } from '../src/shared/google/driveClient'
import { createFakeDrive } from '../src/shared/storage/infrastructure/fake/fakeDrive'
import type { FakeDrive } from '../src/shared/storage/infrastructure/fake/fakeDrive'

const INVESTMENTS_FILE = 'investments-file-1'
const KEY_A = 'made-up-twelve-data-key-aaaa'
const KEY_B = 'made-up-twelve-data-key-bbbb'
const VENDOR_IDS = ['alphavantage', 'finnhub', 'twelvedata']

/** A browser with its own keys, which the card changes and a sync merges with the keys file on one shared Drive. */
function browserOn(drive: FakeDrive) {
  let here: VendorKeyChanges = {}
  return {
    get here() {
      return here
    },
    change(vendorId: string, key: string | null, at: string) {
      here = { ...here, [vendorId]: { key, changedAt: at } }
    },
    sync(during: () => void = () => {}): Promise<KeysSyncResult> {
      const keysDrive = keysDriveOn(drive)
      return syncVendorKeys(
        {
          drive: {
            ...keysDrive,
            async createFile(name, text) {
              during()
              return keysDrive.createFile(name, text)
            },
            async overwrite(fileId, text) {
              during()
              await keysDrive.overwrite(fileId, text)
            },
          },
          vendorIds: VENDOR_IDS,
          here: () => here,
          keep(changes) {
            here = changes
          },
        },
        INVESTMENTS_FILE,
      )
    },
  }
}

async function fileOn(drive: FakeDrive): Promise<VendorKeyChanges | null> {
  const [entry] = (await drive.children(APP_DATA_FOLDER)).filter((candidate) => candidate.name === keysFileName(INVESTMENTS_FILE))
  if (entry === undefined) return null
  const read = decodeKeysFile(await drive.download(entry.id))
  if (read.kind === 'refused') throw new Error(`the keys file is refused: ${read.reason}`)
  return read.changes
}

describe('the keys file in the app folder', () => {
  it('is named after the Investments file and reads back what it was given, a removal too', () => {
    const changes: VendorKeyChanges = {
      twelvedata: { key: KEY_A, changedAt: '2026-10-30T10:00:00.000Z' },
      finnhub: { key: null, changedAt: '2026-10-30T10:05:00.000Z' },
    }
    expect(keysFileName('abc')).toBe('kuna-investments-keys-abc.json')
    expect(decodeKeysFile(encodeKeysFile(changes))).toEqual({ kind: 'read', changes })
  })

  it('refuses a file Kuna does not write and one a newer Kuna wrote', () => {
    expect(decodeKeysFile('not json')).toEqual({ kind: 'refused', reason: 'not-keys' })
    expect(decodeKeysFile(JSON.stringify({ format: 'kuna-prices', version: 1, keys: {} }))).toEqual({ kind: 'refused', reason: 'not-keys' })
    expect(decodeKeysFile(JSON.stringify({ format: 'kuna-vendor-keys', version: 2, keys: {} }))).toEqual({ kind: 'refused', reason: 'newer' })
    expect(decodeKeysFile(JSON.stringify({ format: 'kuna-vendor-keys', version: 1, keys: { twelvedata: { key: 1, changed_at: '2026-10-30T10:00:00.000Z' } } }))).toEqual({
      kind: 'refused',
      reason: 'not-keys',
    })
    expect(decodeKeysFile(JSON.stringify({ format: 'kuna-vendor-keys', version: 1, keys: { twelvedata: { key: KEY_A, changed_at: '30.10.2026.' } } }))).toEqual({
      kind: 'refused',
      reason: 'not-keys',
    })
  })

  it('takes the newer change of each vendor, and on the same time the one in the file', () => {
    const at = '2026-10-30T10:00:00.000Z'
    const later = '2026-10-30T10:05:00.000Z'
    expect(
      newestKeys(
        { twelvedata: { key: KEY_A, changedAt: later }, alphavantage: { key: KEY_A, changedAt: at }, finnhub: { key: KEY_A, changedAt: at } },
        { twelvedata: { key: KEY_B, changedAt: at }, alphavantage: { key: null, changedAt: later }, finnhub: { key: KEY_B, changedAt: at } },
      ),
    ).toEqual({ alphavantage: { key: null, changedAt: later }, finnhub: { key: KEY_B, changedAt: at }, twelvedata: { key: KEY_A, changedAt: later } })
  })
})

describe('the sync of the vendor keys', () => {
  it('makes no file while neither side holds a key or a removal', async () => {
    const drive = createFakeDrive()
    expect(await browserOn(drive).sync()).toEqual({ kind: 'unchanged' })
    expect(await fileOn(drive)).toBeNull()
  })

  it('gives another browser the key one saved, and leaves both unchanged on the next sync', async () => {
    const drive = createFakeDrive()
    const a = browserOn(drive)
    const b = browserOn(drive)
    a.change('twelvedata', KEY_A, '2026-10-30T10:00:00.000Z')

    expect(await a.sync()).toEqual({ kind: 'sent' })
    expect(await b.sync()).toEqual({ kind: 'received' })
    expect(b.here).toEqual({ twelvedata: { key: KEY_A, changedAt: '2026-10-30T10:00:00.000Z' } })
    expect(await a.sync()).toEqual({ kind: 'unchanged' })
    expect(await b.sync()).toEqual({ kind: 'unchanged' })
  })

  it('loses a key saved at 10:00 in browser A once browser B removed it at 10:05 and A syncs at 10:10', async () => {
    const drive = createFakeDrive()
    const a = browserOn(drive)
    const b = browserOn(drive)
    a.change('twelvedata', KEY_A, '2026-10-30T10:00:00.000Z')
    await a.sync()
    await b.sync()
    b.change('twelvedata', null, '2026-10-30T10:05:00.000Z')
    expect(await b.sync()).toEqual({ kind: 'sent' })

    // A's sync at 10:10 finds the removal of 10:05, newer than its save of 10:00.
    expect(await a.sync()).toEqual({ kind: 'received' })
    expect(a.here).toEqual({ twelvedata: { key: null, changedAt: '2026-10-30T10:05:00.000Z' } })
    expect(await fileOn(drive)).toEqual({ twelvedata: { key: null, changedAt: '2026-10-30T10:05:00.000Z' } })
  })

  it('ends both browsers on the newer of two different keys, whichever syncs first', async () => {
    for (const order of ['a-first', 'b-first'] as const) {
      const drive = createFakeDrive()
      const a = browserOn(drive)
      const b = browserOn(drive)
      a.change('twelvedata', KEY_A, '2026-10-30T10:00:00.000Z')
      b.change('twelvedata', KEY_B, '2026-10-30T10:02:00.000Z')
      const [first, second] = order === 'a-first' ? [a, b] : [b, a]

      await first.sync()
      await second.sync()
      // Synced first, A still holds its older key until its next sync takes B's.
      if (order === 'a-first') await a.sync()

      const newer = { twelvedata: { key: KEY_B, changedAt: '2026-10-30T10:02:00.000Z' } }
      expect(a.here).toEqual(newer)
      expect(b.here).toEqual(newer)
      expect(await fileOn(drive)).toEqual(newer)
    }
  })

  it('sends one vendor and takes another in the same sync', async () => {
    const drive = createFakeDrive()
    const a = browserOn(drive)
    const b = browserOn(drive)
    a.change('finnhub', KEY_A, '2026-10-30T09:00:00.000Z')
    await a.sync()
    b.change('twelvedata', KEY_B, '2026-10-30T10:00:00.000Z')

    expect(await b.sync()).toEqual({ kind: 'received' })
    expect(b.here).toEqual({ finnhub: { key: KEY_A, changedAt: '2026-10-30T09:00:00.000Z' }, twelvedata: { key: KEY_B, changedAt: '2026-10-30T10:00:00.000Z' } })
    expect(await fileOn(drive)).toEqual(b.here)
  })

  it('leaves a keys file it cannot read as it is, and keeps the keys of this browser', async () => {
    const drive = createFakeDrive()
    await drive.createFile(APP_DATA_FOLDER, keysFileName(INVESTMENTS_FILE), JSON.stringify({ format: 'kuna-vendor-keys', version: 9, keys: {} }))
    const a = browserOn(drive)
    a.change('twelvedata', KEY_A, '2026-10-30T10:00:00.000Z')

    expect(await a.sync()).toEqual({ kind: 'refused', reason: 'newer' })
    expect(a.here).toEqual({ twelvedata: { key: KEY_A, changedAt: '2026-10-30T10:00:00.000Z' } })
    expect(drive.requests.filter((request) => request === 'upload')).toEqual([])
  })

  it('keeps the keys of each Investments file apart, out of the Drive folders', async () => {
    const drive = createFakeDrive()
    const a = browserOn(drive)
    a.change('twelvedata', KEY_A, '2026-10-30T10:00:00.000Z')
    await a.sync()
    await syncVendorKeys({ drive: keysDriveOn(drive), vendorIds: VENDOR_IDS, here: () => ({}), keep: () => {} }, 'another-investments-file')

    expect((await drive.children(APP_DATA_FOLDER)).map((entry) => entry.name)).toEqual([keysFileName(INVESTMENTS_FILE)])
    expect(await drive.children('root')).toEqual([])
  })

  it('keeps a key saved on the card while the sync writes the file, and sends it on the next sync', async () => {
    const drive = createFakeDrive()
    const a = browserOn(drive)
    a.change('twelvedata', KEY_A, '2026-10-30T10:00:00.000Z')

    expect(await a.sync(() => a.change('twelvedata', KEY_B, '2026-10-30T10:00:01.000Z'))).toEqual({ kind: 'sent' })
    expect(a.here).toEqual({ twelvedata: { key: KEY_B, changedAt: '2026-10-30T10:00:01.000Z' } })
    expect(await a.sync()).toEqual({ kind: 'sent' })
    expect(await fileOn(drive)).toEqual(a.here)
  })

  it('passes a vendor this Kuna does not know through the file as it is, and then has nothing to change', async () => {
    const drive = createFakeDrive()
    const unknown = { newvendor: { key: 'made-up-new-vendor-key', changedAt: '2026-10-30T09:00:00.000Z' } }
    const text = `{"format":"kuna-vendor-keys","version":1,"keys":{"__proto__":{"key":"made-up-odd-key","changed_at":"2026-10-30T09:00:00.000Z"},"newvendor":{"key":"made-up-new-vendor-key","changed_at":"2026-10-30T09:00:00.000Z"}}}`
    await drive.createFile(APP_DATA_FOLDER, keysFileName(INVESTMENTS_FILE), text)
    const a = browserOn(drive)

    expect(await a.sync()).toEqual({ kind: 'unchanged' })
    expect(a.here).toEqual({})
    a.change('twelvedata', KEY_A, '2026-10-30T10:00:00.000Z')
    expect(await a.sync()).toEqual({ kind: 'sent' })
    const [entry] = await drive.children(APP_DATA_FOLDER)
    expect(Object.keys(JSON.parse(await drive.download(entry!.id)).keys)).toEqual(['__proto__', 'newvendor', 'twelvedata'])
    expect(await fileOn(drive)).toMatchObject({ ...unknown, twelvedata: { key: KEY_A, changedAt: '2026-10-30T10:00:00.000Z' } })
    expect(await a.sync()).toEqual({ kind: 'unchanged' })
  })

  it('ends two browsers that each kept a key before keys carried a time on the key that reached the file first', async () => {
    const drive = createFakeDrive()
    const a = browserOn(drive)
    const b = browserOn(drive)
    a.change('twelvedata', KEY_A, BEFORE_ANY_CHANGE)
    b.change('twelvedata', KEY_B, BEFORE_ANY_CHANGE)

    expect(await a.sync()).toEqual({ kind: 'sent' })
    expect(await b.sync()).toEqual({ kind: 'received' })
    expect(b.here).toEqual({ twelvedata: { key: KEY_A, changedAt: BEFORE_ANY_CHANGE } })
    expect(await fileOn(drive)).toEqual(b.here)
  })
})
