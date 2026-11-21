import { categoryTotal, rangeTotals } from './monthTotals'
import type { CountedRow } from './countedRow'
import type { MonthTotals } from './monthTotals'
import type { Category } from '../../workbook/domain/category'
import { civilDate, dayOfMonth, yearOf } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { lastDayOf, monthKey, monthNumber, monthOf } from '../../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../../shared/calendar/monthKey'
import type { Money } from '../../../../shared/money/money'

/** One month of a year beside the same month a year before. */
export interface MonthAgainstYear {
  readonly month: MonthKey
  /** Null for a month after the day's. */
  readonly counted: Money | null
  readonly lastYear: Money
}

/** What a category counted in a span, and its rows there the rates do not reach. */
export interface SpanCount {
  readonly counted: Money
  readonly unrated: number
}

/** A category's months of a year beside last year's, and the year so far beside the same days of last year. */
export interface YearAgainstYear {
  readonly year: number
  readonly months: readonly MonthAgainstYear[]
  /** From the first of January to the day, or the whole year for a year before the day's. */
  readonly toDate: SpanCount
  /** The same days a year before. */
  readonly lastYearToDate: SpanCount
}

/** The same day a year before, the last of February for the 29th. */
function dayAYearBefore(day: CivilDate): CivilDate {
  const month = monthKey(yearOf(day) - 1, monthNumber(monthOf(day)))
  return civilDate(yearOf(day) - 1, monthNumber(month), Math.min(dayOfMonth(day), dayOfMonth(lastDayOf(month))))
}

/** A category's year against the year before, each month as Overview counts it. With no category, what was spent. */
export function yearAgainstYear(
  rows: readonly CountedRow[],
  categories: readonly Category[],
  totalsOf: (month: MonthKey) => MonthTotals,
  category: Category | null,
  year: number,
  day: CivilDate,
): YearAgainstYear {
  const shownMonth = monthOf(day)
  const months = Array.from({ length: 12 }, (_, place) => monthKey(year, place + 1)).map((month) => ({
    month,
    counted: month > shownMonth ? null : categoryTotal(totalsOf(month), category).counted,
    lastYear: categoryTotal(totalsOf(monthKey(year - 1, monthNumber(month))), category).counted,
  }))
  const to = year < yearOf(day) ? civilDate(year, 12, 31) : day
  const spanCount = (from: CivilDate, until: CivilDate): SpanCount => categoryTotal(rangeTotals(rows, categories, { from, to: until }), category)
  return {
    year,
    months,
    toDate: spanCount(civilDate(year, 1, 1), to),
    lastYearToDate: spanCount(civilDate(year - 1, 1, 1), dayAYearBefore(to)),
  }
}
