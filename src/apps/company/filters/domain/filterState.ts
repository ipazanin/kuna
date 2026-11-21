import { rangeContains } from '../../../../shared/calendar/dateRange'
import type { LedgerWindow } from '../../../../shared/calendar/ledgerWindow'
import { periodRange } from '../../../../shared/calendar/period'
import type { Period as AnyPeriod } from '../../../../shared/calendar/period'
import type { Money } from '../../../../shared/money/money'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import type { Bucket } from '../../workbook/domain/bucket'
import type { Transaction } from '../../workbook/domain/workbook'

/** The periods Company offers: every period but a single month, which no Company screen or address names. */
export type Period = Exclude<AnyPeriod, { readonly preset: 'month' }>

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
  /** Keeps the rows a part of which carries one of these labels. */
  readonly labels: readonly RecordId[]
  readonly text: string
  readonly amount: AmountRange
  /** Keeps only the rows that wait for a human, as the review queue lists them. */
  readonly needsReview: boolean
}

/**
 * A `categories` choice that selects every owner advance and no bank row, so one drill can name
 * the advances beside bank categories, as net owed does. Upper case, so no category slug, which is
 * lower case, can equal it.
 */
export const EVERY_OWNER_ADVANCE = 'OWNER-ADVANCES'

export const DEFAULT_FILTERS: FilterState = {
  period: { preset: 'l12' },
  accounts: [],
  buckets: [],
  families: [],
  categories: [],
  counterparties: [],
  labels: [],
  text: '',
  amount: { min: null, max: null },
  needsReview: false,
}

export function transactionsInPeriod<Row extends Pick<Transaction, 'date'>>(transactions: readonly Row[], period: Period, window: LedgerWindow): Row[] {
  const range = periodRange(period, window)
  return range === null ? [...transactions] : transactions.filter((transaction) => rangeContains(range, transaction.date))
}
