import type { EuroRow } from '../../rates/domain/euroRows'
import type { Category } from '../../workbook/domain/category'
import { hasParts } from '../../workbook/domain/rowItems'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { mainCategoryOf } from '../../../../shared/categorising/domain/mainCategory'
import { words } from './words'

/** How an entry reads in a list: who was paid or paid you, or its category when it names nobody, and under it its category or Waits on review, its account and its note. */
export interface EntryLine {
  readonly title: string
  readonly details: string
  /** The category the entry mostly sits in, null while it waits on review. */
  readonly category: Category | null
}

/** An entry of several parts leaves its category and note to them. One part, a receipt's line too, reads as the entry. */
export function entryLine(row: EuroRow, categories: ReadonlyMap<RecordId, Category>, showAccount: boolean): EntryLine {
  const { transaction, account } = row
  const shown = mainCategoryOf(row.items)
  const category = shown === null ? null : (categories.get(shown) ?? null)
  const categoryName = category?.name ?? words.waitsOnReview
  const split = hasParts(row.items)
  return {
    title: transaction.payee === '' ? categoryName : transaction.payee,
    details: [transaction.payee === '' || split ? '' : categoryName, showAccount ? account.name : '', split ? '' : (row.items[0]?.note ?? '')].filter((part) => part !== '').join(' · '),
    category,
  }
}
