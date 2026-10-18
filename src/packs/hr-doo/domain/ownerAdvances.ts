import type { CivilDate } from '../../../shared/calendar/civilDate'
import { ZERO, addMoney, moneyFromCents, negateMoney, subtractMoney } from '../../../shared/money/money'
import type { Money } from '../../../shared/money/money'
import { drillToTransactions } from '../../../features/filters/domain/drillTarget'
import type { DrillTarget, Figure } from '../../../features/filters/domain/drillTarget'
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
  readonly advanced: Money
  /** Every payment to the owner on a reimbursement category, read positive, including any beyond the advances. */
  readonly reimbursed: Figure
  /** Advanced less reimbursed, signed. Positive means the company still owes the owner. */
  readonly outstanding: Money
  readonly openCount: number
}

/** One signed balance across both directions. Positive means the owner owes the company. */
export interface NetOwed {
  readonly amount: Money
  /** Lent to the owner less repaid. */
  readonly loanBalance: Money
  /** Advanced by the owner less reimbursed. */
  readonly advancesOutstanding: Money
  /** The loan and reimbursement rows behind it. The advances are on their own tab. */
  readonly drill: DrillTarget
}

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
    advanced,
    reimbursed: {
      amount: reimbursed,
      drill: drillToTransactions({ period: { preset: 'all' }, categories: reimbursement, amount: { min: null, max: moneyFromCents(-1) } }),
    },
    outstanding: subtractMoney(advanced, reimbursed),
    openCount: lines.filter((line) => line.status === 'open').length,
  }
}

/** What the owner owes the company on loans, less what the company owes the owner for advances. */
export function netOwed(loans: OwnerLoanBook, advances: OwnerAdvanceBook, categories: readonly Category[]): NetOwed {
  return {
    amount: subtractMoney(loans.outstanding.amount, advances.outstanding),
    loanBalance: loans.outstanding.amount,
    advancesOutstanding: advances.outstanding,
    drill: drillToTransactions({
      period: { preset: 'all' },
      categories: [
        ...categoriesWithRole(categories, PACK_ROLES.ownerLoanOut),
        ...categoriesWithRole(categories, PACK_ROLES.ownerLoanRepaid),
        ...categoriesWithRole(categories, PACK_ROLES.reimbursement),
      ],
    }),
  }
}

/** The one row, found again by its day, category and exact amount. */
function rowDrill(row: Transaction): DrillTarget {
  return drillToTransactions({
    period: { preset: 'custom', range: { from: row.date, to: row.date } },
    categories: [row.category],
    amount: { min: row.amount, max: row.amount },
  })
}
