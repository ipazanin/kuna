import { parseCivilDate } from './civilDate'
import { parseMonthKey } from './monthKey'
import type { Period, Quarter } from './period'

const YEAR_PATTERN = /^(\d{4})$/
const QUARTER_PATTERN = /^(\d{4})q([1-4])$/
const CUSTOM_PATTERN = /^(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/

/** A period as an address writes it, such as `l12`, `2026`, `2026q3`, `2026-03` or `2026-01-01..2026-03-31`. */
export function periodText(period: Period): string {
  switch (period.preset) {
    case 'l3':
    case 'l12':
    case 'all':
      return period.preset
    case 'year':
      return String(period.year)
    case 'quarter':
      return `${period.year}q${period.quarter}`
    case 'month':
      return period.month
    case 'custom':
      return `${period.range.from}..${period.range.to}`
  }
}

/** The period an address names, or null for text that names none, such as a span whose first day is after its last. */
export function periodOfText(text: string | null): Period | null {
  if (text === null) return null
  if (text === 'l3' || text === 'l12' || text === 'all') return { preset: text }
  const year = YEAR_PATTERN.exec(text)
  if (year !== null) return { preset: 'year', year: Number(year[1]) }
  const quarter = QUARTER_PATTERN.exec(text)
  if (quarter !== null) return { preset: 'quarter', year: Number(quarter[1]), quarter: Number(quarter[2]) as Quarter }
  const month = parseMonthKey(text)
  if (month !== null) return { preset: 'month', month }
  const custom = CUSTOM_PATTERN.exec(text)
  if (custom === null) return null
  const from = parseCivilDate(custom[1]!)
  const to = parseCivilDate(custom[2]!)
  return from !== null && to !== null && from <= to ? { preset: 'custom', range: { from, to } } : null
}
