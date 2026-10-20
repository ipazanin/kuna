import type { CivilDate } from '../../../shared/calendar/civilDate'
import { ZERO, addMoney, moneyFromCents, subtractMoney } from '../../../shared/money/money'
import type { Money } from '../../../shared/money/money'
import { settlePayments } from '../../../shared/money/settleOpenRows'
import { advanceDrill, drillToTransactions, rowDrill } from '../../../features/filters/domain/drillTarget'
import type { DrillTarget, Figure } from '../../../features/filters/domain/drillTarget'
import { EVERY_OWNER_ADVANCE } from '../../../features/filters/domain/filterState'
import type { AmountRange } from '../../../features/filters/domain/filterState'
import { advanceKindOf } from '../../../features/workbook/domain/workbook'
import type { Category, OwnerAdvance, Transaction } from '../../../features/workbook/domain/workbook'
import type { OwnerLoanBook } from './ownerLoans'
import { PACK_ROLES, categoriesWithRole } from './packRoles'
import { netReimbursements } from './reimbursements'

/** The part of one reimbursement that went towards one advance. */
export interface AdvanceRepaymentShare {
  readonly repaidOn: CivilDate
  readonly applied: Money
  /** The reimbursement row, whose amount may be larger when it also settled a neighbouring advance. */
  readonly drill: DrillTarget
}

export interface OwnerAdvanceLine {
  readonly advance: OwnerAdvance
  /** The advance itself on Transactions, found by its day and its exact cost. */
  readonly drill: DrillTarget
  readonly remaining: Money
  readonly status: 'repaid' | 'open'
  /** The reimbursement that settled it. Null while it is open. */
  readonly repaidOn: CivilDate | null
  readonly repayments: readonly AdvanceRepaymentShare[]
}

/** A payment to the owner on a reimbursement category that no cost on the owner-advances tab accounts for, in part or in full. */
export interface UnaccountedReimbursement {
  readonly payment: Transaction
  /** What no cost accounts for, read positive. The payment itself may be larger when it also repaid a cost. */
  readonly amount: Money
  readonly drill: DrillTarget
}

export interface OwnerAdvanceBook {
  /** The costs the owner paid, oldest first. */
  readonly advances: readonly OwnerAdvanceLine[]
  /** Oldest first. Net owed counts them as paid to the owner until their costs are on the tab. */
  readonly unaccounted: readonly UnaccountedReimbursement[]
  /** Every cost the owner paid privately. */
  readonly advanced: Figure
  /**
   * Every payment to the owner on a reimbursement category, read positive, less what it returned of
   * a payment from the owner the same day, including any beyond the advances.
   */
  readonly reimbursed: Figure
  /** Advanced less reimbursed, signed. Positive means the company still owes the owner. */
  readonly outstanding: Figure
  readonly openCount: number
  /** What the unaccounted payments add up to, read positive. */
  readonly unaccountedTotal: Money
}

/** One signed balance across both directions. Positive means the owner owes the company. */
export interface NetOwed {
  readonly amount: Money
  /** What the loan book holds: lent, private shares and private costs included, less what the owner repaid. */
  readonly loanBalance: Money
  /** Paid by the owner less reimbursed. */
  readonly advancesOutstanding: Money
  /** The loan and reimbursement rows and every advance. */
  readonly drill: DrillTarget
}

const DEBITS: AmountRange = { min: null, max: moneyFromCents(-1) }

/**
 * The costs the owner paid matched to the reimbursements paid to the owner. Each reimbursement,
 * less what it returned of a payment from the owner the same day, settles the fewest costs paid by
 * its day that it equals exactly. The reimbursements no set of costs equals then go to the oldest
 * open costs first with no date cap. What no cost takes is listed as unaccounted. The private
 * shares belong to the loan book. The balance comes from the rows themselves, so it states a
 * reimbursement no advance accounts for.
 */
export function ownerAdvances(advances: readonly OwnerAdvance[], transactions: readonly Transaction[], categories: readonly Category[]): OwnerAdvanceBook {
  const reimbursement = categoriesWithRole(categories, PACK_ROLES.reimbursement)
  const repayments = netReimbursements(transactions, categories).toOwner
  const paidByOwner = advances
    .filter((advance) => advanceKindOf(advance) === 'paid-by-owner')
    .sort((earlier, later) => earlier.date.localeCompare(later.date) || earlier.sheetRow - later.sheetRow)

  const placed = settlePayments(
    paidByOwner.map((advance) => advance.amount),
    repayments.map((repayment) => repayment.amount),
    (payment, row) => paidByOwner[row]!.date <= repayments[payment]!.payment.date,
  )
  const open = paidByOwner.map((advance) => advance.amount)
  const shares: AdvanceRepaymentShare[][] = paidByOwner.map(() => [])
  const unaccounted: UnaccountedReimbursement[] = []
  placed.forEach((placedShares, payment) => {
    const repayment = repayments[payment]!
    for (const { index, applied } of placedShares) {
      open[index] = subtractMoney(open[index]!, applied)
      shares[index]!.push({ repaidOn: repayment.payment.date, applied, drill: rowDrill(repayment.payment) })
    }
    const left = placedShares.reduce((rest, share) => subtractMoney(rest, share.applied), repayment.amount)
    if (left > 0) {
      unaccounted.push({ payment: repayment.payment, amount: left, drill: rowDrill(repayment.payment) })
    }
  })
  const lines = paidByOwner.map((advance, index): OwnerAdvanceLine => {
    const remaining = open[index]!
    const repaymentShares = shares[index]!
    return {
      advance,
      drill: advanceDrill(advance),
      remaining,
      status: remaining === 0 ? 'repaid' : 'open',
      repaidOn: remaining === 0 ? (repaymentShares[repaymentShares.length - 1]?.repaidOn ?? null) : null,
      repayments: repaymentShares,
    }
  })

  const advanced = paidByOwner.reduce((total, advance) => addMoney(total, advance.amount), ZERO)
  const reimbursed = repayments.reduce((total, repayment) => addMoney(total, repayment.amount), ZERO)
  // Transactions lists a cost the owner paid as a debit and a private share as a credit, so the debit bound leaves out the shares and the reimbursements from the owner.
  return {
    advances: lines,
    advanced: { amount: advanced, drill: drillToTransactions({ period: { preset: 'all' }, categories: [EVERY_OWNER_ADVANCE], amount: DEBITS }) },
    reimbursed: { amount: reimbursed, drill: drillToTransactions({ period: { preset: 'all' }, categories: reimbursement, amount: DEBITS }) },
    outstanding: {
      amount: subtractMoney(advanced, reimbursed),
      drill: drillToTransactions({ period: { preset: 'all' }, categories: [...reimbursement, EVERY_OWNER_ADVANCE], amount: DEBITS }),
    },
    openCount: lines.filter((line) => line.status === 'open').length,
    unaccounted,
    unaccountedTotal: unaccounted.reduce((total, line) => addMoney(total, line.amount), ZERO),
  }
}

/** What the owner owes the company on the loan book, less what the company owes the owner for the costs the owner paid. */
export function netOwed(loans: OwnerLoanBook, advances: OwnerAdvanceBook, categories: readonly Category[]): NetOwed {
  return {
    amount: subtractMoney(loans.outstanding.amount, advances.outstanding.amount),
    loanBalance: loans.outstanding.amount,
    advancesOutstanding: advances.outstanding.amount,
    drill: drillToTransactions({
      period: { preset: 'all' },
      categories: [
        ...categoriesWithRole(categories, PACK_ROLES.ownerLoanOut),
        ...categoriesWithRole(categories, PACK_ROLES.ownerLoanRepaid),
        ...categoriesWithRole(categories, PACK_ROLES.reimbursement),
        EVERY_OWNER_ADVANCE,
      ],
    }),
  }
}
