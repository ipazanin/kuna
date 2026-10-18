import { isCompleteMonth } from '../../../shared/calendar/ledgerWindow'
import type { LedgerWindow } from '../../../shared/calendar/ledgerWindow'
import { monthOf } from '../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../shared/calendar/monthKey'
import { drillToTransactions, monthPeriod } from '../../../features/filters/domain/drillTarget'
import type { Figure } from '../../../features/filters/domain/drillTarget'
import { transactionsInPeriod } from '../../../features/filters/domain/filterState'
import type { Period } from '../../../features/filters/domain/filterState'
import type { Booking, Category } from '../../../features/workbook/domain/workbook'
import { PACK_ROLES, categoriesInBucket, categoriesWithRole } from './packRoles'
import { paidOut } from './paidOut'

/** One category's money between the company and the owner. Paid to the owner reads positive. */
export interface OwnerTakeLine {
  readonly category: string
  readonly amount: Figure
}

export interface OwnerTake {
  /** The owner-pay bucket, loans and their repayments included. */
  readonly total: Figure
  /** Each owner-pay category that moved, in the order the tab lists them. A repayment reads negative. */
  readonly byCategory: readonly OwnerTakeLine[]
  /** Reimbursements either way. They settle a cost counted under its own category, so they are not owner pay. */
  readonly reimbursements: readonly OwnerTakeLine[]
}

export interface OwnerTakeMonth {
  readonly month: MonthKey
  readonly complete: boolean
  /** One figure per owner-pay category, zero in a month it did not move. */
  readonly byCategory: Readonly<Record<string, Figure>>
  readonly total: Figure
}

/** What the owner took out over a period, in total and by category. */
export function ownerTake(bookings: readonly Booking[], categories: readonly Category[], period: Period, window: LedgerWindow): OwnerTake {
  const rows = transactionsInPeriod(bookings, period, window)
  const pay = categoriesInBucket(categories, 'owner-pay')
  const reimbursements = categoriesWithRole(categories, PACK_ROLES.reimbursement).filter((category) => !pay.includes(category))
  const linesOf = (slugs: readonly string[]): OwnerTakeLine[] =>
    slugs.flatMap((category) => {
      const own = rows.filter((booking) => booking.category === category)
      return own.length === 0 ? [] : [{ category, amount: { amount: paidOut(own), drill: drillToTransactions({ period, categories: [category] }) } }]
    })
  return {
    total: { amount: paidOut(rows.filter((booking) => pay.includes(booking.category))), drill: drillToTransactions({ period, buckets: ['owner-pay'] }) },
    byCategory: linesOf(pay),
    reimbursements: linesOf(reimbursements),
  }
}

/** The owner-pay categories month by month, for a chart of draws. */
export function ownerTakeByMonth(
  bookings: readonly Booking[],
  categories: readonly Category[],
  months: readonly MonthKey[],
  window: LedgerWindow,
): OwnerTakeMonth[] {
  const pay = categoriesInBucket(categories, 'owner-pay')
  return months.map((month) => {
    const rows = bookings.filter((booking) => monthOf(booking.date) === month && pay.includes(booking.category))
    return {
      month,
      complete: isCompleteMonth(window, month),
      byCategory: Object.fromEntries(
        pay.map((category) => [
          category,
          {
            amount: paidOut(rows.filter((booking) => booking.category === category)),
            drill: drillToTransactions({ period: monthPeriod(month), categories: [category] }),
          },
        ]),
      ),
      total: { amount: paidOut(rows), drill: drillToTransactions({ period: monthPeriod(month), buckets: ['owner-pay'] }) },
    }
  })
}
