import { categoryTotal } from './monthTotals'
import type { MonthTotals } from './monthTotals'
import type { Category } from '../../workbook/domain/category'
import type { MonthKey } from '../../../../shared/calendar/monthKey'
import type { Money } from '../../../../shared/money/money'

/** What a category counted in one month, and how many of its rows there the rates do not reach. */
export interface CategoryMonth {
  readonly month: MonthKey
  readonly counted: Money
  readonly unrated: number
}

/** A category's figure in each of the months, as Overview counts that month. With no category, what was spent in each. */
export function categoryMonths(totalsOf: (month: MonthKey) => MonthTotals, category: Category | null, months: readonly MonthKey[]): CategoryMonth[] {
  return months.map((month) => ({ month, ...categoryTotal(totalsOf(month), category) }))
}
