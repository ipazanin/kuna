import { lastsAYear } from './performancePeriod'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { negateMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import { daysOver365, solvedRate } from '../../../../shared/money/rateSolver'
import type { DatedFlow } from '../../../../shared/money/rateSolver'

/**
 * A portfolio's value at a day's close and the deposits less withdrawals of that day. A flow is positive when money
 * enters the portfolio, and it lands at the close, so the value already includes it.
 */
export interface ValuedDay {
  readonly date: CivilDate
  readonly value: Money
  readonly flow: Money
}

/** A time-weighted return over a whole period, and for a period of a year or more the same as a rate a year. */
export interface TimeWeightedReturn {
  readonly total: number
  /** (1 + total)^(365 ÷ days) − 1, null for a period under a year. */
  readonly yearly: number | null
}

export function timeWeightedReturn(total: number, from: CivilDate, to: CivilDate): TimeWeightedReturn {
  return { total, yearly: lastsAYear(from, to) ? (1 + total) ** (1 / daysOver365(from, to)) - 1 : null }
}

/**
 * What one euro on the first day grew to by each day. Each step is (the day's value − its flow) ÷ the previous day's
 * value, so money put in or taken out never counts as growth, and the first day's flow is part of the starting value.
 * A step from a day worth nothing, after everything was taken out, leaves the index where it was.
 */
export function timeWeightedIndex(days: readonly ValuedDay[]): number[] {
  const index: number[] = []
  days.forEach((day, position) => {
    const previous = days[position - 1]
    const reached = index[position - 1] ?? 1
    index.push(previous === undefined || previous.value <= 0 ? reached : (reached * (day.value - day.flow)) / previous.value)
  })
  return index
}

/**
 * The money-weighted return a year (XIRR) from the first day to the last, in the investor's view: the first day's value
 * and every later deposit negative, every later withdrawal and the last day's value positive. Null when no rate balances them.
 */
export function moneyWeightedRate(days: readonly ValuedDay[]): number | null {
  const [first, ...later] = days
  const last = days.at(-1)
  if (first === undefined || last === undefined) {
    return null
  }
  const flows: DatedFlow[] = [
    { date: first.date, amount: negateMoney(first.value) },
    ...later.map((day) => ({ date: day.date, amount: negateMoney(day.flow) })),
    { date: last.date, amount: last.value },
  ]
  return solvedRate(flows, daysOver365)
}
