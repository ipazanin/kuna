import { isCompleteMonth } from '../../../../../shared/calendar/ledgerWindow'
import type { LedgerWindow } from '../../../../../shared/calendar/ledgerWindow'
import { monthOf } from '../../../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../../../shared/calendar/monthKey'
import { addMoney, divideMoney } from '../../../../../shared/money/money'
import type { Money } from '../../../../../shared/money/money'
import { drillToTransactions, monthPeriod } from '../../../filters/domain/drillTarget'
import type { Figure } from '../../../filters/domain/drillTarget'
import { transactionsInPeriod } from '../../../filters/domain/filterState'
import type { Period } from '../../../filters/domain/filterState'
import { chartedMonths } from '../../../filters/domain/periodPresets'
import type { Booking, Category } from '../../../workbook/domain/workbook'
import { paidOut } from './paidOut'
import { categoriesInBucket } from './packRoles'

export interface TaxTypeTotal {
  readonly category: string
  /** Paid over the period, net of refunds, read positive. */
  readonly total: Figure
}

export interface TaxMonth {
  readonly month: MonthKey
  readonly complete: boolean
  /** One figure per tax category, zero in a month it did not move. A refund reads negative. */
  readonly byCategory: Readonly<Record<string, Figure>>
  /** The whole taxes bucket, net of refunds. */
  readonly total: Figure
}

export interface TaxByType {
  /** The taxes-bucket categories that moved in the charted months, in the order the tab lists them. */
  readonly types: readonly TaxTypeTotal[]
  readonly months: readonly TaxMonth[]
}

/**
 * Every category of the taxes bucket over a period, and month by month over the months a chart of
 * that period draws. What counts as a tax is the bucket, so a refund booked in a taxes category
 * nets against the month it lands in.
 */
export function taxByType(bookings: readonly Booking[], categories: readonly Category[], period: Period, window: LedgerWindow): TaxByType {
  const taxCategories = categoriesInBucket(categories, 'taxes')
  const months = chartedMonths(period, window)
  const shown = new Set(months)
  const taxRows = bookings.filter((booking) => booking.bucket === 'taxes')
  const inPeriod = transactionsInPeriod(taxRows, period, window)
  const rows = taxRows.filter((booking) => shown.has(monthOf(booking.date)))
  const moved = taxCategories.filter((category) => rows.some((booking) => booking.category === category))
  const taxMonths = months.map((month): TaxMonth => {
    const own = rows.filter((booking) => monthOf(booking.date) === month)
    return {
      month,
      complete: isCompleteMonth(window, month),
      byCategory: Object.fromEntries(
        moved.map((category) => [
          category,
          {
            amount: paidOut(own.filter((booking) => booking.category === category)),
            drill: drillToTransactions({ period: monthPeriod(month), categories: [category] }),
          },
        ]),
      ),
      total: { amount: paidOut(own), drill: drillToTransactions({ period: monthPeriod(month), buckets: ['taxes'] }) },
    }
  })
  return {
    types: moved.map((category) => ({
      category,
      total: {
        amount: paidOut(inPeriod.filter((booking) => booking.category === category)),
        drill: drillToTransactions({ period, categories: [category] }),
      },
    })),
    months: taxMonths,
  }
}

/**
 * The median of the months that saw a payment. A month with none is the gap a cadence reports,
 * not an observation of what a month costs, and a bill paid in several parts counts as its total.
 */
export function typicalMonthlyAmount(monthlyTotals: readonly Money[]): Money | null {
  const paid = monthlyTotals.filter((amount) => amount !== 0).sort((smaller, larger) => smaller - larger)
  if (paid.length === 0) {
    return null
  }
  const middle = Math.floor(paid.length / 2)
  return paid.length % 2 === 1 ? paid[middle]! : divideMoney(addMoney(paid[middle - 1]!, paid[middle]!), 2)
}

