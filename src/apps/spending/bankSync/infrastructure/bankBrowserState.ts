import type { LinkedOfBank } from '../domain/bankAccountSetup'
import { bankReturnOf, searchWithoutReturn } from '../domain/bankReturn'
import type { BankReturnNote, PendingLink } from '../domain/bankReturn'
import { LINKABLE_BANKS } from '../../workbook/domain/spendingSettings'
import { deviceChoice, jsonChoice } from '../../../../shared/device/deviceChoice'

function pendingLinkOf(parsed: unknown): PendingLink | null {
  const candidate = parsed as Partial<PendingLink> | null
  if (candidate === null || typeof candidate.state !== 'string' || !LINKABLE_BANKS.some((bank) => bank === candidate.bank)) return null
  return {
    bank: candidate.bank!,
    state: candidate.state,
    code: typeof candidate.code === 'string' ? candidate.code : null,
    validUntil: typeof candidate.validUntil === 'string' ? candidate.validUntil : null,
  }
}

// A browser that keeps no site storage finds nothing on the way back, and says the link came back elsewhere.
const PENDING = jsonChoice('kuna.bank-link', pendingLinkOf)
const RETURN = jsonChoice('kuna.bank-return', (parsed) => parsed as BankReturnNote | null)

export function loadPendingLink(): PendingLink | null {
  return PENDING.read()
}

export function savePendingLink(pending: PendingLink | null): void {
  PENDING.remember(pending)
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

function lastFetchOf(parsed: unknown): LastFetch | null {
  const candidate = parsed as Partial<LastFetch> | null
  if (candidate === null || typeof candidate !== 'object') return null
  return {
    problems: Array.isArray(candidate.problems) ? candidate.problems.map(String) : [],
    linked: Array.isArray(candidate.linked) ? candidate.linked.flatMap((linked) => linkedOf(linked) ?? []) : [],
  }
}

const FETCHED = deviceChoice<LastFetch | null>('kuna.bank-sync-fetched', null, {
  read: (kept) => lastFetchOf(JSON.parse(kept)),
  write: (fetch) => {
    if (fetch === null) return null
    const named = fetch.linked.map(({ bank, account: { uid, iban, currency, identificationHash } }) => ({ bank, account: { uid, iban, currency, identificationHash } }))
    return JSON.stringify({ ...fetch, linked: named })
  },
})

export function loadLastFetch(): LastFetch | null {
  return FETCHED.read()
}

export function saveLastFetch(fetch: LastFetch | null): void {
  FETCHED.remember(fetch)
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
    RETURN.remember({ kind: 'elsewhere' } satisfies BankReturnNote)
  } else if ('error' in answer) {
    savePendingLink(null)
    RETURN.remember({ kind: 'refused', reason: answer.description === '' ? answer.error : answer.description } satisfies BankReturnNote)
  } else {
    savePendingLink({ ...pending, code: answer.code, validUntil: null })
    RETURN.remember({ kind: 'code' } satisfies BankReturnNote)
  }
}

/** What the last return from a bank came to, once. */
export function takeReturnNote(): BankReturnNote | null {
  const note = RETURN.read()
  RETURN.remember(null)
  return note
}
