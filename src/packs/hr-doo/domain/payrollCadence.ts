import { monthRange } from '../../../shared/calendar/dateRange'
import { isCompleteMonth } from '../../../shared/calendar/ledgerWindow'
import type { LedgerWindow } from '../../../shared/calendar/ledgerWindow'
import { addMonths, monthCountBetween, monthOf, monthsFrom } from '../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../shared/calendar/monthKey'
import type { Money } from '../../../shared/money/money'
import { drillToTransactions, monthPeriod } from '../../../features/filters/domain/drillTarget'
import type { Figure } from '../../../features/filters/domain/drillTarget'
import type { Booking, Category } from '../../../features/workbook/domain/workbook'
import { PACK_ROLES, categoriesWithRole } from './packRoles'
import { paidOut } from './paidOut'
import { typicalMonthlyAmount } from './taxByType'

/** A month of a recurring obligation: paid, missed, or the month still running without a payment yet. */
export type CadenceState = 'paid' | 'missing' | 'not-yet-due'

export interface CadenceMonth {
  readonly month: MonthKey
  readonly state: CadenceState
  /** What the month's rows came to. A missed month drills to the months on either side of it. */
  readonly amount: Figure
}

export interface PayrollCadence {
  readonly category: string
  /** From the first month with a payment to the month still running. */
  readonly months: readonly CadenceMonth[]
  /** The counts cover the months up to the last complete one. The month still running is not due yet. */
  readonly monthsPaid: number
  readonly monthsElapsed: number
  readonly monthsMissed: number
  /** The median of the complete months with a payment. */
  readonly typicalMonth: Money | null
}

/**
 * Whether a recurring tax landed every month, for each category with the `watched` role in the
 * taxes bucket, such as payroll contributions. A month counts as paid when the category has any
 * row in it, since contributions leave as several payments to different institutions. A tax the
 * owner paid privately counts too, so pass the bookings with the advances.
 */
export function payrollCadence(transactions: readonly Booking[], categories: readonly Category[], window: LedgerWindow): PayrollCadence[] {
  const watched = categoriesWithRole(categories, PACK_ROLES.watched).filter(
    (slug) => categories.find((category) => category.slug === slug)?.bucket === 'taxes',
  )
  return watched.flatMap((category) => {
    const rows = transactions.filter((transaction) => transaction.category === category)
    if (rows.length === 0) {
      return []
    }
    const firstPaid = rows.reduce((earliest, transaction) => (monthOf(transaction.date) < earliest ? monthOf(transaction.date) : earliest), window.partMonth)
    const months = monthsFrom(firstPaid, window.partMonth).map((month): CadenceMonth & { readonly complete: boolean } => {
      const own = rows.filter((transaction) => monthOf(transaction.date) === month)
      const state: CadenceState = own.length > 0 ? 'paid' : month === window.partMonth ? 'not-yet-due' : 'missing'
      const period = state === 'missing' ? { preset: 'custom' as const, range: monthRange(addMonths(month, -1), addMonths(month, 1)) } : monthPeriod(month)
      return {
        month,
        state,
        amount: { amount: paidOut(own), drill: drillToTransactions({ period, categories: [category] }) },
        complete: isCompleteMonth(window, month),
      }
    })
    const due = months.filter((month) => month.month <= window.lastCompleteMonth)
    const monthsPaid = due.filter((month) => month.state === 'paid').length
    const monthsElapsed = monthCountBetween(firstPaid, window.lastCompleteMonth)
    return [
      {
        category,
        months: months.map(({ month, state, amount }) => ({ month, state, amount })),
        monthsPaid,
        monthsElapsed,
        monthsMissed: monthsElapsed - monthsPaid,
        typicalMonth: typicalMonthlyAmount(months.filter((month) => month.complete).map((month) => month.amount.amount)),
      },
    ]
  })
}
