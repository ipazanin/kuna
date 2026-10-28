import { daysBetween } from '../../../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../../../shared/calendar/civilDate'
import { monthsOfRange } from '../../../../../../shared/calendar/dateRange'
import type { DateRange } from '../../../../../../shared/calendar/dateRange'
import { firstDayOf, lastDayOf } from '../../../../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../../../../shared/calendar/monthKey'
import { moneyFromCents } from '../../../../../../shared/money/money'
import type { Money } from '../../../../../../shared/money/money'
import { prorated } from '../payroll/payrollArithmetic'

/** The part of an amount that falls in one month, by the days of the range in it. */
export interface DayShare {
  readonly month: MonthKey
  readonly days: number
  readonly amount: Money
}

export interface DaySpread {
  readonly totalDays: number
  /** Every month the range touches, in order. The amounts add up to the whole to the cent. */
  readonly shares: readonly DayShare[]
}

/** Spreads an amount evenly over the days of a range, rounding the running total so no cent is lost. */
export function spreadByDays(amount: Money, range: DateRange): DaySpread {
  const totalDays = daysInclusive(range.from, range.to)
  if (totalDays < 1) {
    throw new RangeError(`${range.from} to ${range.to} is not a range of days.`)
  }
  let daysSoFar = 0
  let spreadSoFar = 0
  const shares = monthsOfRange(range).map((month): DayShare => {
    const from = range.from > firstDayOf(month) ? range.from : firstDayOf(month)
    const to = range.to < lastDayOf(month) ? range.to : lastDayOf(month)
    const days = daysInclusive(from, to)
    daysSoFar += days
    const runningTotal = prorated(amount, daysSoFar, totalDays)
    const share = moneyFromCents(runningTotal - spreadSoFar)
    spreadSoFar = runningTotal
    return { month, days, amount: share }
  })
  return { totalDays, shares }
}

function daysInclusive(from: CivilDate, to: CivilDate): number {
  return daysBetween(from, to) + 1
}
