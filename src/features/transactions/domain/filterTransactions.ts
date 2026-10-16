import type { LedgerWindow } from '../../../shared/calendar/ledgerWindow'
import { fold } from '../../../shared/text/fold'
import { transactionsInPeriod } from '../../filters/domain/filterState'
import type { FilterState } from '../../filters/domain/filterState'
import { counterpartyIdentity } from '../../workbook/domain/counterpartyIdentity'
import { needsReview } from '../../workbook/domain/needsReview'
import type { Transaction } from '../../workbook/domain/workbook'

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

function includes<Value>(selection: readonly Value[], candidate: Value): boolean {
  return selection.length === 0 || selection.includes(candidate)
}

function searchableText(transaction: Transaction): string {
  return fold(
    [transaction.counterparty, transaction.description, transaction.category, transaction.reference, transaction.statement].join(' '),
  )
}
