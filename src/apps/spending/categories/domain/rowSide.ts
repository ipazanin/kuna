import type { EuroRow } from '../../rates/domain/euroRows'
import type { Category } from '../../workbook/domain/category'
import { negateMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** Where a part of a row counts: as spending, as income, as saved, or nowhere. */
export type Side = 'spending' | 'income' | 'saved' | 'nowhere'

/** One part of a row as the figures count it: its category, and its euros on its side, signed so a cost, an income and a saving each count above zero. */
export interface RowPart {
  readonly category: Category | null
  readonly side: Side
  /** Null while the rates do not reach the row's day. */
  readonly counted: Money | null
}

/** The side a category's money counts on. Between my accounts and For the company count nowhere. */
export function sideOf(category: Category | null): Side {
  switch (category?.kind) {
    case 'spending':
      return 'spending'
    case 'income':
      return 'income'
    case 'saving':
      return 'saved'
    default:
      return 'nowhere'
  }
}

/**
 * What a row counts as, by the kind of its category. Money out on a spending category is spending and money in a
 * refund that lowers it. Money in on an income category is income. Money out to Saved to investments is saved. A
 * transfer between your accounts, money for the company, and a row waiting on review count nowhere.
 */
export function rowSide(row: EuroRow, categories: ReadonlyMap<RecordId, Category>): readonly RowPart[] {
  const category = row.transaction.category === null ? null : (categories.get(row.transaction.category) ?? null)
  const side = sideOf(category)
  const counted = row.euros === null ? null : side === 'income' ? row.euros : negateMoney(row.euros)
  return [{ category, side, counted }]
}
