import type { CivilDate } from '../../../shared/calendar/civilDate'
import { ZERO, addMoney, moneyFromCents, negateMoney, subtractMoney } from '../../../shared/money/money'
import type { Money } from '../../../shared/money/money'
import { drillToTransactions } from '../../../features/filters/domain/drillTarget'
import type { DrillTarget, Figure } from '../../../features/filters/domain/drillTarget'
import { EVERY_OWNER_ADVANCE } from '../../../features/filters/domain/filterState'
import type { AmountRange } from '../../../features/filters/domain/filterState'
import type { Category, OwnerAdvance, Transaction } from '../../../features/workbook/domain/workbook'
import type { OwnerLoanBook } from './ownerLoans'
import { PACK_ROLES, categoriesWithRole } from './packRoles'

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

export interface OwnerAdvanceBook {
  /** Oldest first. */
  readonly advances: readonly OwnerAdvanceLine[]
  /** Every cost the owner paid privately. */
  readonly advanced: Figure
  /** Every payment to the owner on a reimbursement category, read positive, including any beyond the advances. */
  readonly reimbursed: Figure
  /** Advanced less reimbursed, signed. Positive means the company still owes the owner. */
  readonly outstanding: Figure
  readonly openCount: number
}

/**
 * One signed balance across both directions. Positive means the owner owes the company.
 *
 * Company to owner: lent less repaid on the loan categories, less what the owner paid back on a
 * reimbursement category for a private cost the company paid for them. Owner to company: the
 * advances not yet reimbursed.
 */
export interface NetOwed {
  readonly amount: Money
  /** Lent to the owner less repaid. */
  readonly loanBalance: Money
  /**
   * Every payment from the owner on a reimbursement category, read positive. The company's
   * payments it repays are counted as lent only when filed in a category with the owner-loan-out
   * role. Filed as a cost, they count in costs instead and not here.
   */
  readonly privateCostsRepaid: Figure
  /** Advanced by the owner less reimbursed. */
  readonly advancesOutstanding: Money
  /** The loan and reimbursement rows and every advance. */
  readonly drill: DrillTarget
}

const DEBITS: AmountRange = { min: null, max: moneyFromCents(-1) }
const CREDITS: AmountRange = { min: moneyFromCents(1), max: null }

/**
 * The owner's advances matched to the reimbursements paid to the owner, first in, first out, with
 * no date cap, as loans are matched to repayments. The balance comes from the rows themselves, so
 * it states a reimbursement no advance accounts for.
 */
export function ownerAdvances(advances: readonly OwnerAdvance[], transactions: readonly Transaction[], categories: readonly Category[]): OwnerAdvanceBook {
  const reimbursement = categoriesWithRole(categories, PACK_ROLES.reimbursement)
  const repaymentRows = [...transactions]
    .filter((transaction) => reimbursement.includes(transaction.category) && transaction.amount < 0)
    .sort((earlier, later) => earlier.date.localeCompare(later.date) || earlier.sequence - later.sequence)
  const ordered = [...advances].sort((earlier, later) => earlier.date.localeCompare(later.date) || earlier.sheetRow - later.sheetRow)

  let repaymentIndex = 0
  let leftInRepayment = repaymentRows[0] === undefined ? ZERO : negateMoney(repaymentRows[0].amount)
  const lines = ordered.map((advance): OwnerAdvanceLine => {
    let remaining = advance.amount
    const repayments: AdvanceRepaymentShare[] = []
    while (remaining > 0 && repaymentIndex < repaymentRows.length) {
      const repayment = repaymentRows[repaymentIndex]!
      const applied = Math.min(remaining, leftInRepayment) as Money
      repayments.push({ repaidOn: repayment.date, applied, drill: rowDrill(repayment) })
      remaining = subtractMoney(remaining, applied)
      leftInRepayment = subtractMoney(leftInRepayment, applied)
      if (leftInRepayment === 0) {
        repaymentIndex += 1
        const next = repaymentRows[repaymentIndex]
        leftInRepayment = next === undefined ? ZERO : negateMoney(next.amount)
      }
    }
    return {
      advance,
      drill: advanceDrill(advance),
      remaining,
      status: remaining === 0 ? 'repaid' : 'open',
      repaidOn: remaining === 0 ? (repayments[repayments.length - 1]?.repaidOn ?? null) : null,
      repayments,
    }
  })

  const advanced = ordered.reduce((total, advance) => addMoney(total, advance.amount), ZERO)
  const reimbursed = repaymentRows.reduce((total, row) => subtractMoney(total, row.amount), ZERO)
  return {
    advances: lines,
    advanced: { amount: advanced, drill: drillToTransactions({ period: { preset: 'all' }, categories: [EVERY_OWNER_ADVANCE] }) },
    reimbursed: { amount: reimbursed, drill: drillToTransactions({ period: { preset: 'all' }, categories: reimbursement, amount: DEBITS }) },
    // The debit bound leaves out the reimbursements from the owner. An advance reads as a debit, so it stays in.
    outstanding: {
      amount: subtractMoney(advanced, reimbursed),
      drill: drillToTransactions({ period: { preset: 'all' }, categories: [...reimbursement, EVERY_OWNER_ADVANCE], amount: DEBITS }),
    },
    openCount: lines.filter((line) => line.status === 'open').length,
  }
}

/**
 * What the owner owes the company on loans, less what the owner paid back for private costs the
 * company paid, less what the company owes the owner for advances.
 */
export function netOwed(loans: OwnerLoanBook, advances: OwnerAdvanceBook, transactions: readonly Transaction[], categories: readonly Category[]): NetOwed {
  const reimbursement = categoriesWithRole(categories, PACK_ROLES.reimbursement)
  const privateCostsRepaid = transactions
    .filter((transaction) => reimbursement.includes(transaction.category) && transaction.amount > 0)
    .reduce((total, transaction) => addMoney(total, transaction.amount), ZERO)
  return {
    amount: subtractMoney(subtractMoney(loans.outstanding.amount, privateCostsRepaid), advances.outstanding.amount),
    loanBalance: loans.outstanding.amount,
    privateCostsRepaid: {
      amount: privateCostsRepaid,
      drill: drillToTransactions({ period: { preset: 'all' }, categories: reimbursement, amount: CREDITS }),
    },
    advancesOutstanding: advances.outstanding.amount,
    drill: drillToTransactions({
      period: { preset: 'all' },
      categories: [
        ...categoriesWithRole(categories, PACK_ROLES.ownerLoanOut),
        ...categoriesWithRole(categories, PACK_ROLES.ownerLoanRepaid),
        ...reimbursement,
        EVERY_OWNER_ADVANCE,
      ],
    }),
  }
}

/** The one advance, found again by its day and its exact cost. */
function advanceDrill(advance: OwnerAdvance): DrillTarget {
  const cost = negateMoney(advance.amount)
  return drillToTransactions({
    period: { preset: 'custom', range: { from: advance.date, to: advance.date } },
    categories: [EVERY_OWNER_ADVANCE],
    amount: { min: cost, max: cost },
  })
}

/** The one row, found again by its day, category and exact amount. */
function rowDrill(row: Transaction): DrillTarget {
  return drillToTransactions({
    period: { preset: 'custom', range: { from: row.date, to: row.date } },
    categories: [row.category],
    amount: { min: row.amount, max: row.amount },
  })
}
