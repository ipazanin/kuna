import type { LedgerWindow } from '../../../shared/calendar/ledgerWindow'
import { addMoney, ratioOf } from '../../../shared/money/money'
import { drillToTransactions } from '../../../features/filters/domain/drillTarget'
import type { Figure } from '../../../features/filters/domain/drillTarget'
import { transactionsInPeriod } from '../../../features/filters/domain/filterState'
import type { Period } from '../../../features/filters/domain/filterState'
import type { Category, Transaction } from '../../../features/workbook/domain/workbook'
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
  /** Gross cost over owner pay, such as 1.25. Null when nothing was paid. */
  readonly costPerEuroReceived: number | null
}

/**
 * What paying the owner cost the company over a period. Corporate income tax is left out unless a
 * workbook gives it the role, since the company owes it on profit whether the owner is paid or not.
 */
export function ownerCost(transactions: readonly Transaction[], categories: readonly Category[], period: Period, window: LedgerWindow): OwnerCost {
  const take = ownerTake(transactions, categories, period, window).total
  const taxCategories = categoriesWithRole(categories, PACK_ROLES.ownerPayTax)
  const taxOnPay: Figure = {
    amount: paidOut(transactionsInPeriod(transactions, period, window).filter((transaction) => taxCategories.includes(transaction.category))),
    drill: drillToTransactions({ period, categories: taxCategories }),
  }
  const gross = addMoney(take.amount, taxOnPay.amount)
  return {
    take,
    taxOnPay,
    gross: { amount: gross, drill: drillToTransactions({ period, categories: [...categoriesInBucket(categories, 'owner-pay'), ...taxCategories] }) },
    costPerEuroReceived: ratioOf(gross, take.amount),
  }
}
