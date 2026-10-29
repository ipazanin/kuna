import type { CivilDate } from '../../../../../shared/calendar/civilDate'
import { isCompleteMonth } from '../../../../../shared/calendar/ledgerWindow'
import type { LedgerWindow } from '../../../../../shared/calendar/ledgerWindow'
import { firstDayOf, lastDayOf, monthOf } from '../../../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../../../shared/calendar/monthKey'
import { ZERO, addMoney, moneyFromCents, negateMoney, subtractMoney } from '../../../../../shared/money/money'
import type { Money } from '../../../../../shared/money/money'
import { settlePayments } from '../../../../../shared/money/settleOpenRows'
import { drillToTransactions, monthPeriod, rowDrill } from '../../../filters/domain/drillTarget'
import type { DrillTarget, Figure } from '../../../filters/domain/drillTarget'
import type { FilterState, Period } from '../../../filters/domain/filterState'
import type { Category, Transaction } from '../../../workbook/domain/workbook'
import { PACK_ROLES, categoriesWithRole } from './packRoles'
import { netReimbursements } from './reimbursements'

/** The part of one repayment that went towards one loan. */
export interface LoanRepaymentShare {
  readonly repaidOn: CivilDate
  readonly applied: Money
  /** The repayment row, whose amount may be larger when it also closed a neighbouring loan. */
  readonly drill: DrillTarget
}

export interface OwnerLoan {
  readonly lentOn: CivilDate
  /** What was lent. A credit booked on a loan-out category is listed with nothing lent, so it stays in view. */
  readonly amount: Money
  readonly remaining: Money
  readonly status: 'repaid' | 'open'
  /** The repayment that closed the loan. Null while it is open, and when nothing was lent on it. */
  readonly repaidOn: CivilDate | null
  readonly repayments: readonly LoanRepaymentShare[]
  /** The loan-out row, which is a part of a split row when what was lent is the owner's share of a company payment. */
  readonly row: Transaction
  readonly drill: DrillTarget
}

export interface OwnerLoanBook {
  /** Oldest first. */
  readonly loans: readonly OwnerLoan[]
  /** Every debit on a loan-out category, read positive. */
  readonly lent: Figure
  /**
   * Every credit on a loan-repaid category and every payment from the owner on a reimbursement
   * category less what the company returned the same day, including any beyond what was lent.
   */
  readonly repaid: Figure
  /** Lent less repaid, signed. Negative means more came back than the ledger shows lent. */
  readonly outstanding: Figure
  readonly openCount: number
  readonly oldestOpen: CivilDate | null
}

export interface LoanMonth {
  readonly month: MonthKey
  readonly complete: boolean
  readonly lent: Figure
  readonly repaid: Figure
  /** The balance at the month's end over every loan row since the ledger began, signed. */
  readonly outstanding: Figure
}

interface Lent {
  readonly lentOn: CivilDate
  readonly amount: Money
  readonly row: Transaction
}

interface Repayment {
  readonly payment: Transaction
  readonly amount: Money
}

/**
 * What the owner owes the company: loans on a loan-out category, and private costs the company paid
 * on one, a part of a split payment included. Each repayment, on a loan-repaid or a
 * reimbursement category, closes the fewest loans lent by its day that it equals exactly. The
 * repayments no set of loans equals then go to the oldest open loans first with no date cap,
 * running on into the next. Whatever is repaid past the last loan stays out of the list. The
 * headline figures come from the rows themselves, so the balance states an excess repayment that
 * the list cannot hand to any loan.
 */
export function ownerLoans(transactions: readonly Transaction[], categories: readonly Category[]): OwnerLoanBook {
  const lent = lentOf(transactions, categories)
  const repayments = repaymentsOf(transactions, categories)
  const placed = settlePayments(
    lent.map((entry) => entry.amount),
    repayments.map((repayment) => repayment.amount),
    (payment, row) => lent[row]!.lentOn <= repayments[payment]!.payment.date,
  )
  const open = lent.map((entry) => entry.amount)
  const shares: LoanRepaymentShare[][] = lent.map(() => [])
  placed.forEach((placedShares, payment) => {
    const repayment = repayments[payment]!.payment
    for (const { index, applied } of placedShares) {
      open[index] = subtractMoney(open[index]!, applied)
      shares[index]!.push({ repaidOn: repayment.date, applied, drill: rowDrill(repayment) })
    }
  })
  const loans = lent.map((entry, index): OwnerLoan => {
    const remaining = open[index]!
    const repaymentShares = shares[index]!
    const closed = remaining === 0
    return {
      lentOn: entry.lentOn,
      amount: entry.amount,
      remaining,
      status: closed ? 'repaid' : 'open',
      repaidOn: closed && entry.amount > 0 ? (repaymentShares[repaymentShares.length - 1]?.repaidOn ?? null) : null,
      repayments: repaymentShares,
      row: entry.row,
      drill: rowDrill(entry.row),
    }
  })

  const drills = loanBookFilters(categories)
  const lentTotal = sumOf(lent)
  const repaidTotal = sumOf(repayments)
  const openLoans = loans.filter((loan) => loan.status === 'open')
  const allTime: Period = { preset: 'all' }
  return {
    loans,
    lent: { amount: lentTotal, drill: drillToTransactions({ period: allTime, ...drills.lent }) },
    repaid: { amount: repaidTotal, drill: drillToTransactions({ period: allTime, ...drills.repaid }) },
    outstanding: { amount: subtractMoney(lentTotal, repaidTotal), drill: drillToTransactions({ period: allTime, ...drills.outstanding }) },
    openCount: openLoans.length,
    oldestOpen: openLoans[0]?.lentOn ?? null,
  }
}

/** Lent and repaid in each month asked for, with the balance at each month's end. */
export function loanMonths(transactions: readonly Transaction[], categories: readonly Category[], months: readonly MonthKey[], window: LedgerWindow): LoanMonth[] {
  const lent = lentOf(transactions, categories).filter((entry) => entry.amount > 0)
  const repayments = repaymentsOf(transactions, categories)
  const drills = loanBookFilters(categories)
  return months.map((month) => {
    const lentIn = sumOf(lent.filter((entry) => monthOf(entry.lentOn) === month))
    const repaidIn = sumOf(repayments.filter((repayment) => monthOf(repayment.payment.date) === month))
    const balance = subtractMoney(sumOf(lent.filter((entry) => monthOf(entry.lentOn) <= month)), sumOf(repayments.filter((repayment) => monthOf(repayment.payment.date) <= month)))
    return {
      month,
      complete: isCompleteMonth(window, month),
      lent: { amount: lentIn, drill: drillToTransactions({ period: monthPeriod(month), ...drills.lent }) },
      repaid: { amount: repaidIn, drill: drillToTransactions({ period: monthPeriod(month), ...drills.repaid }) },
      outstanding: {
        amount: balance,
        drill: drillToTransactions({ period: { preset: 'custom', range: { from: firstDayOf(window.firstMonth), to: lastDayOf(month) } }, ...drills.outstanding }),
      },
    }
  })
}

/** Every loan-out row, oldest first. */
function lentOf(transactions: readonly Transaction[], categories: readonly Category[]): Lent[] {
  const loanOut = categoriesWithRole(categories, PACK_ROLES.ownerLoanOut)
  return oldestFirst(transactions.filter((transaction) => loanOut.includes(transaction.category))).map((row): Lent => ({
    lentOn: row.date,
    amount: row.amount < 0 ? negateMoney(row.amount) : ZERO,
    row,
  }))
}

/** Every credit on a loan-repaid category and every payment from the owner on a reimbursement category, net of same-day returns, oldest first. */
function repaymentsOf(transactions: readonly Transaction[], categories: readonly Category[]): Repayment[] {
  const loanRepaid = categoriesWithRole(categories, PACK_ROLES.ownerLoanRepaid)
  const loanRepayments = transactions.filter((transaction) => loanRepaid.includes(transaction.category) && transaction.amount > 0).map((payment): Repayment => ({ payment, amount: payment.amount }))
  const repayments = [...loanRepayments, ...netReimbursements(transactions, categories).fromOwner]
  return repayments.sort((earlier, later) => earlier.payment.date.localeCompare(later.payment.date) || earlier.payment.sequence - later.payment.sequence)
}

/** The filters behind lent, repaid and the balance, without a period. */
export function loanBookFilters(categories: readonly Category[]): Record<'lent' | 'repaid' | 'outstanding', Partial<FilterState>> {
  const loanOut = categoriesWithRole(categories, PACK_ROLES.ownerLoanOut)
  const loanRepaid = categoriesWithRole(categories, PACK_ROLES.ownerLoanRepaid)
  const reimbursement = categoriesWithRole(categories, PACK_ROLES.reimbursement)
  return {
    lent: { categories: loanOut, amount: { min: null, max: moneyFromCents(-1) } },
    repaid: { categories: [...loanRepaid, ...reimbursement], amount: { min: moneyFromCents(1), max: null } },
    outstanding: { categories: [...loanOut, ...loanRepaid, ...reimbursement] },
  }
}

/** Booking order: by date, then the order the bank booked them within the day. */
function oldestFirst(rows: readonly Transaction[]): Transaction[] {
  return [...rows].sort((earlier, later) => earlier.date.localeCompare(later.date) || earlier.sequence - later.sequence)
}

function sumOf(entries: readonly { readonly amount: Money }[]): Money {
  return entries.reduce((total, entry) => addMoney(total, entry.amount), ZERO)
}
