import { civilDate } from '../../../shared/calendar/civilDate'
import { rangeContains } from '../../../shared/calendar/dateRange'
import type { DateRange } from '../../../shared/calendar/dateRange'
import { completeRange, lastMonths, spanRange } from '../../../shared/calendar/ledgerWindow'
import type { LedgerWindow } from '../../../shared/calendar/ledgerWindow'
import type { Money } from '../../../shared/money/money'
import type { Bucket } from '../../workbook/domain/bucket'
import type { Transaction } from '../../workbook/domain/workbook'

export type Quarter = 1 | 2 | 3 | 4

/**
 * Which days a view covers. `l3` and `l12` are the complete months ending with the last complete
 * one. `all` is every row, part-months included.
 */
export type Period =
  | { readonly preset: 'l3' }
  | { readonly preset: 'l12' }
  | { readonly preset: 'all' }
  | { readonly preset: 'year'; readonly year: number }
  | { readonly preset: 'quarter'; readonly year: number; readonly quarter: Quarter }
  | { readonly preset: 'custom'; readonly range: DateRange }

/** Bounds on the signed amount, in cents, both included. A debit-only view has a negative max. */
export interface AmountRange {
  readonly min: Money | null
  readonly max: Money | null
}

/**
 * Everything that narrows the rows a screen shows. An empty list means no narrowing on that field.
 * `counterparties` holds counterparty keys, not display names.
 */
export interface FilterState {
  readonly period: Period
  readonly accounts: readonly string[]
  readonly buckets: readonly Bucket[]
  readonly families: readonly string[]
  readonly categories: readonly string[]
  readonly counterparties: readonly string[]
  readonly text: string
  readonly amount: AmountRange
  /** Keeps only the rows that wait for a human, as the review queue lists them. */
  readonly needsReview: boolean
}

export const DEFAULT_FILTERS: FilterState = {
  period: { preset: 'l12' },
  accounts: [],
  buckets: [],
  families: [],
  categories: [],
  counterparties: [],
  text: '',
  amount: { min: null, max: null },
  needsReview: false,
}

/** The days a period covers, or null for `all`, which has no date bound. */
export function periodRange(period: Exclude<Period, { readonly preset: 'all' }>, window: LedgerWindow): DateRange
export function periodRange(period: Period, window: LedgerWindow): DateRange | null
export function periodRange(period: Period, window: LedgerWindow): DateRange | null {
  switch (period.preset) {
    case 'l3':
      return spanRange(lastMonths(window, 3))
    case 'l12':
      return spanRange(lastMonths(window, 12))
    case 'all':
      return null
    case 'year':
      return { from: civilDate(period.year, 1, 1), to: civilDate(period.year, 12, 31) }
    case 'quarter':
      return quarterRange(period.year, period.quarter)
    case 'custom':
      return period.range
  }
}

export function transactionsInPeriod<Row extends Pick<Transaction, 'date'>>(
  transactions: readonly Row[],
  period: Period,
  window: LedgerWindow,
): Row[] {
  const range = periodRange(period, window)
  return range === null ? [...transactions] : transactions.filter((transaction) => rangeContains(range, transaction.date))
}

export function quarterRange(year: number, quarter: Quarter): DateRange {
  const firstMonth = (quarter - 1) * 3 + 1
  const lastDay = new Date(Date.UTC(year, firstMonth + 2, 0)).getUTCDate()
  return { from: civilDate(year, firstMonth, 1), to: civilDate(year, firstMonth + 2, lastDay) }
}

/** Every complete month of the ledger as a custom period, which is what an all-time average covers. */
export function allCompleteMonths(window: LedgerWindow): Period {
  return { preset: 'custom', range: completeRange(window) }
}
