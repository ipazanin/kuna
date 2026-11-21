import type { LedgerWindow } from '../../../../shared/calendar/ledgerWindow'
import { dayMonthsLater } from '../../../../shared/calendar/monthKey'
import { periodRange, priorPeriod } from '../../../../shared/calendar/period'
import type { Period } from './filterState'

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
