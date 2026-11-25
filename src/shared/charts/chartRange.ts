import { yearOf } from '../calendar/civilDate'
import type { CivilDate } from '../calendar/civilDate'
import { dateRangeOfText, dateRangeText } from '../calendar/dateRange'
import type { DateRange } from '../calendar/dateRange'
import { dayMonthsLater, firstDayOf, lastDayOf, monthOf } from '../calendar/monthKey'
import type { MonthKey } from '../calendar/monthKey'

export const CHART_PRESETS = ['1y', '3y', '5y', 'next-5y', 'all'] as const

/** A span named by where it stands from today: the last one, three or five years up to today, the next five years from today, or everything. */
export type ChartPreset = (typeof CHART_PRESETS)[number]

/** The span a time chart shows: a preset, or the days from a from day to a to day. */
export type ChartRange = ChartPreset | DateRange

/** A range as the address writes it, such as `1y` or `2026-01-01..2026-03-31`. */
export function chartRangeText(range: ChartRange): string {
  return typeof range === 'string' ? range : dateRangeText(range)
}

/** The range an address names, or null for text that names none. */
export function chartRangeOfText(text: string): ChartRange | null {
  return CHART_PRESETS.find((preset) => preset === text) ?? dateRangeOfText(text)
}

export function sameChartRange(first: ChartRange, second: ChartRange): boolean {
  return chartRangeText(first) === chartRangeText(second)
}

/**
 * The span of a chart of month ends from one month to another, each counted whole: from the last day of the
 * first month to the first day of the last, so a range is offered only where it leaves out a month.
 */
export function wholeMonthsSpan(first: MonthKey, last: MonthKey): DateRange {
  return { from: lastDayOf(first), to: firstDayOf(last) }
}

const PAST_YEARS = { '1y': 1, '3y': 3, '5y': 5 } as const
const NEXT_YEARS = 5

/** The days a range keeps, null for All. */
export function rangeWindow(range: ChartRange, today: CivilDate): DateRange | null {
  if (typeof range !== 'string') return range
  if (range === 'all') return null
  if (range === 'next-5y') return { from: today, to: dayMonthsLater(today, 12 * NEXT_YEARS) }
  return { from: dayMonthsLater(today, -12 * PAST_YEARS[range]), to: today }
}

/** The range that keeps the days of a window: All for none, a past preset that keeps the same days, or else the window as a custom range. */
export function rangeOfWindow(window: DateRange | null, today: CivilDate): ChartRange {
  if (window === null) return 'all'
  return (['1y', '3y', '5y'] as const).find((preset) => sameDays(rangeWindow(preset, today), window)) ?? window
}

function sameDays(first: DateRange | null, second: DateRange): boolean {
  return first !== null && first.from === second.from && first.to === second.to
}

/**
 * The ranges worth offering a chart over its span, in order, All last. A past range is offered once the
 * chart starts before it and still has figures in it, and the next five years once the chart runs on past
 * them, so no range shows what All shows and none shows nothing.
 */
export function chartRanges(span: DateRange, today: CivilDate): ChartPreset[] {
  const past = (['1y', '3y', '5y'] as const).filter((range) => {
    const from = dayMonthsLater(today, -12 * PAST_YEARS[range])
    return span.from < from && from <= span.to
  })
  const nextEnd = dayMonthsLater(today, 12 * NEXT_YEARS)
  return [...past, ...(nextEnd < span.to && span.from <= nextEnd ? (['next-5y'] as const) : []), 'all']
}

/** Whether a month of a month-end chart is in the range: the months of its first and last day count whole. */
export function monthInRange(window: DateRange | null, month: MonthKey): boolean {
  return window === null || (month >= monthOf(window.from) && month <= monthOf(window.to))
}

/** Whether a year of a chart of whole years is in the range: the years of its first and last day count whole. */
export function yearInRange(window: DateRange | null, year: number): boolean {
  return window === null || (year >= yearOf(window.from) && year <= yearOf(window.to))
}
