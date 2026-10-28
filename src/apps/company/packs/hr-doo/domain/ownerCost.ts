import type { LedgerWindow } from '../../../../../shared/calendar/ledgerWindow'
import { ratioOf, sumMoney } from '../../../../../shared/money/money'
import type { Money } from '../../../../../shared/money/money'
import { drillToTransactions } from '../../../filters/domain/drillTarget'
import type { Figure } from '../../../filters/domain/drillTarget'
import { transactionsInPeriod } from '../../../filters/domain/filterState'
import type { Period } from '../../../filters/domain/filterState'
import type { Booking, Category } from '../../../workbook/domain/workbook'
import { ownerTake } from './ownerTake'
import { paidOut } from './paidOut'
import { PACK_ROLES, categoriesInBucket, categoriesWithRole } from './packRoles'

export interface OwnerCost {
  /** What the owner keeps of the owner-pay bucket, loans included, the rent after its tax. */
  readonly take: Figure
  /** The taxes owed because the owner was paid: the categories with the `owner-pay-tax` role. */
  readonly taxOnPay: Figure
  /** The owner-pay bucket as paid plus the tax on it, which is the take plus the rent tax and the tax on the pay. */
  readonly gross: Figure
  /** The gross cost without loans. A loan is neither pay nor a cost, so it stays out. */
  readonly grossWithoutLoans: Money
  /** The take without loans over its gross cost, such as 0.8. Null when that cost is zero. */
  readonly netShare: number | null
}

/**
 * What paying the owner cost the company over a period. Corporate income tax is left out unless a
 * workbook gives it the role, since the company owes it on profit whether the owner is paid or not.
 */
export function ownerCost(bookings: readonly Booking[], categories: readonly Category[], period: Period, window: LedgerWindow): OwnerCost {
  const { total: take, withoutLoans, rentTax } = ownerTake(bookings, categories, period, window)
  const taxCategories = categoriesWithRole(categories, PACK_ROLES.ownerPayTax)
  const taxOnPay: Figure = {
    amount: paidOut(transactionsInPeriod(bookings, period, window).filter((booking) => taxCategories.includes(booking.category))),
    drill: drillToTransactions({ period, categories: taxCategories }),
  }
  const gross = sumMoney([take.amount, rentTax.amount, taxOnPay.amount])
  const grossWithoutLoans = sumMoney([withoutLoans.amount, rentTax.amount, taxOnPay.amount])
  return {
    take,
    taxOnPay,
    gross: { amount: gross, drill: drillToTransactions({ period, categories: [...categoriesInBucket(categories, 'owner-pay'), ...taxCategories] }) },
    grossWithoutLoans,
    netShare: ratioOf(withoutLoans.amount, grossWithoutLoans),
  }
}
