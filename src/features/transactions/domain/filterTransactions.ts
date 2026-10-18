import type { LedgerWindow } from '../../../shared/calendar/ledgerWindow'
import { fold } from '../../../shared/text/fold'
import { EVERY_OWNER_ADVANCE, transactionsInPeriod } from '../../filters/domain/filterState'
import type { FilterState } from '../../filters/domain/filterState'
import { counterpartyIdentity } from '../../workbook/domain/counterpartyIdentity'
import { needsReview } from '../../workbook/domain/needsReview'
import type { OwnerAdvance, Transaction } from '../../workbook/domain/workbook'

/**
 * The rows a filter state selects, in the order given. The window is the whole ledger's, so the
 * rolling periods end where they end everywhere else.
 */
export function filterTransactions(
  transactions: readonly Transaction[],
  filters: FilterState,
  window: LedgerWindow,
): Transaction[] {
  return transactionsInPeriod(scopeTransactions(transactions, filters), filters.period, window)
}

/**
 * The rows every filter but the period selects. A screen computes its figures over these and
 * applies its own periods, such as the three windows on Overview.
 */
export function scopeTransactions(transactions: readonly Transaction[], filters: FilterState): Transaction[] {
  const text = fold(filters.text)
  const { min, max } = filters.amount
  return transactions.filter(
    (transaction) =>
      includes(filters.accounts, transaction.account) &&
      includes(filters.buckets, transaction.bucket) &&
      includes(filters.families, transaction.family) &&
      includes(filters.categories, transaction.category) &&
      includes(filters.counterparties, counterpartyIdentity(transaction).key) &&
      (min === null || transaction.amount >= min) &&
      (max === null || transaction.amount <= max) &&
      (!filters.needsReview || needsReview(transaction)) &&
      (text === '' || searchableText(transaction).includes(text)),
  )
}

/** Who Transactions names as the counterparty of an owner advance, which is in no ledger row. */
export const OWNER_COUNTERPARTY = 'Owner'

/**
 * The owner's advances every filter but the period selects. An advance was paid from no account
 * of the company's, to no counterparty in the ledger, and never waits for review, so a filter on
 * any of those leaves every advance out. Its amount filters as the cost it books, and the
 * `EVERY_OWNER_ADVANCE` category choice selects it whatever its category.
 */
export function scopeOwnerAdvances(advances: readonly OwnerAdvance[], filters: FilterState): OwnerAdvance[] {
  if (filters.accounts.length > 0 || filters.counterparties.length > 0 || filters.needsReview) {
    return []
  }
  const text = fold(filters.text)
  const { min, max } = filters.amount
  return advances.filter(
    (advance) =>
      includes(filters.buckets, advance.bucket) &&
      includes(filters.families, advance.family) &&
      (includes(filters.categories, advance.category) || filters.categories.includes(EVERY_OWNER_ADVANCE)) &&
      (min === null || -advance.amount >= min) &&
      (max === null || -advance.amount <= max) &&
      (text === '' || fold([OWNER_COUNTERPARTY, advance.description, advance.category].join(' ')).includes(text)),
  )
}

/**
 * The advances in the period that the account, counterparty or review filter alone leaves out,
 * so Transactions can say how many it does not list.
 */
export function advancesLeftOutByBankFilters(advances: readonly OwnerAdvance[], filters: FilterState, window: LedgerWindow): number {
  if (filters.accounts.length === 0 && filters.counterparties.length === 0 && !filters.needsReview) {
    return 0
  }
  const withoutBankFilters = { ...filters, accounts: [], counterparties: [], needsReview: false }
  return transactionsInPeriod(scopeOwnerAdvances(advances, withoutBankFilters), filters.period, window).length
}

function includes<Value>(selection: readonly Value[], candidate: Value): boolean {
  return selection.length === 0 || selection.includes(candidate)
}

function searchableText(transaction: Transaction): string {
  return fold(
    [transaction.counterparty, transaction.description, transaction.category, transaction.reference, transaction.statement].join(' '),
  )
}
