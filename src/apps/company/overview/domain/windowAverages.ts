import { allTime, lastMonths, spanRange } from '../../../../shared/calendar/ledgerWindow'
import type { LedgerWindow, MonthSpan } from '../../../../shared/calendar/ledgerWindow'
import { rangeContains } from '../../../../shared/calendar/dateRange'
import type { Money } from '../../../../shared/money/money'
import { drillToTransactions } from '../../filters/domain/drillTarget'
import type { DrillTarget } from '../../filters/domain/drillTarget'
import type { Period } from '../../filters/domain/filterState'
import { LINE_BUCKETS, averagePerMonth, bucketTotals, forEachLine } from '../../workbook/domain/bucketTotals'
import type { ProfitAndLossLine } from '../../workbook/domain/bucketTotals'
import type { Booking } from '../../workbook/domain/workbook'

/** One line of the profit and loss over a window: its total, its average month, and its rows. */
export interface WindowFigure {
  readonly total: Money
  readonly perMonth: Money
  readonly drill: DrillTarget
}

export interface WindowColumn {
  readonly span: MonthSpan
  readonly lines: Readonly<Record<ProfitAndLossLine, WindowFigure>>
}

/** What a typical month looks like over three windows. Read the gap between them. */
export interface WindowAverages {
  readonly last3: WindowColumn
  readonly last12: WindowColumn
  /** Null until the ledger holds one complete month. */
  readonly allTime: WindowColumn | null
}

/**
 * Per-month averages of every profit and loss line. Each window ends with the last complete month
 * and divides by its month count, so a month with no rows counts as zero. All time starts at the
 * ledger's first complete month, so an opening part-month never counts as a whole one. A figure
 * opens the months it averages as a custom period, since a rolling preset reaches into the part month.
 */
export function windowAverages(bookings: readonly Booking[], window: LedgerWindow): WindowAverages {
  const everyCompleteMonth = allTime(window)
  return {
    last3: windowColumn(bookings, lastMonths(window, 3)),
    last12: windowColumn(bookings, lastMonths(window, 12)),
    allTime: everyCompleteMonth === null ? null : windowColumn(bookings, everyCompleteMonth),
  }
}

function windowColumn(bookings: readonly Booking[], span: MonthSpan): WindowColumn {
  const range = spanRange(span)
  const period: Period = { preset: 'custom', range }
  const totals = bucketTotals(bookings.filter((booking) => rangeContains(range, booking.date)))
  const perMonth = averagePerMonth(totals, span.monthCount)
  return {
    span,
    lines: forEachLine((line) => ({
      total: totals[line],
      perMonth: perMonth[line],
      drill: drillToTransactions({ period, buckets: LINE_BUCKETS[line] }),
    })),
  }
}

/**
 * How far a recent monthly figure sits from a longer one, as a fraction of the longer one's size.
 * Null when the longer one is zero, where no fraction means anything.
 */
export function recentChange(recent: Money, longer: Money): number | null {
  return longer === 0 ? null : (recent - longer) / Math.abs(longer)
}
