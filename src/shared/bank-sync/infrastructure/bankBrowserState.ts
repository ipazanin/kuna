import { bankReturnOf, searchWithoutReturn } from '../domain/bankReturn'
import type { BankReturnNote, PendingLink } from '../domain/bankReturn'
import { BANK_USAGES, bankOfOldKey } from '../domain/bankLink'
import type { BankUsage } from '../domain/bankLink'
import { jsonChoice } from '../../device/deviceChoice'

/** A login as a browser kept it, personal for a link kept before links had one. */
function usageOf(kept: unknown): BankUsage {
  return BANK_USAGES.find((usage) => usage === kept) ?? 'personal'
}

function pendingLinkOf(parsed: unknown): PendingLink | null {
  const candidate = parsed as Partial<PendingLink> | null
  if (candidate === null || typeof candidate.state !== 'string' || typeof candidate.bank !== 'string' || candidate.bank === '') return null
  return {
    bank: bankOfOldKey(candidate.bank) ?? candidate.bank,
    usage: usageOf(candidate.usage),
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
