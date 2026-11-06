import { rowSide } from '../../categories/domain/rowSide'
import type { EuroRow } from '../../rates/domain/euroRows'
import type { Category } from '../../workbook/domain/category'
import { monthOf } from '../../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../../shared/calendar/monthKey'
import { ZERO, addMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** One month's figures in euros: what was spent, received and saved, and each category's and group's share of its side. */
export interface MonthTotals {
  readonly month: MonthKey
  readonly spent: Money
  readonly income: Money
  readonly saved: Money
  /** What counts on each category itself, on its side. */
  readonly byCategory: ReadonlyMap<RecordId, Money>
  /** What counts on each group, its children's rows with its own. */
  readonly byGroup: ReadonlyMap<RecordId, Money>
  /** Rows of the month on a side that the rates do not reach yet, so they count as nothing. */
  readonly unrated: number
  /** The same rows on each category itself, and on each group with its children's. */
  readonly unratedByCategory: ReadonlyMap<RecordId, number>
  readonly unratedByGroup: ReadonlyMap<RecordId, number>
}

function added(sums: Map<RecordId, Money>, id: RecordId, amount: Money): void {
  sums.set(id, addMoney(sums.get(id) ?? ZERO, amount))
}

function counted(counts: Map<RecordId, number>, id: RecordId): void {
  counts.set(id, (counts.get(id) ?? 0) + 1)
}

/** The month's figures from the rows in euros. Transfers, money for the company and rows waiting on review stay out of every figure. */
export function monthTotals(rows: readonly EuroRow[], categories: readonly Category[], month: MonthKey): MonthTotals {
  const byId = new Map(categories.map((category) => [category.id, category]))
  const totals = { spending: ZERO, income: ZERO, saved: ZERO }
  const byCategory = new Map<RecordId, Money>()
  const byGroup = new Map<RecordId, Money>()
  const unratedByCategory = new Map<RecordId, number>()
  const unratedByGroup = new Map<RecordId, number>()
  let unrated = 0
  for (const row of rows) {
    if (monthOf(row.transaction.date) !== month) continue
    const parts = rowSide(row, byId).flatMap((part) => (part.side === 'nowhere' || part.category === null ? [] : [{ ...part, side: part.side, category: part.category }]))
    const notReached = parts.filter((part) => part.counted === null).map((part) => part.category)
    if (notReached.length > 0) {
      unrated += 1
      for (const id of new Set(notReached.map((category) => category.id))) counted(unratedByCategory, id)
      for (const id of new Set(notReached.map((category) => category.parent ?? category.id))) counted(unratedByGroup, id)
    }
    for (const { category, side, counted: euros } of parts) {
      if (euros === null) continue
      totals[side] = addMoney(totals[side], euros)
      added(byCategory, category.id, euros)
      added(byGroup, category.parent ?? category.id, euros)
    }
  }
  return { month, spent: totals.spending, income: totals.income, saved: totals.saved, byCategory, byGroup, unrated, unratedByCategory, unratedByGroup }
}

/** What counts on a category in the month, and how many of its rows the rates do not reach: a group's with its children's, a child's alone. */
export function categoryTotal(totals: MonthTotals, category: Category): { readonly counted: Money; readonly unrated: number } {
  const group = category.parent === null
  return {
    counted: (group ? totals.byGroup.get(category.id) : totals.byCategory.get(category.id)) ?? ZERO,
    unrated: (group ? totals.unratedByGroup.get(category.id) : totals.unratedByCategory.get(category.id)) ?? 0,
  }
}
