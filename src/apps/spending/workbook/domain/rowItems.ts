import type { SpendingBook } from './readSpendingBook'
import { ITEM_RECORDS, TRANSACTION_RECORDS } from './spendingKinds'
import type { Transaction } from './transaction'
import type { TransactionItem } from './transactionItem'
import { keyOfRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** What the one item a row stands for is made from. */
export type WholeRow = Pick<Transaction, 'id' | 'amount' | 'category'>

/** The id of the one item a row stands for while the file holds none of its items, which its first part keeps when it is split. */
export function wholeRowItemId(row: Pick<Transaction, 'id'>): RecordId {
  return recordIdOf(ITEM_RECORDS, keyOfRecordId(TRANSACTION_RECORDS, row.id))
}

/**
 * A row's items: the ones the file holds for it, or while it holds none the one item the row stands for, with the row's whole
 * amount under its category and no words. Every figure and every question about a row's category reads them.
 */
export function itemsOfRow(row: WholeRow, held: readonly TransactionItem[]): readonly TransactionItem[] {
  if (held.length > 0) return held
  return [{ id: wholeRowItemId(row), transaction: row.id, receipt: null, printed: '', text: '', amount: row.amount, category: row.category }]
}

/** The items of any row, the book's own by the row they name. A row the book does not hold, such as one a statement brings, is its one item. */
export function rowItemsOf(book: Pick<SpendingBook, 'items'>): (row: WholeRow) => readonly TransactionItem[] {
  const heldOf = new Map<RecordId, TransactionItem[]>()
  for (const item of book.items) {
    if (item.transaction !== null) heldOf.set(item.transaction, [...(heldOf.get(item.transaction) ?? []), item])
  }
  return (row) => itemsOfRow(row, heldOf.get(row.id) ?? [])
}

/** Whether a receipt or a person split the row: it has more than one item, or a receipt's line. */
export function isSplit(items: readonly Pick<TransactionItem, 'receipt'>[]): boolean {
  return items.length > 1 || items.some((item) => item.receipt !== null)
}

/** Whether the row waits on To review: its one item has no category yet. */
export function waitsOnReview(items: readonly Pick<TransactionItem, 'category'>[]): boolean {
  return items.some((item) => item.category === null)
}

/** Whether all of the row's money is under the category, as a transfer's leg is under Between my accounts. */
export function allUnder(items: readonly Pick<TransactionItem, 'category'>[], category: RecordId | null): boolean {
  return category !== null && items.every((item) => item.category === category)
}
