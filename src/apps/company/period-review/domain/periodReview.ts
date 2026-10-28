import { addDays, daysBetween } from '../../../../shared/calendar/civilDate'
import { monthRange, monthsOfRange, rangeContains } from '../../../../shared/calendar/dateRange'
import type { DateRange } from '../../../../shared/calendar/dateRange'
import { completeRange, isCompleteMonth } from '../../../../shared/calendar/ledgerWindow'
import type { LedgerWindow } from '../../../../shared/calendar/ledgerWindow'
import { addMonths, firstDayOf, monthNumber, monthOf, yearOfMonth } from '../../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../../shared/calendar/monthKey'
import { subtractMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import { drillToTransactions, monthPeriod } from '../../filters/domain/drillTarget'
import type { Figure } from '../../filters/domain/drillTarget'
import { periodRange } from '../../filters/domain/filterState'
import { priorPeriod } from '../../filters/domain/periodComparison'
import type { CalendarPeriod } from '../../filters/domain/periodComparison'
import type { Period, Quarter } from '../../filters/domain/filterState'
import {
  EMPTY_PROFIT_AND_LOSS,
  LINE_BUCKETS,
  PROFIT_AND_LOSS_LINES,
  bucketTotals,
  monthlyBucketTotals,
} from '../../workbook/domain/bucketTotals'
import type { ProfitAndLoss, ProfitAndLossLine } from '../../workbook/domain/bucketTotals'
import type { Booking } from '../../workbook/domain/workbook'

export type ReviewPeriod = CalendarPeriod

export interface ReviewSide {
  readonly period: ReviewPeriod
  /**
   * The days compared. For the current period, its months the ledger covers in full. For the prior
   * one, the same stretch a period earlier, so a partial year is set against the same months.
   */
  readonly range: DateRange
  /** True when the ledger does not cover every day of the compared stretch in full months. */
  readonly partial: boolean
  /** The months of the compared stretch the ledger covers in full, or null when it covers none. */
  readonly coveredMonths: { readonly from: MonthKey; readonly to: MonthKey } | null
  readonly totals: ProfitAndLoss
}

export interface ReviewLine {
  readonly line: ProfitAndLossLine
  readonly current: Figure
  /** Null when the ledger holds nothing from the prior period. */
  readonly prior: Figure | null
  /** Current less prior. Null without a prior, and null when the prior period is partial. */
  readonly change: Money | null
}

export interface ReviewMonth {
  readonly month: MonthKey
  readonly complete: boolean
  readonly income: Figure
  readonly cost: Figure
  readonly net: Figure
}

export interface PeriodReview {
  /** True when only part of the period is compared, because the ledger lacks complete months of the rest. */
  readonly partOfPeriod: boolean
  readonly current: ReviewSide
  readonly prior: ReviewSide | null
  readonly lines: readonly ReviewLine[]
  readonly months: readonly ReviewMonth[]
}

/**
 * A year, quarter or custom range against the equal period just before it. Where the ledger covers
 * the period only in part, its complete months are compared with the same months a period earlier.
 */
export function periodReview(bookings: readonly Booking[], period: ReviewPeriod, window: LedgerWindow): PeriodReview {
  const whole = periodRange(period, window)
  const compared = coveredPart(whole, window) ?? whole
  const current = sideOf(bookings, period, compared, window)
  const priorRange = earlier(compared, period)
  const prior = priorRange.to < firstDayOf(window.firstMonth) ? null : sideOf(bookings, priorPeriod(period), priorRange, window)
  const showsChange = prior !== null && !prior.partial
  const lineFigure = (side: ReviewSide, line: ProfitAndLossLine): Figure => ({
    amount: side.totals[line],
    drill: drillToTransactions({ period: drillPeriodOf(side, window), buckets: LINE_BUCKETS[line] }),
  })
  const inRange = bookings.filter((booking) => rangeContains(whole, booking.date))
  const months = monthsOfRange(whole)
  const totalsByMonth = monthlyBucketTotals(inRange, months)
  return {
    partOfPeriod: compared.from !== whole.from || compared.to !== whole.to,
    current,
    prior,
    lines: PROFIT_AND_LOSS_LINES.map((line) => ({
      line,
      current: lineFigure(current, line),
      prior: prior === null ? null : lineFigure(prior, line),
      change: showsChange ? subtractMoney(current.totals[line], prior.totals[line]) : null,
    })),
    months: months.map((month): ReviewMonth => {
      const totals = totalsByMonth.get(month) ?? EMPTY_PROFIT_AND_LOSS
      const monthFigure = (line: 'income' | 'cost' | 'net'): Figure => ({
        amount: totals[line],
        drill: drillToTransactions({ period: monthPeriod(month), buckets: LINE_BUCKETS[line] }),
      })
      return {
        month,
        complete: isCompleteMonth(window, month),
        income: monthFigure('income'),
        cost: monthFigure('cost'),
        net: monthFigure('net'),
      }
    }),
  }
}

/**
 * The period a review compares. A rolling window or all time has no equal period before it in
 * calendar terms, so the review opens on the last complete quarter.
 */
export function reviewPeriodOf(period: Period, window: LedgerWindow): ReviewPeriod {
  switch (period.preset) {
    case 'year':
    case 'quarter':
    case 'custom':
      return period
    default:
      return lastCompleteQuarter(window)
  }
}

/** The newest quarter whose three months are all complete. */
export function lastCompleteQuarter(window: LedgerWindow): ReviewPeriod {
  const last = window.lastCompleteMonth
  const endOfQuarter = monthNumber(last) % 3 === 0 ? last : addMonths(last, -(monthNumber(last) % 3))
  return { preset: 'quarter', year: yearOfMonth(endOfQuarter), quarter: Math.ceil(monthNumber(endOfQuarter) / 3) as Quarter }
}

function sideOf(bookings: readonly Booking[], period: ReviewPeriod, range: DateRange, window: LedgerWindow): ReviewSide {
  const covered = coveredPart(range, window)
  return {
    period,
    range,
    partial: covered === null || covered.from !== range.from || covered.to !== range.to,
    coveredMonths: covered === null ? null : { from: monthOf(covered.from), to: monthOf(covered.to) },
    totals: bucketTotals(bookings.filter((booking) => rangeContains(range, booking.date))),
  }
}

/** The part of a range the ledger covers in full months, or null when there is none. */
function coveredPart(range: DateRange, window: LedgerWindow): DateRange | null {
  const covered = completeRange(window)
  const from = range.from > covered.from ? range.from : covered.from
  const to = range.to < covered.to ? range.to : covered.to
  return from > to ? null : { from, to }
}

/** The same stretch one period earlier: a year, a quarter, or as many days as a custom range holds. */
function earlier(range: DateRange, period: ReviewPeriod): DateRange {
  if (period.preset === 'custom') {
    const length = daysBetween(period.range.from, period.range.to) + 1
    return { from: addDays(range.from, -length), to: addDays(range.to, -length) }
  }
  const months = period.preset === 'year' ? 12 : 3
  return monthRange(addMonths(monthOf(range.from), -months), addMonths(monthOf(range.to), -months))
}

/** A side's rows: its own period when compared whole, else the stretch it was compared over. */
function drillPeriodOf(side: ReviewSide, window: LedgerWindow): Period {
  const whole = periodRange(side.period, window)
  return whole.from === side.range.from && whole.to === side.range.to ? side.period : { preset: 'custom', range: side.range }
}
