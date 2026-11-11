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

/** Each line's share of the row's euros, a discount line's of the other sign, so the shares add up to the row. */
function eurosOfLines({ euros, lines }: EuroRow): readonly (Money | null)[] {
  if (euros === null) return lines.map(() => null)
  return moneyParts(
    euros,
    lines.map((line) => BigInt(line.amount)),
  )
}

/**
 * What a row counts as, by the kind of its category, or part by part when a receipt or you split it. Money out on a
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
  if (row.lines.length === 0) return [partOf(row.transaction.category, row.euros)]
  const euros = eurosOfLines(row)
  return row.lines.map((line, place) => partOf(line.category, euros[place] ?? null))
}

/** The categories a row counts under: its parts' when it is split, else its own. */
export function categoriesOfRow({ transaction, lines }: Pick<EuroRow, 'transaction' | 'lines'>): readonly RecordId[] {
  if (lines.length > 0) return lines.map((line) => line.category)
  return transaction.category === null ? [] : [transaction.category]
}
