import { isCompleteMonth } from '../../../shared/calendar/ledgerWindow'
import type { LedgerWindow } from '../../../shared/calendar/ledgerWindow'
import { monthsFrom } from '../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../shared/calendar/monthKey'
import { ZERO, addMoney, divideMoney, sumMoney } from '../../../shared/money/money'
import type { Money } from '../../../shared/money/money'
import { drillToTransactions, monthPeriod } from '../../filters/domain/drillTarget'
import type { Figure } from '../../filters/domain/drillTarget'
import { EMPTY_PROFIT_AND_LOSS, LINE_BUCKETS, forEachLine, monthlyBucketTotals } from '../../workbook/domain/bucketTotals'
import type { ProfitAndLoss, ProfitAndLossLine } from '../../workbook/domain/bucketTotals'
import type { Transaction } from '../../workbook/domain/workbook'

/** The average month over a run of months ending with this one. */
export interface RollingAverage {
  readonly income: Money
  readonly cost: Money
  readonly net: Money
}

export interface MonthOfProfitAndLoss {
  readonly month: MonthKey
  /**
   * False for the newest month, which is still filling up, and for an opening month the ledger
   * starts partway through. Charts hatch these and no average counts them.
   */
  readonly complete: boolean
  readonly lines: Readonly<Record<ProfitAndLossLine, Figure>>
  /** Running total of net from the first month. */
  readonly cumulativeNet: Money
  /** Null unless this month and the two before it are all complete. */
  readonly rolling3: RollingAverage | null
  /** Null unless this month and the eleven before it are all complete. */
  readonly rolling12: RollingAverage | null
}

/** Every month from the ledger's first to its newest, ascending. A month with no rows reads as zero. */
export function monthlyProfitAndLoss(transactions: readonly Transaction[], window: LedgerWindow): MonthOfProfitAndLoss[] {
  const months = monthsFrom(window.firstMonth, window.partMonth)
  const totalsByMonth = monthlyBucketTotals(transactions, months)
  const series = months.map((month) => ({
    month,
    complete: isCompleteMonth(window, month),
    totals: totalsByMonth.get(month) ?? EMPTY_PROFIT_AND_LOSS,
  }))
  let cumulativeNet = ZERO
  return series.map((entry, position) => {
    cumulativeNet = addMoney(cumulativeNet, entry.totals.net)
    return {
      month: entry.month,
      complete: entry.complete,
      lines: linesOf(entry.month, entry.totals),
      cumulativeNet,
      rolling3: rollingAverage(series.slice(Math.max(0, position - 2), position + 1), 3),
      rolling12: rollingAverage(series.slice(Math.max(0, position - 11), position + 1), 12),
    }
  })
}

function rollingAverage(
  months: readonly { readonly complete: boolean; readonly totals: ProfitAndLoss }[],
  length: number,
): RollingAverage | null {
  if (months.length < length || months.some((month) => !month.complete)) {
    return null
  }
  const averageOf = (line: 'income' | 'cost' | 'net'): Money =>
    divideMoney(sumMoney(months.map((month) => month.totals[line])), length)
  return { income: averageOf('income'), cost: averageOf('cost'), net: averageOf('net') }
}

function linesOf(month: MonthKey, totals: ProfitAndLoss): Record<ProfitAndLossLine, Figure> {
  const period = monthPeriod(month)
  return forEachLine((line) => ({ amount: totals[line], drill: drillToTransactions({ period, buckets: LINE_BUCKETS[line] }) }))
}
