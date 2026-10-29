import { addDays, daysBetween } from '../../../../shared/calendar/civilDate'
import type { LedgerWindow } from '../../../../shared/calendar/ledgerWindow'
import { dayMonthsLater } from '../../../../shared/calendar/monthKey'
import { periodRange } from './filterState'
import type { Period } from './filterState'

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

/**
 * What a period is compared with: for a rolling window, the same days one window earlier, up to the
 * newest transaction's day of the month, so the part month is set against as many days of its month.
 * Else the prior equal calendar period. All time has nothing before it.
 */
export function priorEqualPeriod(period: Period, window: LedgerWindow): Period | null {
  switch (period.preset) {
    case 'l3':
    case 'l12': {
      const count = period.preset === 'l3' ? 3 : 12
      const { from } = periodRange(period, window)
      return { preset: 'custom', range: { from: dayMonthsLater(from, -count), to: dayMonthsLater(window.newestDay, -count) } }
    }
    case 'all':
      return null
    default:
      return priorPeriod(period)
  }
}
