import { daysBetween } from '../../../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../../../shared/calendar/civilDate'
import { monthsOfRange } from '../../../../../../shared/calendar/dateRange'
import type { DateRange } from '../../../../../../shared/calendar/dateRange'
import { firstDayOf, lastDayOf } from '../../../../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../../../../shared/calendar/monthKey'
import { moneyParts } from '../../../../../../shared/money/decimal'
import type { Money } from '../../../../../../shared/money/money'

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

/** Spreads an amount evenly over the days of a range, so no cent is lost. */
export function spreadByDays(amount: Money, range: DateRange): DaySpread {
  const totalDays = daysInclusive(range.from, range.to)
  if (totalDays < 1) {
    throw new RangeError(`${range.from} to ${range.to} is not a range of days.`)
  }
  const months = monthsOfRange(range).map((month) => {
    const from = range.from > firstDayOf(month) ? range.from : firstDayOf(month)
    const to = range.to < lastDayOf(month) ? range.to : lastDayOf(month)
    return { month, days: daysInclusive(from, to) }
  })
  const amounts = moneyParts(
    amount,
    months.map(({ days }) => BigInt(days)),
  )
  return { totalDays, shares: months.map(({ month, days }, index) => ({ month, days, amount: amounts[index]! })) }
}

function daysInclusive(from: CivilDate, to: CivilDate): number {
  return daysBetween(from, to) + 1
}
