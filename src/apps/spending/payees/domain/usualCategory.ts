import { payeeKey } from './payeeKey'
import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import { rowItemsOf } from '../../workbook/domain/rowItems'
import type { Transaction } from '../../workbook/domain/transaction'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** How many of the newest entries a category needs, out of how many, to become a payee's usual one. */
export const TAKES_OVER = { entries: 2, of: 3 } as const

/** Which way an entry's money went, as the entry dialog asks it. */
export type EntrySide = 'out' | 'in'

/** The category of each entry the memory reads, oldest first: entries on the side that sit under one category with no receipt and have no other leg, whoever filed them. */
function filedOnSide(book: Pick<SpendingBook, 'items'>, rows: readonly Transaction[], side: EntrySide): readonly { readonly row: Transaction; readonly category: RecordId }[] {
  const itemsOf = rowItemsOf(book)
  return rows
    .filter((row) => row.pair === null && (side === 'out' ? row.amount < 0 : row.amount > 0))
    .sort((one, other) => one.date.localeCompare(other.date))
    .flatMap((row) => {
      const items = itemsOf(row)
      const category = items.length === 1 && items[0]!.receipt === null ? items[0]!.category : null
      return category === null ? [] : [{ row, category }]
    })
}

/** The first category sets it, and walking on by day it moves to another only once 2 of the 3 newest use that one, so one stray entry leaves it be. */
function usualOf(categories: readonly RecordId[]): RecordId | null {
  let usual: RecordId | null = null
  categories.forEach((category, place) => {
    const newest = categories.slice(Math.max(0, place - TAKES_OVER.of + 1), place + 1)
    if (usual === null || (category !== usual && newest.filter((each) => each === category).length >= TAKES_OVER.entries)) usual = category
  })
  return usual
}

/** Every payee's usual category on one side, money out or money in, by the payee's key, in one pass over the book. */
export function usualCategories(book: Pick<SpendingBook, 'transactions' | 'items'>, side: EntrySide): ReadonlyMap<string, RecordId> {
  const byKey = new Map<string, RecordId[]>()
  for (const { row, category } of filedOnSide(book, book.transactions, side)) {
    const key = payeeKey(row.payee)
    const held = byKey.get(key)
    if (key === '') continue
    if (held === undefined) byKey.set(key, [category])
    else held.push(category)
  }
  return new Map(
    [...byKey].flatMap(([key, categories]) => {
      const usual = usualOf(categories)
      return usual === null ? [] : [[key, usual] as const]
    }),
  )
}
