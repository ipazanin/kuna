import { dayOfMonth } from './civilDate'
import type { CivilDate } from './civilDate'
import { monthRange } from './dateRange'
import type { DateRange } from './dateRange'
import { addMonths, monthCountBetween, monthOf } from './monthKey'
import type { MonthKey } from './monthKey'

/**
 * Where the complete months of a ledger begin and end. It is anchored on the newest transaction,
 * never on the clock, so a statement that arrives late does not empty the figures. The newest
 * transaction's month is always treated as still filling up.
 */
export interface LedgerWindow {
  /** The month of the earliest transaction, which may be a part-month. */
  readonly firstMonth: MonthKey
  /** The first month the ledger covers from its first day. */
  readonly firstCompleteMonth: MonthKey
  /** The month before the newest transaction's month. Every rolling window ends here. */
  readonly lastCompleteMonth: MonthKey
  /** The newest transaction's month. Drawn, but never counted in an average. */
  readonly partMonth: MonthKey
}

/** A run of whole months, with how many months an average over it divides by. */
export interface MonthSpan {
  readonly from: MonthKey
  readonly to: MonthKey
  readonly monthCount: number
}

export function anchorWindow(earliest: CivilDate, newest: CivilDate): LedgerWindow {
  const firstMonth = monthOf(earliest)
  const partMonth = monthOf(newest)
  return {
    firstMonth,
    firstCompleteMonth: dayOfMonth(earliest) === 1 ? firstMonth : addMonths(firstMonth, 1),
    lastCompleteMonth: addMonths(partMonth, -1),
    partMonth,
  }
}

/**
 * The `count` complete months ending with the last complete one. An average over it divides by
 * `count` even where the ledger is younger than that, so a month with no rows counts as zero.
 */
export function lastMonths(window: LedgerWindow, count: number): MonthSpan {
  return { from: addMonths(window.lastCompleteMonth, 1 - count), to: window.lastCompleteMonth, monthCount: count }
}

/** Every complete month, or null while the ledger has none yet. */
export function allTime(window: LedgerWindow): MonthSpan | null {
  const monthCount = monthCountBetween(window.firstCompleteMonth, window.lastCompleteMonth)
  return monthCount === 0 ? null : { from: window.firstCompleteMonth, to: window.lastCompleteMonth, monthCount }
}

export function isCompleteMonth(window: LedgerWindow, month: MonthKey): boolean {
  return window.firstCompleteMonth <= month && month <= window.lastCompleteMonth
}

export function spanRange(span: MonthSpan): DateRange {
  return monthRange(span.from, span.to)
}

/** The days the ledger covers in full: from its first complete month to its last. */
export function completeRange(window: LedgerWindow): DateRange {
  return monthRange(window.firstCompleteMonth, window.lastCompleteMonth)
}
