import { ITEM_RECORDS, TRANSACTION_RECORDS } from './spendingKinds'
import type { Transaction } from './transaction'
import type { TransactionItem } from './transactionItem'
import { rowLinkText } from './rowLink'
import type { RowLink } from './rowLink'
import { BY_DAYS } from './event'
import type { EventChoice } from './event'
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
  readonly labels: readonly RecordId[]
  /** Left out, the money joins an event by its row's day. */
  readonly event?: EventChoice
}

/** The one item of a row not split, with all of its money, which no link split off. */
export function wholeItemOf(row: Pick<Transaction, 'id' | 'amount'>, { category, note, link, labels, event = BY_DAYS }: WholeFiling): TransactionItem {
  return { id: wholeRowItemId(row), transaction: row.id, receipt: null, printed: '', note, amount: row.amount, category, link, labels, event, splitByLink: false }
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

/** Each of the row's items linked to the record in another app, as linking a whole row links it. */
export function linkedItems(items: readonly TransactionItem[], link: RowLink): readonly TransactionItem[] {
  return items.map((item) => ({ ...item, link }))
}

/** The row's items with the link taken off the parts that carry it. Parts linked to another record keep theirs. */
export function unlinkedItems(items: readonly TransactionItem[], link: RowLink): readonly TransactionItem[] {
  const taken = rowLinkText(link)
  return items.map((item) => (item.link !== null && rowLinkText(item.link) === taken ? { ...item, link: null } : item))
}

/** A record in another app that some of a row's parts are, with those parts. */
export interface PartsLink<Item> {
  readonly link: RowLink
  readonly items: readonly Item[]
}

/** Each record the row's parts link to, in the order a part first names it, with the parts that do. */
export function linksOfItems<Item extends Pick<TransactionItem, 'link'>>(items: readonly Item[]): readonly PartsLink<Item>[] {
  const byLink = new Map<string, { readonly link: RowLink; readonly items: Item[] }>()
  for (const item of items) {
    if (item.link === null) continue
    const key = rowLinkText(item.link)
    const held = byLink.get(key)
    if (held === undefined) byLink.set(key, { link: item.link, items: [item] })
    else held.items.push(item)
  }
  return [...byLink.values()]
}

/** The row's link when it has one: the one record its parts link to, or null when none links or its parts link to different records. */
export function linkOfItems(items: readonly Pick<TransactionItem, 'link'>[]): RowLink | null {
  const [only, ...more] = linksOfItems(items)
  return only === undefined || more.length > 0 ? null : only.link
}

/** Whether any of the row's parts links to a record in another app. */
export function holdsLink(items: readonly Pick<TransactionItem, 'link'>[]): boolean {
  return items.some((item) => item.link !== null)
}

/** Whether a receipt or a person split the row: it has more than one item, or a receipt's line. */
export function isSplit(items: readonly Pick<TransactionItem, 'receipt'>[]): boolean {
  return items.length > 1 || holdsReceipt(items)
}

/** Whether the row shows its parts, which it does from two, since a row of one part reads as that part, receipt line or not. */
export function hasParts(items: readonly unknown[]): boolean {
  return items.length > 1
}

/** Whether a receipt's line is among the row's items, so a receipt is attached to it. */
export function holdsReceipt(items: readonly Pick<TransactionItem, 'receipt'>[]): boolean {
  return items.some((item) => item.receipt !== null)
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
