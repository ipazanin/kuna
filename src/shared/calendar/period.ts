import { addDays, civilDate, daysBetween } from './civilDate'
import { monthRange } from './dateRange'
import type { DateRange } from './dateRange'
import type { LedgerWindow } from './ledgerWindow'
import { addMonths } from './monthKey'
import type { MonthKey } from './monthKey'

export type Quarter = 1 | 2 | 3 | 4

/**
 * Which days a view covers. `l3` and `l12` are the months ending with the part month, so they list
 * every row up to the newest. `all` is every row, part-months included. `month` is one calendar month.
 */
export type Period =
  | { readonly preset: 'l3' }
  | { readonly preset: 'l12' }
  | { readonly preset: 'all' }
  | { readonly preset: 'year'; readonly year: number }
  | { readonly preset: 'quarter'; readonly year: number; readonly quarter: Quarter }
  | { readonly preset: 'month'; readonly month: MonthKey }
  | { readonly preset: 'custom'; readonly range: DateRange }

/** The days a period covers, or null for `all`, which has no date bound. */
export function periodRange(period: Exclude<Period, { readonly preset: 'all' }>, window: LedgerWindow): DateRange
export function periodRange(period: Period, window: LedgerWindow): DateRange | null
export function periodRange(period: Period, window: LedgerWindow): DateRange | null {
  switch (period.preset) {
    case 'l3':
      return monthRange(addMonths(window.partMonth, -2), window.partMonth)
    case 'l12':
      return monthRange(addMonths(window.partMonth, -11), window.partMonth)
    case 'all':
      return null
    case 'year':
      return { from: civilDate(period.year, 1, 1), to: civilDate(period.year, 12, 31) }
    case 'quarter':
      return quarterRange(period.year, period.quarter)
    case 'month':
      return monthRange(period.month)
    case 'custom':
      return period.range
  }
}

export function quarterRange(year: number, quarter: Quarter): DateRange {
  const firstMonth = (quarter - 1) * 3 + 1
  const lastDay = new Date(Date.UTC(year, firstMonth + 2, 0)).getUTCDate()
  return { from: civilDate(year, firstMonth, 1), to: civilDate(year, firstMonth + 2, lastDay) }
}

export type CalendarPeriod = Extract<Period, { readonly preset: 'year' | 'quarter' | 'custom' }>

/** The equal period just before: the year before, the quarter before, or as many days before. */
export function priorPeriod(period: CalendarPeriod): CalendarPeriod {
  switch (period.preset) {
    case 'year':
      return { preset: 'year', year: period.year - 1 }
    case 'quarter':
      return period.quarter === 1 ? { preset: 'quarter', year: period.year - 1, quarter: 4 } : { preset: 'quarter', year: period.year, quarter: (period.quarter - 1) as 1 | 2 | 3 }
    case 'custom': {
      const length = daysBetween(period.range.from, period.range.to) + 1
      const to = addDays(period.range.from, -1)
      return { preset: 'custom', range: { from: addDays(to, 1 - length), to } }
    }
  }
}
