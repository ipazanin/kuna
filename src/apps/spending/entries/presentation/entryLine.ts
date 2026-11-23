import type { EuroRow } from '../../rates/domain/euroRows'
import type { Category } from '../../workbook/domain/category'
import { hasParts } from '../../workbook/domain/rowItems'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { mainCategoryOf } from '../../../../shared/categorising/domain/mainCategory'
import { samePayee } from '../../payees/domain/payeeKey'
import { words } from './words'

/**
 * How an entry reads in a list: who was paid or paid you, or its category when it names nobody, then each other payee a part
 * counts under, and under it its category or Waits on review, with the shared cost it is in, its account and its note.
 */
export interface EntryLine {
  readonly title: string
  readonly details: string
  /** The category the entry mostly sits in, null while it waits on review. */
  readonly category: Category | null
}

/** An entry of several parts leaves its category and note to them. One part, a receipt's line too, reads as the entry. */
export function entryLine(row: EuroRow, categories: ReadonlyMap<RecordId, Category>, showAccount: boolean, homes: ReadonlyMap<RecordId, string> = new Map()): EntryLine {
  const { transaction, account } = row
  const shown = mainCategoryOf(row.items)
  const category = shown === null ? null : (categories.get(shown) ?? null)
  const home = row.items.length === 1 && row.items[0]!.sharedCost !== null ? homes.get(row.items[0]!.sharedCost) : undefined
  const categoryName = [category?.name ?? words.waitsOnReview, ...(home === undefined ? [] : [home])].join(' · ')
  const split = hasParts(row.items)
  const others = row.items
    .map((item) => item.payee.trim())
    .filter((payee, place, all) => payee !== '' && !samePayee(payee, transaction.payee) && all.findIndex((other) => samePayee(other, payee)) === place)
  return {
    title: [transaction.payee === '' ? categoryName : transaction.payee, ...others].join(' · '),
    details: [transaction.payee === '' || split ? '' : categoryName, showAccount ? account.name : '', split ? '' : (row.items[0]?.note ?? '')].filter((part) => part !== '').join(' · '),
    category,
  }
}
