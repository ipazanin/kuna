import type { Category, Transaction } from '../../../features/workbook/domain/workbook'
import type { CivilDate } from '../../../shared/calendar/civilDate'
import { ZERO, addMoney, negateMoney, subtractMoney } from '../../../shared/money/money'
import type { Money } from '../../../shared/money/money'
import { PACK_ROLES, categoriesWithRole } from './packRoles'

/** A payment on a reimbursement category, with what is left of it once a payment the other way on its day is taken off, read positive. */
export interface NetReimbursement {
  readonly payment: Transaction
  readonly amount: Money
}

export interface NetReimbursements {
  /** Payments to the owner, oldest first. They repay the costs the owner paid. */
  readonly toOwner: readonly NetReimbursement[]
  /** Payments from the owner, oldest first. They repay what the owner owes the company. */
  readonly fromOwner: readonly NetReimbursement[]
}

/**
 * The payments on a reimbursement category in both directions, each less what a payment the other
 * way on the same day returned, as when the owner paid a private share back twice and the company
 * sent the extra back. A payment that only returned another one drops out.
 */
export function netReimbursements(transactions: readonly Transaction[], categories: readonly Category[]): NetReimbursements {
  const reimbursement = categoriesWithRole(categories, PACK_ROLES.reimbursement)
  const rows = transactions
    .filter((transaction) => reimbursement.includes(transaction.category))
    .sort((earlier, later) => earlier.date.localeCompare(later.date) || earlier.sequence - later.sequence)
  const toOwner = rows.filter((row) => row.amount < 0)
  const fromOwner = rows.filter((row) => row.amount > 0)
  return { toOwner: lessReturns(toOwner, fromOwner), fromOwner: lessReturns(fromOwner, toOwner) }
}

function lessReturns(payments: readonly Transaction[], otherWay: readonly Transaction[]): NetReimbursement[] {
  const otherWayByDay = new Map<CivilDate, Money>()
  for (const row of otherWay) {
    otherWayByDay.set(row.date, addMoney(otherWayByDay.get(row.date) ?? ZERO, positive(row.amount)))
  }
  return payments.flatMap((payment) => {
    const paid = positive(payment.amount)
    const otherWayLeft = otherWayByDay.get(payment.date) ?? ZERO
    const returned = (paid < otherWayLeft ? paid : otherWayLeft) as Money
    otherWayByDay.set(payment.date, subtractMoney(otherWayLeft, returned))
    const amount = subtractMoney(paid, returned)
    return amount === 0 ? [] : [{ payment, amount }]
  })
}

function positive(amount: Money): Money {
  return amount < 0 ? negateMoney(amount) : amount
}
