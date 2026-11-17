import type { LedgerWindow } from '../../../../shared/calendar/ledgerWindow'
import { fold } from '../../../../shared/text/fold'
import { EVERY_OWNER_ADVANCE, transactionsInPeriod } from '../../filters/domain/filterState'
import type { FilterState } from '../../filters/domain/filterState'
import { counterpartyIdentity } from '../../workbook/domain/counterpartyIdentity'
import { needsReview } from '../../workbook/domain/needsReview'
import { itemIdOfRow, wholeItemId } from '../../workbook/domain/splits'
import type { LedgerSplit } from '../../workbook/domain/splits'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import type { OwnerAdvance, Transaction } from '../../workbook/domain/workbook'
import { words } from './words'

/**
 * The rows a filter state selects, in the order given. The window is the whole ledger's, so the
 * rolling periods end where they end everywhere else.
 */
export function filterTransactions(transactions: readonly Transaction[], filters: FilterState, itemLabels: ItemLabels, window: LedgerWindow): Transaction[] {
  return transactionsInPeriod(scopeTransactions(transactions, filters, itemLabels), filters.period, window)
}

/** The labels each item carries, by the item's id, as `Workbook.itemLabels` holds them. */
export type ItemLabels = ReadonlyMap<RecordId, readonly RecordId[]>

/** The labels with each split row, as the bank booked it, carrying every label of its parts, for a list of whole rows such as To review. */
export function wholeRowLabels(itemLabels: ItemLabels, splits: readonly LedgerSplit[]): ItemLabels {
  const wholes = splits.map((split): [RecordId, readonly RecordId[]] => [wholeItemId(split.row), [...new Set(split.parts.flatMap((part) => itemLabels.get(part.id) ?? []))]])
  return new Map([...itemLabels, ...wholes])
}

/**
 * The rows every filter but the period selects. A screen computes its figures over these and
 * applies its own periods, such as the three windows on Overview.
 */
export function scopeTransactions(transactions: readonly Transaction[], filters: FilterState, itemLabels: ItemLabels): Transaction[] {
  const text = fold(filters.text)
  const { min, max } = filters.amount
  return transactions.filter(
    (transaction) =>
      includes(filters.accounts, transaction.account) &&
      includes(filters.buckets, transaction.bucket) &&
      includes(filters.families, transaction.family) &&
      inCategories(filters.categories, transaction) &&
      includes(filters.counterparties, counterpartyIdentity(transaction).key) &&
      carriesLabel(filters.labels, itemLabels, transaction) &&
      (min === null || transaction.amount >= min) &&
      (max === null || transaction.amount <= max) &&
      (!filters.needsReview || needsReview(transaction)) &&
      (text === '' || searchableText(transaction).includes(text)),
  )
}

/**
 * The owner's advances every filter but the period selects. An advance was paid from no account
 * of the company's, to no counterparty in the ledger, and never waits for review, so a filter on
 * any of those leaves every advance out. A label filter keeps the advances that carry a label picked. Its amount filters as the cost it books, and the
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
      (inCategories(filters.categories, advance) || filters.categories.includes(EVERY_OWNER_ADVANCE)) &&
      (filters.labels.length === 0 || (advance.labels ?? []).some((label) => filters.labels.includes(label))) &&
      (min === null || -advance.amount >= min) &&
      (max === null || -advance.amount <= max) &&
      (text === '' || fold([words.owner, advance.description, advance.category].join(' ')).includes(text)),
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

/**
 * Whether a row is in the categories chosen. The owner's part of a shared row counts in the benefit
 * category and its VAT part in the settlement category, but the row was filed in its source
 * category, so a choice of either finds them.
 */
function inCategories(categories: readonly string[], row: Pick<Transaction, 'category' | 'ownerPart'> | Pick<OwnerAdvance, 'category' | 'ownerPart'>): boolean {
  const part = row.ownerPart
  return includes(categories, row.category) || (part !== undefined && part.side !== 'business' && categories.includes(part.sourceCategory))
}

/** Whether a part of the row carries one of the labels picked, or no label is picked. */
function carriesLabel(labels: readonly RecordId[], itemLabels: ItemLabels, row: Transaction): boolean {
  return labels.length === 0 || (itemLabels.get(itemIdOfRow(row)) ?? []).some((label) => labels.includes(label))
}

function includes<Value>(selection: readonly Value[], candidate: Value): boolean {
  return selection.length === 0 || selection.includes(candidate)
}

function searchableText(transaction: Transaction): string {
  return fold([transaction.counterparty, transaction.description, transaction.category, transaction.reference, transaction.statement].join(' '))
}
