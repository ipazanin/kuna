import type { LinkedOfBank } from '../domain/bankAccountSetup'
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

/**
 * What this device's last fetch left wanting, which the step repeats while it holds back. When it ran is in the Spending
 * file, which every device shares. The linked accounts are kept apart from the lines, so the step can leave out one that
 * has been added since. Of each account the browser keeps only what names it, so the bank's product and the description
 * the person set stay out.
 */
export interface LastFetch {
  readonly problems: readonly string[]
  readonly linked: readonly LinkedOfBank[]
}

function linkedOf(candidate: unknown): LinkedOfBank | null {
  const { bank, account } = (candidate ?? {}) as Partial<LinkedOfBank>
  if (!LINKABLE_BANKS.some((linkable) => linkable === bank) || account === undefined || typeof account.uid !== 'string' || typeof account.iban !== 'string' || typeof account.currency !== 'string')
    return null
  const hash = typeof account.identificationHash === 'string' ? account.identificationHash : null
  return { bank: bank!, account: { uid: account.uid, iban: account.iban, currency: account.currency, product: null, details: null, cashAccountType: null, usage: null, identificationHash: hash } }
}

export function loadLastFetch(): LastFetch | null {
  const candidate = read(FETCHED_KEY) as Partial<LastFetch> | null
  if (candidate === null || typeof candidate !== 'object') return null
  return {
    problems: Array.isArray(candidate.problems) ? candidate.problems.map(String) : [],
    linked: Array.isArray(candidate.linked) ? candidate.linked.flatMap((linked) => linkedOf(linked) ?? []) : [],
  }
}

export function saveLastFetch(fetch: LastFetch | null): void {
  const named = (linked: readonly LinkedOfBank[]) => linked.map(({ bank, account: { uid, iban, currency, identificationHash } }) => ({ bank, account: { uid, iban, currency, identificationHash } }))
  write(FETCHED_KEY, fetch === null ? null : { ...fetch, linked: named(fetch.linked) })
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
