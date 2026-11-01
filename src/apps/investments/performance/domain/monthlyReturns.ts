import type { GrowthPoint } from './portfolioPerformance'
import { yearOf } from '../../../../shared/calendar/civilDate'
import { monthOf, yearOfMonth } from '../../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../../shared/calendar/monthKey'

/** A month's or a year's return, the benchmark's over the same days, and the portfolio's less the benchmark's. */
export interface ReturnAgainstIndex {
  readonly portfolio: number
  /** Null when the growth line has no benchmark. */
  readonly benchmark: number | null
  readonly gap: number | null
}

export interface MonthReturn extends ReturnAgainstIndex {
  readonly month: MonthKey
}

export interface YearReturns extends ReturnAgainstIndex {
  readonly year: number
  /** Its months in order, from the first one the line reaches. */
  readonly months: readonly MonthReturn[]
}

/**
 * Each month's return from the growth line's points: a month end over the point before it, the first month from the
 * first day and the last from the month end before the last day. A year chains its months, so its gap is the
 * difference of the two chained returns and never a sum of the monthly gaps.
 */
export function monthlyReturns(growth: readonly GrowthPoint[]): YearReturns[] {
  const compared = growth.every((point) => point.benchmark !== null)
  const months = growth.slice(1).map((point, position): MonthReturn => {
    const before = growth[position]!
    const portfolio = point.portfolio / before.portfolio - 1
    const benchmark = compared ? point.benchmark! / before.benchmark! - 1 : null
    return { month: monthOf(point.date), portfolio, benchmark, gap: benchmark === null ? null : portfolio - benchmark }
  })
  const years = [...new Set(growth.slice(1).map((point) => yearOf(point.date)))]
  return years.map((year) => {
    const inYear = months.filter((month) => yearOfMonth(month.month) === year)
    const portfolio = chained(inYear.map((month) => month.portfolio))
    const benchmark = compared ? chained(inYear.map((month) => month.benchmark!)) : null
    return { year, portfolio, benchmark, gap: benchmark === null ? null : portfolio - benchmark, months: inYear }
  })
}

function chained(returns: readonly number[]): number {
  return returns.reduce((grown, monthly) => grown * (1 + monthly), 1) - 1
}
