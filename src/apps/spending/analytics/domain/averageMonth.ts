import { categoryMonths } from './categoryMonths'
import type { CategoryMonth } from './categoryMonths'
import type { CountedRow } from './countedRow'
import type { MonthTotals } from './monthTotals'
import type { Category } from '../../workbook/domain/category'
import { dayOfMonth } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { addMonths, lastDayOf, monthOf, monthsFrom } from '../../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../../shared/calendar/monthKey'
import { divideMoney, sumMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'

/** How many whole months an average month looks back over, as Overview's charts and the Payees year do. */
export const AVERAGED_MONTHS = 12

/** The first month the book covers from its first day, as `LedgerWindow` reads it, or null for a book with no rows. */
export function firstWholeMonthOf(rows: readonly Pick<CountedRow, 'day'>[]): MonthKey | null {
  const first = rows.reduce<CivilDate | null>((oldest, row) => (oldest === null || row.day < oldest ? row.day : oldest), null)
  if (first === null) return null
  return dayOfMonth(first) === 1 ? monthOf(first) : addMonths(monthOf(first), 1)
}

/** The whole months before the day's an average reads, the last `count` or as many as the book has since its first whole month. */
export function averagedMonths(day: CivilDate, firstMonth: MonthKey | null, count = AVERAGED_MONTHS): MonthKey[] {
  if (firstMonth === null) return []
  const last = addMonths(monthOf(day), -1)
  const earliest = addMonths(last, 1 - count)
  return monthsFrom(firstMonth > earliest ? firstMonth : earliest, last)
}

/** A category's average month and the day's month so far beside it. */
export interface AverageMonth {
  /** Null for a book with no whole month yet. */
  readonly average: Money | null
  /** The whole months the average reads. */
  readonly months: readonly CategoryMonth[]
  readonly thisMonth: CategoryMonth
  /** How far the day's month has gone: the day and the days the month has. */
  readonly daysGone: number
  readonly daysInMonth: number
}

/** A category's average over the whole months before the day's, from the book's rows, and its month so far. With no category, what was spent. */
export function averageMonth(totalsOf: (month: MonthKey) => MonthTotals, category: Category | null, day: CivilDate, firstMonth: MonthKey | null): AverageMonth {
  const months = categoryMonths(totalsOf, category, averagedMonths(day, firstMonth))
  const month = monthOf(day)
  return {
    average: months.length === 0 ? null : divideMoney(sumMoney(months.map((counted) => counted.counted)), months.length),
    months,
    thisMonth: categoryMonths(totalsOf, category, [month])[0]!,
    daysGone: dayOfMonth(day),
    daysInMonth: dayOfMonth(lastDayOf(month)),
  }
}
