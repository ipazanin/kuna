import { ITEM_RECORDS, TRANSACTION_RECORDS } from './spendingKinds'
import type { Transaction } from './transaction'
import type { TransactionItem } from './transactionItem'
import type { RowLink } from './rowLink'
import { isTransferCategory } from './category'
import type { Category } from './category'
import { keyOfRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** The id of a row's first item, which holds all of a row not split and which the first part keeps when it is split. */
export function wholeRowItemId(row: Pick<Transaction, 'id'>): RecordId {
  return recordIdOf(ITEM_RECORDS, keyOfRecordId(TRANSACTION_RECORDS, row.id))
}

/** A row with every item it has. */
export interface ItemizedRow {
  readonly row: Transaction
  readonly items: readonly TransactionItem[]
}

/** The row with the items the book holds of it. */
export function itemizedRow(book: { readonly items: readonly TransactionItem[] }, row: Transaction): ItemizedRow {
  return { row, items: rowItemsOf(book)(row) }
}

/** What a row not split files all of its money as. */
export interface WholeFiling {
  readonly category: RecordId | null
  readonly note: string
  readonly link: RowLink | null
}

/** The one item of a row not split, with all of its money. */
export function wholeItemOf(row: Pick<Transaction, 'id' | 'amount'>, { category, note, link }: WholeFiling): TransactionItem {
  return { id: wholeRowItemId(row), transaction: row.id, receipt: null, printed: '', note, amount: row.amount, category, link }
}

/** The items of any row, the ones the items given name it in, in their order. */
export function rowItemsOf(book: { readonly items: readonly TransactionItem[] }): (row: Pick<Transaction, 'id'>) => readonly TransactionItem[] {
  const itemsOf = new Map<RecordId, TransactionItem[]>()
  for (const item of book.items) {
    if (item.transaction !== null) itemsOf.set(item.transaction, [...(itemsOf.get(item.transaction) ?? []), item])
  }
  return (row) => itemsOf.get(row.id) ?? []
}

/** The item with the most money, signs aside, the first of them in the row's order on a tie. A row of several shows its note. */
export function largestItem<Item extends Pick<TransactionItem, 'amount'>>(items: readonly Item[]): Item | null {
  return items.reduce<Item | null>((largest, item) => (largest === null || Math.abs(item.amount) > Math.abs(largest.amount) ? item : largest), null)
}

/** The row's one item under another category, for a row not split, which a rule, the pairing or To review files. */
export function refiledItems(items: readonly TransactionItem[], category: RecordId | null): readonly TransactionItem[] {
  return items.map((item) => ({ ...item, category }))
}

/** Each of the row's items linked to the record in another app, or with its link taken off for null. */
export function linkedItems(items: readonly TransactionItem[], link: RowLink | null): readonly TransactionItem[] {
  return items.map((item) => ({ ...item, link }))
}

/** The link the row's items carry, or null. A write links every item of a row, so they share it. */
export function linkOfItems(items: readonly Pick<TransactionItem, 'link'>[]): RowLink | null {
  return items.find((item) => item.link !== null)?.link ?? null
}

/** Whether a receipt or a person split the row: it has more than one item, or a receipt's line. */
export function isSplit(items: readonly Pick<TransactionItem, 'receipt'>[]): boolean {
  return items.length > 1 || items.some((item) => item.receipt !== null)
}

/** Whether the row waits on To review: its one item has no category yet. */
export function waitsOnReview(items: readonly Pick<TransactionItem, 'category'>[]): boolean {
  return items.some((item) => item.category === null)
}

/** Tells whether all of a row's money moves between your own accounts, as a transfer's leg does: each of its items is under a transfer category. */
export function filedAsTransfer(categories: readonly Pick<Category, 'id' | 'kind'>[]): (items: readonly Pick<TransactionItem, 'category'>[]) => boolean {
  const transfers = new Set(categories.filter(isTransferCategory).map((category) => category.id))
  return (items) => items.length > 0 && items.every((item) => item.category !== null && transfers.has(item.category))
}
