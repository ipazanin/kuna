import { parseCivilDate } from './civilDate'
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

const RANGE_PATTERN = /^(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/

/** A range as an address writes it, such as `2026-01-01..2026-03-31`. */
export function dateRangeText(range: DateRange): string {
  return `${range.from}..${range.to}`
}

/** The range an address names, or null for text that names none, such as a range whose first day is after its last. */
export function dateRangeOfText(text: string): DateRange | null {
  const found = RANGE_PATTERN.exec(text)
  if (found === null) return null
  const from = parseCivilDate(found[1]!)
  const to = parseCivilDate(found[2]!)
  return from !== null && to !== null && from <= to ? { from, to } : null
}

/** The range with one end moved to the day. Moving one end past the other drags the other along, so the range never turns inside out. */
export function withRangeEnd(range: DateRange, end: 'from' | 'to', day: CivilDate): DateRange {
  return end === 'from' ? { from: day, to: day > range.to ? day : range.to } : { from: day < range.from ? day : range.from, to: day }
}
