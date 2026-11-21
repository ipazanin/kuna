import { rowSide } from '../../categories/domain/rowSide'
import type { CountedRow } from './countedRow'
import type { Category } from '../../workbook/domain/category'
import { monthRange, rangeContains } from '../../../../shared/calendar/dateRange'
import type { DateRange } from '../../../../shared/calendar/dateRange'
import type { MonthKey } from '../../../../shared/calendar/monthKey'
import { ZERO, addMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** A span's figures in euros: what was spent, received and saved, and each category's and group's share of its side. */
export interface RangeTotals {
  readonly spent: Money
  readonly income: Money
  readonly saved: Money
  /** What counts on each category itself, on its side. */
  readonly byCategory: ReadonlyMap<RecordId, Money>
  /** What counts on each group, its children's rows with its own. */
  readonly byGroup: ReadonlyMap<RecordId, Money>
  /** Rows of the span on a side that the rates do not reach yet, so they count as nothing. */
  readonly unrated: number
  /** The same rows on each category itself, and on each group with its children's. */
  readonly unratedByCategory: ReadonlyMap<RecordId, number>
  readonly unratedByGroup: ReadonlyMap<RecordId, number>
}

/** One month's figures, as a span of that month counts them. */
export interface MonthTotals extends RangeTotals {
  readonly month: MonthKey
}

function added(sums: Map<RecordId, Money>, id: RecordId, amount: Money): void {
  sums.set(id, addMoney(sums.get(id) ?? ZERO, amount))
}

function counted(counts: Map<RecordId, number>, id: RecordId): void {
  counts.set(id, (counts.get(id) ?? 0) + 1)
}

/** The span's figures from the rows in euros. Transfers, money for the company and rows waiting on review stay out of every figure. */
export function rangeTotals(rows: readonly CountedRow[], categories: readonly Category[], range: DateRange): RangeTotals {
  const byId = new Map(categories.map((category) => [category.id, category]))
  const totals = { spending: ZERO, income: ZERO, saved: ZERO }
  const byCategory = new Map<RecordId, Money>()
  const byGroup = new Map<RecordId, Money>()
  const unratedByCategory = new Map<RecordId, number>()
  const unratedByGroup = new Map<RecordId, number>()
  let unrated = 0
  for (const row of rows) {
    if (!rangeContains(range, row.day)) continue
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
  return { spent: totals.spending, income: totals.income, saved: totals.saved, byCategory, byGroup, unrated, unratedByCategory, unratedByGroup }
}

export function monthTotals(rows: readonly CountedRow[], categories: readonly Category[], month: MonthKey): MonthTotals {
  return { month, ...rangeTotals(rows, categories, monthRange(month)) }
}

/** What counts on a category in the span, and how many of its rows the rates do not reach: a group's with its children's, a child's alone. With no category, what was spent in all and every row of the span the rates do not reach. */
export function categoryTotal(totals: RangeTotals, category: Category | null): { readonly counted: Money; readonly unrated: number } {
  if (category === null) return { counted: totals.spent, unrated: totals.unrated }
  const group = category.parent === null
  return {
    counted: (group ? totals.byGroup.get(category.id) : totals.byCategory.get(category.id)) ?? ZERO,
    unrated: (group ? totals.unratedByGroup.get(category.id) : totals.unratedByCategory.get(category.id)) ?? 0,
  }
}
