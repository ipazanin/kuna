import { addMonths, monthOf } from '../../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../../shared/calendar/monthKey'
import type { Settings } from '../../../../features/settings/domain/settings'
import type { Booking, Category } from '../../../../features/workbook/domain/workbook'
import { PACK_ROLES, categoriesWithRole } from '../packRoles'

/**
 * The month a cost belongs to under accrual accounting. A row in an `arrears` category is paid in
 * the month after the work or the rent, so a December salary paid in January belongs to December.
 * Every other row belongs to the month it was paid. Revenue rows are payments and say nothing about
 * delivery, so accrual revenue comes from `revenueByDelivery` instead.
 */
export function serviceMonthOf(booking: Booking, categories: readonly Category[], settings: Settings): MonthKey {
  const paidIn = monthOf(booking.date)
  if (!categoriesWithRole(categories, PACK_ROLES.arrears).includes(booking.category)) {
    return paidIn
  }
  const servedIn = addMonths(paidIn, -1)
  // A row paid in the month the company was registered has no earlier month to belong to.
  const registered = settings.companyFacts.companyRegistered
  return registered !== null && servedIn < monthOf(registered) ? paidIn : servedIn
}
