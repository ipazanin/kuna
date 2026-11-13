import { afterEach, describe, expect, it, vi } from 'vitest'

import type { LinkedAccount } from '../src/apps/spending/bankSync/domain/bankAnswer'
import { spendingSettingsOf } from '../src/apps/spending/workbook/domain/spendingSettings'
import { ACCOUNTS } from './fixtures/spending'

const NOW = Date.parse('2026-10-30T12:00:00.000Z')
const HOUR = 3_600_000

// The step reads the store's state as it runs, so each test sets the file this device opened.
const store = vi.hoisted(() => ({ state: { workbook: null as unknown, writes: [] as unknown[] } }))
const fetchAndImport = vi.hoisted(() =>
  vi.fn(async () => ({ dryRun: { newRows: 0, alreadyIn: 0, filled: 0, notes: [] }, problems: [], linked: [], proposals: [], differences: [], olderRows: [], receipt: null })),
)

vi.mock('../src/apps/spending/workbook/application/spendingStore', () => ({ useSpendingBooks: () => store }))
vi.mock('../src/apps/spending/bankSync/presentation/useBankSync', () => ({ fetchAndImport }))

const { loadLastFetch, saveLastFetch } = await import('../src/apps/spending/bankSync/infrastructure/bankBrowserState')
const { BANK_SYNC_STEP } = await import('../src/apps/spending/bankSync/presentation/bankSyncStep')

function linked(uid: string, iban: string, currency: string): LinkedAccount {
  return { uid, iban, currency, product: null, details: null, cashAccountType: null, usage: null, identificationHash: null }
}

function stubStorage(): void {
  const stored = new Map<string, string>()
  vi.stubGlobal('localStorage', { getItem: (key: string) => stored.get(key) ?? null, setItem: (key: string, text: string) => stored.set(key, text), removeItem: (key: string) => stored.delete(key) })
}

/** This device opens the file, in which another device's fetch wrote when OTP last answered. */
function openedWithOtpFetchedAt(fetchedAt: number): void {
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
  const rows = [
    { id: 'w', key: 'bank_sync_deployment', value: 'AKfycb-made-up' },
    { id: 'x', key: 'bank_link_otp', value: '2027-01-01' },
    { id: 'y', key: 'bank_sync_fetched_otp', value: new Date(fetchedAt).toISOString() },
  ]
  store.state.workbook = { accounts: ACCOUNTS, categories: [], rules: [], transactions: [], receipts: [], items: [], held: [], settings: spendingSettingsOf(rows as never) }
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  fetchAndImport.mockClear()
  store.state.workbook = null
})

describe('the bank step across devices', () => {
  it('holds on a second device within six hours of a fetch on another, though this device never fetched', async () => {
    stubStorage()
    openedWithOtpFetchedAt(NOW - HOUR)
    expect(await BANK_SYNC_STEP.run(() => undefined, '', 'due')).toEqual({ kind: 'done', line: 'Asked the banks less than six hours ago, so they are left alone for now.', writeId: null, link: null })
    expect(fetchAndImport).not.toHaveBeenCalled()
  })

  it('fetches once six hours have passed since any device asked', async () => {
    stubStorage()
    openedWithOtpFetchedAt(NOW - 6 * HOUR)
    await BANK_SYNC_STEP.run(() => undefined, '', 'due')
    expect(fetchAndImport).toHaveBeenCalledWith(false)
  })

  it('asks the banks inside six hours as a person, when the run asks now', async () => {
    stubStorage()
    openedWithOtpFetchedAt(NOW - HOUR)
    await BANK_SYNC_STEP.run(() => undefined, '', 'now')
    expect(fetchAndImport).toHaveBeenCalledWith(true)
  })

  it('keeps saying what the last fetch on this device left, so a failure is not hidden for six hours', async () => {
    stubStorage()
    openedWithOtpFetchedAt(NOW - HOUR)
    saveLastFetch({ problems: ['OTP did not answer, so its rows wait for a later sync: HTTP 503'], linked: [] })
    const result = await BANK_SYNC_STEP.run(() => undefined, '', 'due')
    expect(result).toMatchObject({ kind: 'waits', link: { to: '/spending/settings?tab=bank-sync' } })
    expect('line' in result && result.line).toContain('OTP did not answer')
  })

  it("keeps of each account only what names it, never the bank's product or the description you set", () => {
    stubStorage()
    const described = { ...linked('u', 'HR0000000000000000077', 'EUR'), product: 'Standard', details: 'Holiday money', cashAccountType: 'CACC', usage: 'PRIV', identificationHash: 'hash-1' }
    saveLastFetch({ problems: [], linked: [{ bank: 'otp', account: described }] })
    expect(JSON.parse(localStorage.getItem('kuna.bank-sync-fetched')!)).toEqual({
      problems: [],
      linked: [{ bank: 'otp', account: { uid: 'u', iban: 'HR0000000000000000077', currency: 'EUR', identificationHash: 'hash-1' } }],
    })
    expect(loadLastFetch()?.linked[0]?.account).toEqual({ ...described, product: null, details: null, cashAccountType: null, usage: null })
  })
})
