import { monthRange, monthsOfRange } from '../../../shared/calendar/dateRange'
import type { LedgerWindow } from '../../../shared/calendar/ledgerWindow'
import { monthNumber, monthsFrom, yearOfMonth } from '../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../shared/calendar/monthKey'
import { periodRange } from './filterState'
import type { Period, Quarter } from './filterState'

export type PeriodPreset = Period['preset']

/**
 * The period after the user picks another preset. A year or quarter keeps the year the current
 * period names, else it takes the last complete month's. A custom range starts as the days the
 * current period covers, so switching to it changes nothing until a date is edited.
 */
export function periodWithPreset(current: Period, preset: PeriodPreset, window: LedgerWindow): Period {
  const anchorYear = 'year' in current ? current.year : yearOfMonth(window.lastCompleteMonth)
  switch (preset) {
    case 'l3':
    case 'l12':
    case 'all':
      return { preset }
    case 'year':
      return { preset: 'year', year: anchorYear }
    case 'quarter':
      return {
        preset: 'quarter',
        year: anchorYear,
        quarter: current.preset === 'quarter' ? current.quarter : quarterOf(window.lastCompleteMonth),
      }
    case 'custom':
      return {
        preset: 'custom',
        range: periodRange(current, window) ?? monthRange(window.firstMonth, window.partMonth),
      }
  }
}

/** The years a year or quarter preset can name: every year the ledger touches, newest first. */
export function ledgerYears(window: LedgerWindow): number[] {
  const years: number[] = []
  for (let year = yearOfMonth(window.partMonth); year >= yearOfMonth(window.firstMonth); year -= 1) {
    years.push(year)
  }
  return years
}

/** The months a period's rows fall in, within the ledger. A month the ledger covers only in part counts as one. */
export function periodMonths(period: Period, window: LedgerWindow): MonthKey[] {
  const range = periodRange(period, window)
  const months = range === null ? monthsFrom(window.firstMonth, window.partMonth) : monthsOfRange(range)
  return months.filter((month) => window.firstMonth <= month && month <= window.partMonth)
}

/**
 * The months a monthly chart of a period draws, within the ledger. A rolling window ends with the
 * last complete month, so the part-month after it is added: it is always drawn, never averaged.
 */
export function chartedMonths(period: Period, window: LedgerWindow): MonthKey[] {
  const months = periodMonths(period, window)
  return period.preset === 'l3' || period.preset === 'l12' ? [...months, window.partMonth] : months
}

function quarterOf(month: MonthKey): Quarter {
  return Math.ceil(monthNumber(month) / 3) as Quarter
}
