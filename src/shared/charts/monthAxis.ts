import type { ChartTokens } from './chartTokens'
import { monthAxisLabel } from '../calendar/monthLabel'
import { yearOfMonth } from '../calendar/monthKey'
import type { MonthKey } from '../calendar/monthKey'

/** Every year on a short axis, every other or every fifth on a long one, fewer on a phone. */
export function yearStep(years: number, phone: boolean): number {
  if (phone) return years > 10 ? 5 : years > 4 ? 2 : 1
  return years > 12 ? 2 : 1
}

/** The labels of a month axis: every January of every year step on a long axis, as `yearStep` sets it, and each month on one of a year or less. */
export function monthAxisLabels(months: readonly MonthKey[], tokens: ChartTokens, phone: boolean): Record<string, unknown> {
  const first = months[0]
  const last = months.at(-1)
  if (first === undefined || last === undefined || months.length <= 12) return { color: tokens.inkMuted, formatter: monthAxisLabel('short') }
  const step = yearStep(yearOfMonth(last) - yearOfMonth(first), phone)
  return {
    color: tokens.inkMuted,
    interval: (_index: number, month: string) => month.endsWith('-01') && Number(month.slice(0, 4)) % step === 0,
    formatter: (month: string) => month.slice(0, 4),
  }
}

/** Keeps the tooltip to the named series that have a figure at the hovered month. */
export function shownPoints(points: unknown): unknown {
  return (Array.isArray(points) ? points : [points]).filter((point: { seriesName?: string; value?: unknown }) => point.seriesName !== '' && typeof point.value === 'number')
}
