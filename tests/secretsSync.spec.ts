import { describe, expect, it, vi } from 'vitest'

import { deleteSecretsFiles, syncSecrets } from '../src/shared/secrets/application/secretsSync'
import type { SecretsSyncResult } from '../src/shared/secrets/application/secretsSync'
import type { SecretsDrive } from '../src/shared/secrets/application/secretsDrive'
import { BEFORE_ANY_CHANGE, SECRETS_FILE_NAME, decodeSecretsFile, encodeSecretsFile, newestSecrets } from '../src/shared/secrets/domain/secretsFile'
import type { SecretChange, SecretChanges } from '../src/shared/secrets/domain/secretsFile'
import { secretsDriveOn } from '../src/shared/secrets/infrastructure/fake/fakeSecretsDrive'
import { APP_DATA_FOLDER } from '../src/shared/google/driveClient'
import { createFakeDrive } from '../src/shared/storage/infrastructure/fake/fakeDrive'
import type { FakeDrive } from '../src/shared/storage/infrastructure/fake/fakeDrive'

const KEY_A = 'made-up-twelve-data-key-aaaa'
const KEY_B = 'made-up-twelve-data-key-bbbb'
const AI_KEY = 'made-up-anthropic-key-cccc'
const OLD_NAME = 'kuna-investments-keys-investments-file-1.json'
const OTHER_OLD_NAME = 'kuna-investments-keys-investments-file-2.json'

/** The old keys file of one Investments file, as Kuna wrote it before the secrets file. */
function oldKeysFile(changes: SecretChanges): string {
  const keys = Object.fromEntries(Object.entries(changes).map(([id, change]) => [id, { key: change.key, changed_at: change.changedAt }]))
  return `${JSON.stringify({ format: 'kuna-vendor-keys', version: 1, keys }, null, 2)}\n`
}

/** A Drive whose writes or listing can fail, as a lost connection or a refusal would. */
function failingOn(drive: FakeDrive, failing: { readonly write?: boolean; readonly list?: boolean; readonly download?: boolean; readonly delete?: boolean }): SecretsDrive {
  const secretsDrive = secretsDriveOn(drive)
  const offline = () => Promise.reject(new TypeError('Failed to fetch'))
  return {
    files: failing.list ? offline : secretsDrive.files,
    download: failing.download ? offline : secretsDrive.download,
    createFile: failing.write ? offline : secretsDrive.createFile,
    overwrite: failing.write ? offline : secretsDrive.overwrite,
    delete: failing.delete ? offline : secretsDrive.delete,
  }
}

/** A browser with its own secrets, which a card changes and a sync merges with the files on one shared Drive. */
function browserOn(drive: FakeDrive, start: SecretChanges = {}) {
  let here: SecretChanges = start
  return {
    get here() {
      return here
    },
    change(id: string, key: string | null, at: string) {
      here = { ...here, [id]: { key, changedAt: at } }
    },
    sync(during: () => void = () => {}, secretsDrive: SecretsDrive = secretsDriveOn(drive)): Promise<SecretsSyncResult> {
      return syncSecrets({
        drive: {
          ...secretsDrive,
          async createFile(name, text) {
            during()
            return secretsDrive.createFile(name, text)
          },
          async overwrite(fileId, text) {
            during()
            await secretsDrive.overwrite(fileId, text)
          },
        },
        here: () => here,
        keep(changes) {
          here = changes
        },
      })
    },
  }
}

/** The names of the files in the app's hidden folder, sorted. */
async function hiddenNames(drive: FakeDrive): Promise<string[]> {
  return (await drive.children(APP_DATA_FOLDER)).map((entry) => entry.name).sort()
}

/** What the one secrets file holds, or null while there is none. */
async function secretsOn(drive: FakeDrive): Promise<SecretChanges | null> {
  const entries = (await drive.children(APP_DATA_FOLDER)).filter((candidate) => candidate.name === SECRETS_FILE_NAME)
  if (entries.length === 0) return null
  expect(entries).toHaveLength(1)
  const read = decodeSecretsFile(await drive.download(entries[0]!.id))
  if (read.kind === 'refused') throw new Error(`the secrets file is refused: ${read.reason}`)
  return read.changes
}

/** Every file of the hidden folder with its text, to show a failed sync left them as they were. */
async function hiddenTexts(drive: FakeDrive): Promise<Record<string, string>> {
  const entries = await drive.children(APP_DATA_FOLDER)
  return Object.fromEntries(await Promise.all(entries.map(async (entry) => [`${entry.name} ${entry.id}`, await drive.download(entry.id)])))
}

describe('the secrets file in the app folder', () => {
  it('reads back what it was given, a removal too, in its own format', () => {
    const changes: SecretChanges = {
      twelvedata: { key: KEY_A, changedAt: '2026-10-30T10:00:00.000Z' },
      anthropic: { key: null, changedAt: '2026-10-30T10:05:00.000Z' },
    }
    expect(JSON.parse(encodeSecretsFile(changes))).toMatchObject({ format: 'kuna-secrets', version: 1, secrets: { anthropic: { key: null }, twelvedata: { key: KEY_A } } })
    expect(decodeSecretsFile(encodeSecretsFile(changes))).toEqual({ kind: 'read', changes })
  })

  it('reads the old keys file of an Investments file, whose entries have the same shape under keys', () => {
    const changes: SecretChanges = { twelvedata: { key: KEY_A, changedAt: '2026-10-30T10:00:00.000Z' } }
    expect(decodeSecretsFile(oldKeysFile(changes))).toEqual({ kind: 'read', changes })
  })

  it('refuses a file Kuna does not write and one a newer Kuna wrote, in either format', () => {
    expect(decodeSecretsFile('not json')).toEqual({ kind: 'refused', reason: 'not-keys' })
    expect(decodeSecretsFile(JSON.stringify({ format: 'kuna-prices', version: 1, secrets: {} }))).toEqual({ kind: 'refused', reason: 'not-keys' })
    expect(decodeSecretsFile(JSON.stringify({ format: 'kuna-secrets', version: 2, secrets: {} }))).toEqual({ kind: 'refused', reason: 'newer' })
    expect(decodeSecretsFile(JSON.stringify({ format: 'kuna-vendor-keys', version: 2, keys: {} }))).toEqual({ kind: 'refused', reason: 'newer' })
    expect(decodeSecretsFile(JSON.stringify({ format: 'kuna-secrets', version: 1, keys: {} }))).toEqual({ kind: 'refused', reason: 'not-keys' })
    expect(decodeSecretsFile(JSON.stringify({ format: 'kuna-secrets', version: 1, secrets: { twelvedata: { key: 1, changed_at: '2026-10-30T10:00:00.000Z' } } }))).toEqual({
      kind: 'refused',
      reason: 'not-keys',
    })
    expect(decodeSecretsFile(JSON.stringify({ format: 'kuna-secrets', version: 1, secrets: { twelvedata: { key: KEY_A, changed_at: '30.10.2026.' } } }))).toEqual({
      kind: 'refused',
      reason: 'not-keys',
    })
  })

  it('takes the newer change of each id, and on the same time the one in the file', () => {
    const at = '2026-10-30T10:00:00.000Z'
    const later = '2026-10-30T10:05:00.000Z'
    expect(
      newestSecrets(
        { twelvedata: { key: KEY_A, changedAt: later }, alphavantage: { key: KEY_A, changedAt: at }, finnhub: { key: KEY_A, changedAt: at } },
        { twelvedata: { key: KEY_B, changedAt: at }, alphavantage: { key: null, changedAt: later }, finnhub: { key: KEY_B, changedAt: at } },
      ),
    ).toEqual({ alphavantage: { key: null, changedAt: later }, finnhub: { key: KEY_B, changedAt: at }, twelvedata: { key: KEY_A, changedAt: later } })
  })
})

describe('the sync of the secrets', () => {
  it('makes no file while neither side holds a key or a removal', async () => {
    const drive = createFakeDrive()
    expect(await browserOn(drive).sync()).toEqual({ kind: 'unchanged' })
    expect(await hiddenNames(drive)).toEqual([])
  })

  it('gives another browser the key one saved, and leaves both unchanged on the next sync', async () => {
    const drive = createFakeDrive()
    const a = browserOn(drive)
    const b = browserOn(drive)
    a.change('twelvedata', KEY_A, '2026-10-30T10:00:00.000Z')

    expect(await a.sync()).toEqual({ kind: 'sent' })
    expect(await hiddenNames(drive)).toEqual([SECRETS_FILE_NAME])
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

    expect(await a.sync()).toEqual({ kind: 'received' })
    expect(a.here).toEqual({ twelvedata: { key: null, changedAt: '2026-10-30T10:05:00.000Z' } })
    expect(await secretsOn(drive)).toEqual({ twelvedata: { key: null, changedAt: '2026-10-30T10:05:00.000Z' } })
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
      expect(await secretsOn(drive)).toEqual(newer)
    }
  })

  it('sends one id and takes another in the same sync', async () => {
    const drive = createFakeDrive()
    const a = browserOn(drive)
    const b = browserOn(drive)
    a.change('finnhub', KEY_A, '2026-10-30T09:00:00.000Z')
    await a.sync()
    b.change('twelvedata', KEY_B, '2026-10-30T10:00:00.000Z')

    expect(await b.sync()).toEqual({ kind: 'received' })
    expect(b.here).toEqual({ finnhub: { key: KEY_A, changedAt: '2026-10-30T09:00:00.000Z' }, twelvedata: { key: KEY_B, changedAt: '2026-10-30T10:00:00.000Z' } })
    expect(await secretsOn(drive)).toEqual(b.here)
  })

  it('syncs a price vendor key and an AI key together, since the file knows no list of ids', async () => {
    const drive = createFakeDrive()
    const a = browserOn(drive)
    const b = browserOn(drive)
    a.change('twelvedata', KEY_A, '2026-10-30T09:00:00.000Z')
    a.change('anthropic', AI_KEY, '2026-10-30T09:30:00.000Z')

    expect(await a.sync()).toEqual({ kind: 'sent' })
    expect(await b.sync()).toEqual({ kind: 'received' })
    expect(b.here).toEqual({ anthropic: { key: AI_KEY, changedAt: '2026-10-30T09:30:00.000Z' }, twelvedata: { key: KEY_A, changedAt: '2026-10-30T09:00:00.000Z' } })
  })

  it('leaves a secrets file it cannot read as it is, and keeps the keys of this browser', async () => {
    const drive = createFakeDrive()
    await drive.createFile(APP_DATA_FOLDER, SECRETS_FILE_NAME, JSON.stringify({ format: 'kuna-secrets', version: 9, secrets: {} }))
    const a = browserOn(drive)
    a.change('twelvedata', KEY_A, '2026-10-30T10:00:00.000Z')

    expect(await a.sync()).toEqual({ kind: 'refused', reason: 'newer' })
    expect(a.here).toEqual({ twelvedata: { key: KEY_A, changedAt: '2026-10-30T10:00:00.000Z' } })
    expect(drive.requests.filter((request) => request === 'upload' || request === 'createFile')).toEqual(['createFile'])
  })

  it('keeps the secrets out of the Drive folders', async () => {
    const drive = createFakeDrive()
    const a = browserOn(drive)
    a.change('twelvedata', KEY_A, '2026-10-30T10:00:00.000Z')
    await a.sync()

    expect(await drive.children('root')).toEqual([])
  })

  it('keeps a key saved on a card while the sync writes the file, and sends it on the next sync', async () => {
    const drive = createFakeDrive()
    const a = browserOn(drive)
    a.change('twelvedata', KEY_A, '2026-10-30T10:00:00.000Z')

    expect(await a.sync(() => a.change('twelvedata', KEY_B, '2026-10-30T10:00:01.000Z'))).toEqual({ kind: 'sent' })
    expect(a.here).toEqual({ twelvedata: { key: KEY_B, changedAt: '2026-10-30T10:00:01.000Z' } })
    expect(await a.sync()).toEqual({ kind: 'sent' })
    expect(await secretsOn(drive)).toEqual(a.here)
  })

  it('takes an id this Kuna does not name, as a newer Kuna may keep, into the browser and back out unchanged', async () => {
    const drive = createFakeDrive()
    const text = `{"format":"kuna-secrets","version":1,"secrets":{"__proto__":{"key":"made-up-odd-key","changed_at":"2026-10-30T09:00:00.000Z"},"newvendor":{"key":"made-up-new-vendor-key","changed_at":"2026-10-30T09:00:00.000Z"}}}`
    await drive.createFile(APP_DATA_FOLDER, SECRETS_FILE_NAME, text)
    const a = browserOn(drive)

    expect(await a.sync()).toEqual({ kind: 'received' })
    expect(Object.keys(a.here).sort()).toEqual(['__proto__', 'newvendor'])
    a.change('twelvedata', KEY_A, '2026-10-30T10:00:00.000Z')
    expect(await a.sync()).toEqual({ kind: 'sent' })
    const [entry] = await drive.children(APP_DATA_FOLDER)
    expect(Object.keys(JSON.parse(await drive.download(entry!.id)).secrets)).toEqual(['__proto__', 'newvendor', 'twelvedata'])
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
    expect(await secretsOn(drive)).toEqual(b.here)
  })
})

describe('the move of the old keys files into the secrets file', () => {
  it('with only an old file: writes its keys into a new secrets file and this browser, then deletes the old file', async () => {
    const drive = createFakeDrive()
    const old = { twelvedata: { key: KEY_A, changedAt: '2026-10-30T10:00:00.000Z' } }
    await drive.createFile(APP_DATA_FOLDER, OLD_NAME, oldKeysFile(old))
    const a = browserOn(drive)

    expect(await a.sync()).toEqual({ kind: 'received' })
    expect(a.here).toEqual(old)
    expect(await secretsOn(drive)).toEqual(old)
    expect(await hiddenNames(drive)).toEqual([SECRETS_FILE_NAME])
    expect(drive.requests.indexOf('createFile', 1)).toBeLessThan(drive.requests.indexOf('delete'))
    expect(await a.sync()).toEqual({ kind: 'unchanged' })
  })

  it('with only an old file and this browser holding newer keys: keeps the newer, the old file folding in for the ids it alone holds', async () => {
    const drive = createFakeDrive()
    await drive.createFile(
      APP_DATA_FOLDER,
      OLD_NAME,
      oldKeysFile({ twelvedata: { key: KEY_A, changedAt: '2026-10-30T09:00:00.000Z' }, finnhub: { key: KEY_B, changedAt: '2026-10-30T09:00:00.000Z' } }),
    )
    const a = browserOn(drive, { twelvedata: { key: KEY_B, changedAt: '2026-10-30T10:00:00.000Z' } })

    expect(await a.sync()).toEqual({ kind: 'received' })
    const both = { finnhub: { key: KEY_B, changedAt: '2026-10-30T09:00:00.000Z' }, twelvedata: { key: KEY_B, changedAt: '2026-10-30T10:00:00.000Z' } }
    expect(a.here).toEqual(both)
    expect(await secretsOn(drive)).toEqual(both)
    expect(await hiddenNames(drive)).toEqual([SECRETS_FILE_NAME])
  })

  it('with both files disagreeing: the newest change of each id wins, and on the same time the secrets file', async () => {
    const drive = createFakeDrive()
    await drive.createFile(
      APP_DATA_FOLDER,
      SECRETS_FILE_NAME,
      encodeSecretsFile({
        twelvedata: { key: KEY_A, changedAt: '2026-10-30T10:00:00.000Z' },
        finnhub: { key: KEY_A, changedAt: '2026-10-30T11:00:00.000Z' },
        alphavantage: { key: KEY_A, changedAt: '2026-10-30T09:00:00.000Z' },
      }),
    )
    await drive.createFile(
      APP_DATA_FOLDER,
      OLD_NAME,
      oldKeysFile({
        twelvedata: { key: KEY_B, changedAt: '2026-10-30T10:05:00.000Z' },
        finnhub: { key: KEY_B, changedAt: '2026-10-30T10:00:00.000Z' },
        alphavantage: { key: KEY_B, changedAt: '2026-10-30T09:00:00.000Z' },
      }),
    )
    const a = browserOn(drive)

    expect(await a.sync()).toEqual({ kind: 'received' })
    const newest = {
      alphavantage: { key: KEY_A, changedAt: '2026-10-30T09:00:00.000Z' },
      finnhub: { key: KEY_A, changedAt: '2026-10-30T11:00:00.000Z' },
      twelvedata: { key: KEY_B, changedAt: '2026-10-30T10:05:00.000Z' },
    }
    expect(await secretsOn(drive)).toEqual(newest)
    expect(a.here).toEqual(newest)
    expect(await hiddenNames(drive)).toEqual([SECRETS_FILE_NAME])
  })

  it('with both files and the secrets file already newer: writes nothing and still deletes the old file it outdates', async () => {
    const drive = createFakeDrive()
    const kept = { twelvedata: { key: KEY_A, changedAt: '2026-10-30T10:00:00.000Z' } }
    await drive.createFile(APP_DATA_FOLDER, SECRETS_FILE_NAME, encodeSecretsFile(kept))
    await drive.createFile(APP_DATA_FOLDER, OLD_NAME, oldKeysFile({ twelvedata: { key: KEY_B, changedAt: '2026-10-30T09:00:00.000Z' } }))
    const a = browserOn(drive, kept)

    expect(await a.sync()).toEqual({ kind: 'unchanged' })
    expect(drive.requests.filter((request) => request === 'upload')).toEqual([])
    expect(await hiddenNames(drive)).toEqual([SECRETS_FILE_NAME])
    expect(await secretsOn(drive)).toEqual(kept)
  })

  it('with two old files from two Investments files: folds both, the newest of each id winning, and deletes both', async () => {
    const drive = createFakeDrive()
    await drive.createFile(
      APP_DATA_FOLDER,
      OLD_NAME,
      oldKeysFile({ twelvedata: { key: KEY_A, changedAt: '2026-10-30T10:00:00.000Z' }, finnhub: { key: KEY_A, changedAt: '2026-10-30T10:00:00.000Z' } }),
    )
    await drive.createFile(
      APP_DATA_FOLDER,
      OTHER_OLD_NAME,
      oldKeysFile({ twelvedata: { key: KEY_B, changedAt: '2026-10-30T10:05:00.000Z' }, alphavantage: { key: KEY_B, changedAt: '2026-10-30T08:00:00.000Z' } }),
    )
    const a = browserOn(drive)

    expect(await a.sync()).toEqual({ kind: 'received' })
    const folded = {
      alphavantage: { key: KEY_B, changedAt: '2026-10-30T08:00:00.000Z' },
      finnhub: { key: KEY_A, changedAt: '2026-10-30T10:00:00.000Z' },
      twelvedata: { key: KEY_B, changedAt: '2026-10-30T10:05:00.000Z' },
    }
    expect(await secretsOn(drive)).toEqual(folded)
    expect(a.here).toEqual(folded)
    expect(await hiddenNames(drive)).toEqual([SECRETS_FILE_NAME])
  })

  it('folds a second secrets file two browsers made at once into the one whose id sorts first, and deletes it', async () => {
    const drive = createFakeDrive()
    const first = await drive.createFile(APP_DATA_FOLDER, SECRETS_FILE_NAME, encodeSecretsFile({ twelvedata: { key: KEY_A, changedAt: '2026-10-30T10:00:00.000Z' } }))
    await drive.createFile(APP_DATA_FOLDER, SECRETS_FILE_NAME, encodeSecretsFile({ anthropic: { key: AI_KEY, changedAt: '2026-10-30T10:01:00.000Z' } }))
    const a = browserOn(drive)

    expect(await a.sync()).toEqual({ kind: 'received' })
    expect((await drive.children(APP_DATA_FOLDER)).map((entry) => entry.id)).toEqual([first.id])
    expect(await secretsOn(drive)).toEqual({ anthropic: { key: AI_KEY, changedAt: '2026-10-30T10:01:00.000Z' }, twelvedata: { key: KEY_A, changedAt: '2026-10-30T10:00:00.000Z' } })
  })

  it('lets a removal in an old file outdate an older key kept here', async () => {
    const drive = createFakeDrive()
    await drive.createFile(APP_DATA_FOLDER, OLD_NAME, oldKeysFile({ twelvedata: { key: null, changedAt: '2026-10-30T10:05:00.000Z' } }))
    const a = browserOn(drive, { twelvedata: { key: KEY_A, changedAt: '2026-10-30T10:00:00.000Z' } })

    expect(await a.sync()).toEqual({ kind: 'received' })
    expect(a.here).toEqual({ twelvedata: { key: null, changedAt: '2026-10-30T10:05:00.000Z' } })
    expect(await secretsOn(drive)).toEqual(a.here)
  })

  it('stops on an old file it cannot read, with nothing written, nothing deleted and this browser as it was', async () => {
    const drive = createFakeDrive()
    await drive.createFile(APP_DATA_FOLDER, SECRETS_FILE_NAME, encodeSecretsFile({ twelvedata: { key: KEY_A, changedAt: '2026-10-30T10:00:00.000Z' } }))
    await drive.createFile(APP_DATA_FOLDER, OLD_NAME, oldKeysFile({ finnhub: { key: KEY_B, changedAt: '2026-10-30T10:00:00.000Z' } }))
    await drive.createFile(APP_DATA_FOLDER, OTHER_OLD_NAME, JSON.stringify({ format: 'kuna-vendor-keys', version: 3, keys: {} }))
    const before = await hiddenTexts(drive)
    const a = browserOn(drive, { alphavantage: { key: KEY_A, changedAt: '2026-10-30T11:00:00.000Z' } })

    expect(await a.sync()).toEqual({ kind: 'refused', reason: 'newer' })
    expect(await hiddenTexts(drive)).toEqual(before)
    expect(drive.requests.filter((request) => request === 'upload' || request === 'delete')).toEqual([])
    expect(a.here).toEqual({ alphavantage: { key: KEY_A, changedAt: '2026-10-30T11:00:00.000Z' } })
  })

  it('on a failed write deletes no old file and changes nothing here, and the next sync finishes the move', async () => {
    const drive = createFakeDrive()
    const old = { twelvedata: { key: KEY_A, changedAt: '2026-10-30T10:00:00.000Z' } }
    await drive.createFile(APP_DATA_FOLDER, OLD_NAME, oldKeysFile(old))
    const before = await hiddenTexts(drive)
    const a = browserOn(drive, { anthropic: { key: AI_KEY, changedAt: '2026-10-30T09:00:00.000Z' } })

    await expect(a.sync(undefined, failingOn(drive, { write: true }))).rejects.toThrow('Failed to fetch')
    expect(await hiddenTexts(drive)).toEqual(before)
    expect(a.here).toEqual({ anthropic: { key: AI_KEY, changedAt: '2026-10-30T09:00:00.000Z' } })

    expect(await a.sync()).toEqual({ kind: 'received' })
    expect(await secretsOn(drive)).toEqual({ ...old, anthropic: { key: AI_KEY, changedAt: '2026-10-30T09:00:00.000Z' } })
    expect(await hiddenNames(drive)).toEqual([SECRETS_FILE_NAME])
  })

  it('on a failed delete keeps the old file, which the next sync folds in again without changing a key', async () => {
    const drive = createFakeDrive()
    const old = { twelvedata: { key: KEY_A, changedAt: '2026-10-30T10:00:00.000Z' } }
    await drive.createFile(APP_DATA_FOLDER, OLD_NAME, oldKeysFile(old))
    const a = browserOn(drive)

    expect(await a.sync(undefined, failingOn(drive, { delete: true }))).toEqual({ kind: 'received' })
    expect(await hiddenNames(drive)).toEqual([OLD_NAME, SECRETS_FILE_NAME])
    expect(await secretsOn(drive)).toEqual(old)

    // A removal here after the move outdates the old file's key, so folding it in again brings nothing back.
    a.change('twelvedata', null, '2026-10-30T11:00:00.000Z')
    expect(await a.sync()).toEqual({ kind: 'sent' })
    expect(await hiddenNames(drive)).toEqual([SECRETS_FILE_NAME])
    expect(await secretsOn(drive)).toEqual({ twelvedata: { key: null, changedAt: '2026-10-30T11:00:00.000Z' } })
    expect(a.here).toEqual({ twelvedata: { key: null, changedAt: '2026-10-30T11:00:00.000Z' } })
  })

  it('offline, while it cannot list or read the folder, writes nothing, deletes nothing and changes nothing here', async () => {
    for (const failing of [{ list: true }, { download: true }]) {
      const drive = createFakeDrive()
      await drive.createFile(APP_DATA_FOLDER, OLD_NAME, oldKeysFile({ twelvedata: { key: KEY_A, changedAt: '2026-10-30T10:00:00.000Z' } }))
      const before = await hiddenTexts(drive)
      const a = browserOn(drive, { anthropic: { key: AI_KEY, changedAt: '2026-10-30T09:00:00.000Z' } })

      await expect(a.sync(undefined, failingOn(drive, failing))).rejects.toThrow('Failed to fetch')
      expect(await hiddenTexts(drive)).toEqual(before)
      expect(a.here).toEqual({ anthropic: { key: AI_KEY, changedAt: '2026-10-30T09:00:00.000Z' } })
    }
  })

  it('folds in an old file a stale tab in another browser makes again after the move, by the same rule', async () => {
    const drive = createFakeDrive()
    const a = browserOn(drive, { twelvedata: { key: KEY_B, changedAt: '2026-10-30T11:00:00.000Z' } })
    await a.sync()
    await drive.createFile(
      APP_DATA_FOLDER,
      OLD_NAME,
      oldKeysFile({ twelvedata: { key: KEY_A, changedAt: '2026-10-30T10:00:00.000Z' }, finnhub: { key: KEY_A, changedAt: '2026-10-30T12:00:00.000Z' } }),
    )

    expect(await a.sync()).toEqual({ kind: 'received' })
    expect(a.here).toEqual({ finnhub: { key: KEY_A, changedAt: '2026-10-30T12:00:00.000Z' }, twelvedata: { key: KEY_B, changedAt: '2026-10-30T11:00:00.000Z' } })
    expect(await hiddenNames(drive)).toEqual([SECRETS_FILE_NAME])
  })

  it('leaves a file of the hidden folder that holds no secrets alone', async () => {
    const drive = createFakeDrive()
    const other = await drive.createFile(APP_DATA_FOLDER, 'kuna-something-else.json', 'not json')
    const a = browserOn(drive, { twelvedata: { key: KEY_A, changedAt: '2026-10-30T10:00:00.000Z' } })

    expect(await a.sync()).toEqual({ kind: 'sent' })
    expect(await drive.download(other.id)).toBe('not json')
  })
})

describe('no path of the move loses the newest change', () => {
  type Held = SecretChange | null
  const CHOICES: readonly Held[] = [
    null,
    { key: KEY_A, changedAt: '2026-10-30T10:00:00.000Z' },
    { key: KEY_B, changedAt: '2026-10-30T10:05:00.000Z' },
    { key: null, changedAt: '2026-10-30T10:10:00.000Z' },
  ]

  /** Every way the browser, the secrets file and two old files can each hold one of the choices for one id. */
  const cases = CHOICES.flatMap((here) => CHOICES.flatMap((secrets) => CHOICES.flatMap((first) => CHOICES.map((second) => ({ here, secrets, first, second })))))

  function newestOf(...held: Held[]): Held {
    return held.reduce<Held>((newest, change) => (change !== null && (newest === null || change.changedAt > newest.changedAt) ? change : newest), null)
  }

  async function driveHolding({ secrets, first, second }: { secrets: Held; first: Held; second: Held }): Promise<FakeDrive> {
    const drive = createFakeDrive()
    if (secrets !== null) await drive.createFile(APP_DATA_FOLDER, SECRETS_FILE_NAME, encodeSecretsFile({ twelvedata: secrets }))
    if (first !== null) await drive.createFile(APP_DATA_FOLDER, OLD_NAME, oldKeysFile({ twelvedata: first }))
    if (second !== null) await drive.createFile(APP_DATA_FOLDER, OTHER_OLD_NAME, oldKeysFile({ twelvedata: second }))
    return drive
  }

  it(`ends the browser and the one secrets file on the newest change in all ${cases.length} cases, with no other file left`, async () => {
    for (const held of cases) {
      const drive = await driveHolding(held)
      const a = browserOn(drive, held.here === null ? {} : { twelvedata: held.here })
      await a.sync()

      const newest = newestOf(held.here, held.secrets, held.first, held.second)
      const expected = newest === null ? {} : { twelvedata: newest }
      expect(a.here, JSON.stringify(held)).toEqual(expected)
      expect(await secretsOn(drive), JSON.stringify(held)).toEqual(newest === null ? null : expected)
      expect(await hiddenNames(drive), JSON.stringify(held)).toEqual(newest === null ? [] : [SECRETS_FILE_NAME])
    }
  })

  it('leaves every file and this browser as they were in every case where the write fails, and in every other ends as the first sweep does', async () => {
    let failed = 0
    for (const held of cases) {
      const drive = await driveHolding(held)
      const before = await hiddenTexts(drive)
      const start = held.here === null ? {} : { twelvedata: held.here }
      const a = browserOn(drive, start)
      const synced = await a.sync(undefined, failingOn(drive, { write: true })).then(
        () => true,
        () => false,
      )

      const newest = newestOf(held.here, held.secrets, held.first, held.second)
      if (synced) {
        // Nothing needed writing: the secrets file already held the newest change, and the old files it outdates are gone.
        expect(await secretsOn(drive), JSON.stringify(held)).toEqual(newest === null ? null : { twelvedata: newest })
        expect(await hiddenNames(drive), JSON.stringify(held)).toEqual(newest === null ? [] : [SECRETS_FILE_NAME])
        expect(a.here, JSON.stringify(held)).toEqual(newest === null ? {} : { twelvedata: newest })
      } else {
        failed += 1
        expect(await hiddenTexts(drive), JSON.stringify(held)).toEqual(before)
        expect(a.here, JSON.stringify(held)).toEqual(start)
      }
    }
    expect(failed).toBeGreaterThan(cases.length / 2)
  })
})

describe('deleting the files that hold keys', () => {
  it('deletes the secrets file and old keys files, read or not, and no other file in the hidden folder', async () => {
    const drive = createFakeDrive()
    await drive.createFile(APP_DATA_FOLDER, SECRETS_FILE_NAME, 'not json')
    await drive.createFile(APP_DATA_FOLDER, 'kuna-investments-keys-abc.json', '{}')
    await drive.createFile(APP_DATA_FOLDER, 'something-else.json', '{}')

    await deleteSecretsFiles(secretsDriveOn(drive))

    expect(await hiddenNames(drive)).toEqual(['something-else.json'])
  })

  it('lets a failed delete reach the person, with the file still there', async () => {
    const drive = createFakeDrive()
    await drive.createFile(APP_DATA_FOLDER, SECRETS_FILE_NAME, 'not json')
    vi.spyOn(drive, 'delete').mockRejectedValueOnce(new TypeError('Failed to fetch'))

    await expect(deleteSecretsFiles(secretsDriveOn(drive))).rejects.toThrow('Failed to fetch')
    expect(await hiddenNames(drive)).toEqual([SECRETS_FILE_NAME])
  })
})
