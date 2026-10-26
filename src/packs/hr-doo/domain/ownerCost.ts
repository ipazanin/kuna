import type { LedgerWindow } from '../../../shared/calendar/ledgerWindow'
import { addMoney, ratioOf } from '../../../shared/money/money'
import type { Money } from '../../../shared/money/money'
import { drillToTransactions } from '../../../features/filters/domain/drillTarget'
import type { Figure } from '../../../features/filters/domain/drillTarget'
import { transactionsInPeriod } from '../../../features/filters/domain/filterState'
import type { Period } from '../../../features/filters/domain/filterState'
import type { Booking, Category } from '../../../features/workbook/domain/workbook'
import { ownerTake } from './ownerTake'
import { paidOut } from './paidOut'
import { PACK_ROLES, categoriesInBucket, categoriesWithRole } from './packRoles'

export interface OwnerCost {
  /** The owner-pay bucket, loans included. */
  readonly take: Figure
  /** The taxes owed because the owner was paid: the categories with the `owner-pay-tax` role. */
  readonly taxOnPay: Figure
  /** Owner pay plus the tax on it. */
  readonly gross: Figure
  /** The take without loans plus the tax on the pay. A loan is neither pay nor a cost, so it stays out. */
  readonly grossWithoutLoans: Money
  /** The take without loans over its gross cost, such as 0.8. Null when that cost is zero. */
  readonly netShare: number | null
}

/**
 * What paying the owner cost the company over a period. Corporate income tax is left out unless a
 * workbook gives it the role, since the company owes it on profit whether the owner is paid or not.
 */
export function ownerCost(bookings: readonly Booking[], categories: readonly Category[], period: Period, window: LedgerWindow): OwnerCost {
  const { total: take, withoutLoans } = ownerTake(bookings, categories, period, window)
  const taxCategories = categoriesWithRole(categories, PACK_ROLES.ownerPayTax)
  const taxOnPay: Figure = {
    amount: paidOut(transactionsInPeriod(bookings, period, window).filter((booking) => taxCategories.includes(booking.category))),
    drill: drillToTransactions({ period, categories: taxCategories }),
  }
  const gross = addMoney(take.amount, taxOnPay.amount)
  const grossWithoutLoans = addMoney(withoutLoans.amount, taxOnPay.amount)
  return {
    take,
    taxOnPay,
    gross: { amount: gross, drill: drillToTransactions({ period, categories: [...categoriesInBucket(categories, 'owner-pay'), ...taxCategories] }) },
    grossWithoutLoans,
    netShare: ratioOf(withoutLoans.amount, grossWithoutLoans),
  }
}
