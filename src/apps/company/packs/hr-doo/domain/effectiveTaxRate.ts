import type { LedgerWindow } from '../../../../../shared/calendar/ledgerWindow'
import { ZERO, addMoney, ratioOf } from '../../../../../shared/money/money'
import { drillToTransactions } from '../../../filters/domain/drillTarget'
import type { Figure } from '../../../filters/domain/drillTarget'
import { transactionsInPeriod } from '../../../filters/domain/filterState'
import type { Period } from '../../../filters/domain/filterState'
import type { Booking, Category } from '../../../workbook/domain/workbook'
import { PACK_ROLES, categoriesWithRole } from './packRoles'
import { paidOut } from './paidOut'

export interface EffectiveTaxRate {
  /** The taxes bucket, paid less refunded, read positive. */
  readonly netTaxes: Figure
  /** The categories with the `revenue` role, signed as booked. */
  readonly revenue: Figure
  /** Net taxes over revenue. Null when no revenue came in. */
  readonly rate: number | null
}

/**
 * The one tax rate: net taxes over client revenue. Other income, a grant or a refund, is left
 * out of the base, and a refund lowers the taxes because it sits in the taxes bucket.
 */
export function effectiveTaxRate(bookings: readonly Booking[], categories: readonly Category[], period: Period, window: LedgerWindow): EffectiveTaxRate {
  const rows = transactionsInPeriod(bookings, period, window)
  const revenueCategories = categoriesWithRole(categories, PACK_ROLES.revenue)
  const netTaxes = paidOut(rows.filter((booking) => booking.bucket === 'taxes'))
  const revenue = rows
    .filter((booking) => revenueCategories.includes(booking.category))
    .reduce((total, booking) => addMoney(total, booking.amount), ZERO)
  return {
    netTaxes: { amount: netTaxes, drill: drillToTransactions({ period, buckets: ['taxes'] }) },
    revenue: { amount: revenue, drill: drillToTransactions({ period, categories: revenueCategories }) },
    rate: revenue > 0 ? ratioOf(netTaxes, revenue) : null,
  }
}
