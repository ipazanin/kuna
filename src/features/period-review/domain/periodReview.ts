import { monthsOfRange, rangeContains } from '../../../shared/calendar/dateRange'
import type { DateRange } from '../../../shared/calendar/dateRange'
import { completeRange, isCompleteMonth } from '../../../shared/calendar/ledgerWindow'
import type { LedgerWindow } from '../../../shared/calendar/ledgerWindow'
import { firstDayOf, yearOfMonth } from '../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../shared/calendar/monthKey'
import { subtractMoney } from '../../../shared/money/money'
import type { Money } from '../../../shared/money/money'
import { drillToTransactions, monthPeriod } from '../../filters/domain/drillTarget'
import type { Figure } from '../../filters/domain/drillTarget'
import { periodRange } from '../../filters/domain/filterState'
import { priorPeriod } from '../../filters/domain/periodComparison'
import type { CalendarPeriod } from '../../filters/domain/periodComparison'
import type { Period } from '../../filters/domain/filterState'
import {
  EMPTY_PROFIT_AND_LOSS,
  LINE_BUCKETS,
  PROFIT_AND_LOSS_LINES,
  bucketTotals,
  monthlyBucketTotals,
} from '../../workbook/domain/bucketTotals'
import type { ProfitAndLoss, ProfitAndLossLine } from '../../workbook/domain/bucketTotals'
import type { Transaction } from '../../workbook/domain/workbook'

export type ReviewPeriod = CalendarPeriod

export interface ReviewSide {
  readonly period: ReviewPeriod
  readonly range: DateRange
  /** True when the ledger does not cover every day of the period in full months. */
  readonly partial: boolean
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
  readonly current: ReviewSide
  readonly prior: ReviewSide | null
  readonly lines: readonly ReviewLine[]
  readonly months: readonly ReviewMonth[]
}

/** A year, quarter or custom range against the equal period just before it. */
export function periodReview(transactions: readonly Transaction[], period: ReviewPeriod, window: LedgerWindow): PeriodReview {
  const current = sideOf(transactions, period, window)
  const before = priorPeriod(period)
  const prior = periodRange(before, window).to < firstDayOf(window.firstMonth) ? null : sideOf(transactions, before, window)
  const showsChange = prior !== null && !prior.partial
  const lineFigure = (side: ReviewSide, line: ProfitAndLossLine): Figure => ({
    amount: side.totals[line],
    drill: drillToTransactions({ period: side.period, buckets: LINE_BUCKETS[line] }),
  })
  const inRange = transactions.filter((transaction) => rangeContains(current.range, transaction.date))
  const months = monthsOfRange(current.range)
  const totalsByMonth = monthlyBucketTotals(inRange, months)
  return {
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
 * calendar terms, so the review falls back to the year of the last complete month.
 */
export function reviewPeriodOf(period: Period, window: LedgerWindow): ReviewPeriod {
  switch (period.preset) {
    case 'year':
    case 'quarter':
    case 'custom':
      return period
    default:
      return { preset: 'year', year: yearOfMonth(window.lastCompleteMonth) }
  }
}

function sideOf(transactions: readonly Transaction[], period: ReviewPeriod, window: LedgerWindow): ReviewSide {
  const range = periodRange(period, window)
  const covered = completeRange(window)
  return {
    period,
    range,
    partial: range.from < covered.from || range.to > covered.to,
    totals: bucketTotals(transactions.filter((transaction) => rangeContains(range, transaction.date))),
  }
}
