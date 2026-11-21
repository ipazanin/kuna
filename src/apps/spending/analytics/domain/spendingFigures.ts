import { budgetMonths } from '../../budgets/domain/budgetCarry'
import type { BudgetMonth } from '../../budgets/domain/budgetCarry'
import { averageMonth, firstWholeMonthOf } from './averageMonth'
import type { AverageMonth } from './averageMonth'
import { categoryTrends } from './categoryTrends'
import type { CategoryTrend } from './categoryTrends'
import { countedRows } from './countedRow'
import { keptMoney } from './keptMoney'
import type { KeptMonth } from './keptMoney'
import { categoryTotal, monthTotals } from './monthTotals'
import type { MonthTotals } from './monthTotals'
import { spanBreakdown } from './spanBreakdown'
import type { Grouping, SpanBreakdown } from './spanBreakdown'
import { yearAgainstYear } from './yearAgainstYear'
import type { YearAgainstYear } from './yearAgainstYear'
import type { Category } from '../../workbook/domain/category'
import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { DateRange } from '../../../../shared/calendar/dateRange'
import type { MonthKey } from '../../../../shared/calendar/monthKey'
import type { RateBook } from '../../../../shared/money/rateBook'
import { ZERO } from '../../../../shared/money/money'

/** The book's figures at the rates in hand, each month's totals worked out once when first asked for. */
export interface SpendingFigures {
  totalsOf(month: MonthKey): MonthTotals
  /** Every limited category in the month, with its carry. */
  limitsIn(month: MonthKey): readonly BudgetMonth[]
  /** A span's money grouped one way. */
  breakdownOf(range: DateRange, grouping: Grouping): SpanBreakdown
  /** A category's average over the last whole months, and its month so far. With no category, what was spent. */
  averageOf(category: Category | null, day: CivilDate): AverageMonth
  /** A category's months of a year beside last year's. With no category, what was spent. */
  yearAgainstYearOf(category: Category | null, year: number, day: CivilDate): YearAgainstYear
  /** What each month kept and what it became. */
  keptIn(months: readonly MonthKey[]): KeptMonth[]
  /** Each spending category's trend over the whole months before the day's. */
  trendsOn(day: CivilDate): CategoryTrend[]
}

export function spendingFigures(book: Pick<SpendingBook, 'accounts' | 'transactions' | 'categories' | 'budgets' | 'items' | 'labels'>, rates: RateBook): SpendingFigures {
  const rows = countedRows(book, rates)
  const categories = new Map(book.categories.map((category) => [category.id, category]))
  const months = new Map<MonthKey, MonthTotals>()
  const totalsOf = (month: MonthKey): MonthTotals => {
    let totals = months.get(month)
    if (totals === undefined) {
      totals = monthTotals(rows, book.categories, month)
      months.set(month, totals)
    }
    return totals
  }
  return {
    totalsOf,
    limitsIn: (month) =>
      budgetMonths(
        book.budgets,
        (category, earlier) => {
          const limited = categories.get(category)
          if (limited === undefined) return { spent: ZERO, unrated: 0 }
          const { counted, unrated } = categoryTotal(totalsOf(earlier), limited)
          return { spent: counted, unrated }
        },
        month,
      ),
    breakdownOf: (range, grouping) => spanBreakdown(rows, book, range, grouping),
    averageOf: (category, day) => averageMonth(totalsOf, category, day, firstWholeMonthOf(rows)),
    yearAgainstYearOf: (category, year, day) => yearAgainstYear(rows, book.categories, totalsOf, category, year, day),
    keptIn: (months) => keptMoney(rows, book.categories, totalsOf, months),
    trendsOn: (day) => categoryTrends(totalsOf, book.categories, day, firstWholeMonthOf(rows)),
  }
}
