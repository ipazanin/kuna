// @vitest-environment jsdom
import { shallowReactive } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { encodeKeysFile, keysFileName } from '../src/apps/investments/prices/domain/keysFile'
import { keysDriveOn } from '../src/apps/investments/prices/infrastructure/fake/fakeKeysDrive'
import { APP_DATA_FOLDER } from '../src/shared/google/driveClient'
import { createFakeDrive } from '../src/shared/storage/infrastructure/fake/fakeDrive'
import type { FakeDrive } from '../src/shared/storage/infrastructure/fake/fakeDrive'
import { book, instrument } from './fixtures/investments'

const page = vi.hoisted(() => ({
  state: null as unknown as { choice: { source: 'drive' | 'browser'; id: string; name: string } | null; workbook: { book: unknown } | null },
  drive: null as unknown as FakeDrive,
}))

vi.mock('../src/apps/investments/workbook/application/investmentsStore', () => ({
  useInvestmentsBooks: () => ({
    get state() {
      return page.state
    },
  }),
}))
vi.mock('../src/apps/investments/prices/infrastructure/googleKeysDrive', () => ({
  googleKeysDrive: () => keysDriveOn(page.drive),
}))
vi.mock('../src/apps/investments/prices/presentation/usePrices', () => ({ PRICES_STEP: { id: 'prices' } }))
vi.mock('../src/apps/investments/workbook/presentation/LocalInvestmentsStatus.vue', () => ({ default: {} }))
vi.mock('../src/apps/loans/workbook/presentation/LocalLoansStatus.vue', () => ({ default: {} }))

const { KEYS_STEP, PAGE_KEY_STORE, keysNeeds, keysToSync } = await import('../src/apps/investments/prices/presentation/useKeysSync')
const { investmentsSyncGroup } = await import('../src/apps/investments/sync/presentation/investmentsSyncGroup')
const { loansSyncGroup } = await import('../src/apps/loans/sync/presentation/loansSyncGroup')

const INVESTMENTS_FILE = 'investments-file-1'
const OTHER_KEY = 'made-up-twelve-data-key-8642'

beforeEach(() => {
  localStorage.clear()
  page.state = shallowReactive({ choice: { source: 'drive', id: INVESTMENTS_FILE, name: 'Investments' }, workbook: { book: book({}) } })
  page.drive = createFakeDrive()
})

describe('what the Investments sync asks Google for its keys', () => {
  it('asks nothing for the keys while no key was saved or removed here and no holding is priced by a vendor that needs one', () => {
    const handPriced = book({ instruments: [instrument('gold', { prices: 'manual', sourceSymbol: '' })] })
    expect(keysToSync(null)).toBe(false)
    expect(keysToSync(handPriced)).toBe(false)
    expect(keysNeeds(handPriced)).toEqual([])
  })

  it("asks for the app's hidden folder once a holding is priced through a vendor that needs a key, so this browser can take another browser's key", () => {
    expect(keysNeeds(book({ instruments: [instrument('abc')] }))).toEqual([{ scope: 'drive.appdata', label: 'Keys' }])
  })

  it('asks for it once this browser saved or removed a key, whatever the records hold', () => {
    PAGE_KEY_STORE.write('finnhub', 'made-up-finnhub-key-5521')
    expect(keysToSync(book({}))).toBe(true)
    PAGE_KEY_STORE.write('finnhub', null)
    expect(keysToSync(book({}))).toBe(true)
  })
})

describe('the Investments part of the sync', () => {
  it('runs the keys before the prices, so the day fetch has a key another browser saved', () => {
    expect(
      investmentsSyncGroup()
        .steps()
        .map((step) => step.id),
    ).toEqual(['keys', 'prices'])
  })

  it("needs the app's hidden folder only while there are keys to carry, and the Loans file never does", () => {
    expect(investmentsSyncGroup().needs()).toEqual([{ scope: 'drive.file', label: 'Books' }])
    expect(loansSyncGroup().needs()).toEqual([{ scope: 'drive.file', label: 'Books' }])
    PAGE_KEY_STORE.write('twelvedata', OTHER_KEY)
    expect(investmentsSyncGroup().needs()).toEqual([
      { scope: 'drive.file', label: 'Books' },
      { scope: 'drive.appdata', label: 'Keys' },
    ])
    expect(loansSyncGroup().needs()).toEqual([{ scope: 'drive.file', label: 'Books' }])
  })
})

describe('the Keys step', () => {
  it('saves a key kept here to the file and says so', async () => {
    PAGE_KEY_STORE.write('twelvedata', OTHER_KEY)
    expect(await KEYS_STEP.run(() => {})).toMatchObject({ kind: 'done', line: "Saved this browser's keys to your Google account", link: null })
    expect(await page.drive.children(APP_DATA_FOLDER)).toEqual([expect.objectContaining({ name: keysFileName(INVESTMENTS_FILE) })])
  })

  it("takes another browser's key into this one", async () => {
    await page.drive.createFile(APP_DATA_FOLDER, keysFileName(INVESTMENTS_FILE), encodeKeysFile({ twelvedata: { key: OTHER_KEY, changedAt: '2026-10-30T10:00:00.000Z' } }))
    expect(await KEYS_STEP.run(() => {})).toMatchObject({ kind: 'done', line: 'Took the changes another browser saved' })
    expect(localStorage.getItem('kuna.price-vendor-key.twelvedata')).toBe(OTHER_KEY)
    expect(await KEYS_STEP.run(() => {})).toMatchObject({ kind: 'done', line: 'Up to date' })
  })

  it('fails on a keys file Kuna does not write and links to the Prices card', async () => {
    await page.drive.createFile(APP_DATA_FOLDER, keysFileName(INVESTMENTS_FILE), 'not json')
    expect(await KEYS_STEP.run(() => {})).toEqual({
      kind: 'failed',
      line: 'The keys file in your Google account is not one Kuna writes, so Kuna left it as it is.',
      link: { label: 'Settings', to: expect.any(String) },
    })
  })

  it('leaves the app folder alone for an Investments file kept in this browser', async () => {
    page.state.choice = { source: 'browser', id: 'local-1', name: 'Investments' }
    PAGE_KEY_STORE.write('twelvedata', OTHER_KEY)
    expect(await KEYS_STEP.run(() => {})).toMatchObject({ kind: 'done', line: 'Up to date' })
    expect(await page.drive.children(APP_DATA_FOLDER)).toEqual([])
  })

  it('never writes a stored time the file would refuse, so the next sync still reads the file', async () => {
    localStorage.setItem('kuna.price-vendor-key.twelvedata', OTHER_KEY)
    localStorage.setItem('kuna.price-vendor-key-changed.twelvedata', '2026-10-30T10:00:00Z')
    expect(await KEYS_STEP.run(() => {})).toMatchObject({ kind: 'done', line: "Saved this browser's keys to your Google account" })
    expect(await KEYS_STEP.run(() => {})).toMatchObject({ kind: 'done', line: 'Up to date' })
  })
})
