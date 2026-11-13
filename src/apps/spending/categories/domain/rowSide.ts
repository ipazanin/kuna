import type { EuroRow } from '../../rates/domain/euroRows'
import type { Category } from '../../workbook/domain/category'
import { moneyParts } from '../../../../shared/money/decimal'
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

/** Each item's share of the row's euros, a discount item's of the other sign, so the shares add up to the row. */
function eurosOfItems({ euros, items }: EuroRow): readonly (Money | null)[] {
  if (euros === null) return items.map(() => null)
  return moneyParts(
    euros,
    items.map((item) => BigInt(item.amount)),
  )
}

/**
 * What a row counts as, item by item, by the kind of each item's category. Money out on a
 * spending category is spending and money in a refund that lowers it. Money in on an income category is income. Money out
 * to Saved to investments is saved. A transfer between your accounts, money for the company, and a row waiting on review
 * count nowhere.
 */
export function rowSide(row: EuroRow, categories: ReadonlyMap<RecordId, Category>): readonly RowPart[] {
  const partOf = (id: RecordId | null, euros: Money | null): RowPart => {
    const category = id === null ? null : (categories.get(id) ?? null)
    const side = sideOf(category)
    return { category, side, counted: euros === null ? null : side === 'income' ? euros : negateMoney(euros) }
  }
  const euros = eurosOfItems(row)
  return row.items.map((item, place) => partOf(item.category, euros[place] ?? null))
}

/** The categories a row counts under, its items'. */
export function categoriesOfRow({ items }: Pick<EuroRow, 'items'>): readonly RecordId[] {
  return items.flatMap((item) => (item.category === null ? [] : [item.category]))
}
