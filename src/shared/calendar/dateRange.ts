import type { CivilDate } from './civilDate'
import { addMonths, firstDayOf, lastDayOf, monthOf, monthsFrom } from './monthKey'
import type { MonthKey } from './monthKey'

/** Every day from `from` to `to`, both included. */
export interface DateRange {
  readonly from: CivilDate
  readonly to: CivilDate
}

export function monthRange(from: MonthKey, to: MonthKey = from): DateRange {
  return { from: firstDayOf(from), to: lastDayOf(to) }
}

/** The twelve whole months up to the month of the day, that month included, as Payees and Entries count Last 12 months. */
export function lastTwelveMonths(day: CivilDate): DateRange {
  const last = monthOf(day)
  return monthRange(addMonths(last, -11), last)
}

export function rangeContains(range: DateRange, date: CivilDate): boolean {
  return range.from <= date && date <= range.to
}

/** The days two ranges share, or null when they share none. */
export function overlapOf(first: DateRange, second: DateRange): DateRange | null {
  const from = first.from > second.from ? first.from : second.from
  const to = first.to < second.to ? first.to : second.to
  return from <= to ? { from, to } : null
}

/** The months a range touches, including a month it covers only in part. */
export function monthsOfRange(range: DateRange): MonthKey[] {
  return monthsFrom(monthOf(range.from), monthOf(range.to))
}
