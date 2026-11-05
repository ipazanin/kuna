import { bankReturnOf, searchWithoutReturn } from '../domain/bankReturn'
import type { BankReturnNote, PendingLink } from '../domain/bankReturn'
import { LINKABLE_BANKS } from '../../workbook/domain/spendingSettings'

const PENDING_KEY = 'kuna.bank-link'
const RETURN_KEY = 'kuna.bank-return'
const FETCHED_KEY = 'kuna.bank-sync-fetched'

function read(key: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null')
  } catch {
    return null
  }
}

function write(key: string, value: unknown): void {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // A browser that keeps no site storage finds nothing on the way back, and says the link came back elsewhere.
  }
}

export function loadPendingLink(): PendingLink | null {
  const candidate = read(PENDING_KEY) as Partial<PendingLink> | null
  if (candidate === null || typeof candidate.state !== 'string' || !LINKABLE_BANKS.some((bank) => bank === candidate.bank)) return null
  return {
    bank: candidate.bank!,
    state: candidate.state,
    code: typeof candidate.code === 'string' ? candidate.code : null,
    validUntil: typeof candidate.validUntil === 'string' ? candidate.validUntil : null,
  }
}

export function savePendingLink(pending: PendingLink | null): void {
  write(PENDING_KEY, pending)
}

/** When this device's last fetch got an answer, and what it left wanting, which the step repeats while it holds back. */
export interface LastFetch {
  /** Epoch milliseconds. */
  readonly at: number
  readonly problems: readonly string[]
}

export function loadLastFetch(): LastFetch | null {
  const candidate = read(FETCHED_KEY) as Partial<LastFetch> | null
  return candidate !== null && typeof candidate.at === 'number' ? { at: candidate.at, problems: Array.isArray(candidate.problems) ? candidate.problems.map(String) : [] } : null
}

export function saveLastFetch(fetch: LastFetch | null): void {
  write(FETCHED_KEY, fetch)
}

/**
 * Takes the bank's answer out of the address and notes what it came to, before anything can move the tab away: the silent
 * trip to Google as the app opens returns to the app's bare address and a fresh page, which would lose both.
 */
export function takeBankReturn(): void {
  const { search, pathname, hash } = window.location
  const answer = bankReturnOf(search)
  if (answer === null) return
  window.history.replaceState(null, '', `${pathname}${searchWithoutReturn(search)}${hash}`)
  const pending = loadPendingLink()
  if (pending === null || pending.state !== answer.state) {
    write(RETURN_KEY, { kind: 'elsewhere' } satisfies BankReturnNote)
  } else if ('error' in answer) {
    savePendingLink(null)
    write(RETURN_KEY, { kind: 'refused', reason: answer.description === '' ? answer.error : answer.description } satisfies BankReturnNote)
  } else {
    savePendingLink({ ...pending, code: answer.code, validUntil: null })
    write(RETURN_KEY, { kind: 'code' } satisfies BankReturnNote)
  }
}

/** What the last return from a bank came to, once. */
export function takeReturnNote(): BankReturnNote | null {
  const note = read(RETURN_KEY) as BankReturnNote | null
  write(RETURN_KEY, null)
  return note
}
