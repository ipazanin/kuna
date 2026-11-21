import { monthsOfRange } from '../../../../shared/calendar/dateRange'
import type { LedgerWindow } from '../../../../shared/calendar/ledgerWindow'
import { lastDayOf, monthsFrom } from '../../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../../shared/calendar/monthKey'
import { periodRange } from '../../../../shared/calendar/period'
import type { Period } from './filterState'

/** The months a period's rows fall in, within the ledger. A month the ledger covers only in part counts as one. */
export function periodMonths(period: Period, window: LedgerWindow): MonthKey[] {
  const range = periodRange(period, window)
  const months = range === null ? monthsFrom(window.firstMonth, window.partMonth) : monthsOfRange(range)
  return months.filter((month) => window.firstMonth <= month && month <= window.partMonth)
}

/**
 * The days an average over a period counts. A rolling window leaves out its part month, which is
 * drawn but never averaged. Any other period counts as it is.
 */
export function averagedPeriod(period: Period, window: LedgerWindow): Period {
  if (period.preset !== 'l3' && period.preset !== 'l12') {
    return period
  }
  return { preset: 'custom', range: { from: periodRange(period, window).from, to: lastDayOf(window.lastCompleteMonth) } }
}
