import type { CivilDate } from './civilDate'
import { firstDayOf, lastDayOf, monthOf, monthsFrom } from './monthKey'
import type { MonthKey } from './monthKey'

/** Every day from `from` to `to`, both included. */
export interface DateRange {
  readonly from: CivilDate
  readonly to: CivilDate
}

export function monthRange(from: MonthKey, to: MonthKey = from): DateRange {
  return { from: firstDayOf(from), to: lastDayOf(to) }
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
