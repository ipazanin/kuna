import { monthRange } from './dateRange'
import type { LedgerWindow } from './ledgerWindow'
import { monthNumber, monthsFrom, yearOfMonth } from './monthKey'
import type { MonthKey } from './monthKey'
import { periodRange } from './period'
import type { Period, Quarter } from './period'

export type PeriodPreset = Period['preset']

/**
 * The period after the user picks another preset. A year or quarter keeps the year the current
 * period names, else it takes the last complete month's. A month keeps the month the current period
 * names, else it takes the last complete one. A custom range starts as the days the current period
 * covers, so switching to it changes nothing until a date is edited.
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
    case 'month':
      return { preset: 'month', month: current.preset === 'month' ? current.month : window.lastCompleteMonth }
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

/** The months a month preset can name: every month the ledger touches, newest first. */
export function ledgerMonths(window: LedgerWindow): MonthKey[] {
  return monthsFrom(window.firstMonth, window.partMonth).reverse()
}

function quarterOf(month: MonthKey): Quarter {
  return Math.ceil(monthNumber(month) / 3) as Quarter
}
