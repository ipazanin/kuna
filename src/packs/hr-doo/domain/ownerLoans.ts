import type { CivilDate } from '../../../shared/calendar/civilDate'
import { isCompleteMonth } from '../../../shared/calendar/ledgerWindow'
import type { LedgerWindow } from '../../../shared/calendar/ledgerWindow'
import { firstDayOf, lastDayOf, monthOf } from '../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../shared/calendar/monthKey'
import { ZERO, addMoney, moneyFromCents, negateMoney, subtractMoney } from '../../../shared/money/money'
import type { Money } from '../../../shared/money/money'
import { drillToTransactions, monthPeriod } from '../../../features/filters/domain/drillTarget'
import type { DrillTarget, Figure } from '../../../features/filters/domain/drillTarget'
import type { AmountRange } from '../../../features/filters/domain/filterState'
import type { Category, Transaction } from '../../../features/workbook/domain/workbook'
import { PACK_ROLES, categoriesWithRole } from './packRoles'

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
  readonly drill: DrillTarget
}

export interface OwnerLoanBook {
  /** Oldest first. */
  readonly loans: readonly OwnerLoan[]
  /** Every debit on a loan-out category, read positive. */
  readonly lent: Figure
  /** Every credit on a loan-repaid category, including any beyond what the ledger lent. */
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

const DEBITS: AmountRange = { min: null, max: moneyFromCents(-1) }
const CREDITS: AmountRange = { min: moneyFromCents(1), max: null }

/**
 * The owner's loans matched to their repayments first in, first out, with no date cap: a
 * repayment runs on into the next open loan, and whatever is repaid past the last loan stays out
 * of the list. The headline figures come from the ledger rows themselves, so the balance states
 * an excess repayment that the list cannot hand to any loan.
 */
export function ownerLoans(transactions: readonly Transaction[], categories: readonly Category[]): OwnerLoanBook {
  const { loanOut, loanRepaid } = loanCategories(categories)
  const loanRows = oldestFirst(transactions.filter((transaction) => loanOut.includes(transaction.category)))
  const repaymentRows = oldestFirst(transactions.filter((transaction) => loanRepaid.includes(transaction.category) && transaction.amount > 0))

  let repaymentIndex = 0
  let leftInRepayment = repaymentRows[0]?.amount ?? ZERO
  const loans = loanRows.map((row): OwnerLoan => {
    const amount = row.amount < 0 ? negateMoney(row.amount) : ZERO
    let remaining = amount
    const repayments: LoanRepaymentShare[] = []
    while (remaining > 0 && repaymentIndex < repaymentRows.length) {
      const repayment = repaymentRows[repaymentIndex]!
      const applied = Math.min(remaining, leftInRepayment) as Money
      repayments.push({ repaidOn: repayment.date, applied, drill: rowDrill(repayment) })
      remaining = subtractMoney(remaining, applied)
      leftInRepayment = subtractMoney(leftInRepayment, applied)
      if (leftInRepayment === 0) {
        repaymentIndex += 1
        leftInRepayment = repaymentRows[repaymentIndex]?.amount ?? ZERO
      }
    }
    const closed = remaining === 0
    return {
      lentOn: row.date,
      amount,
      remaining,
      status: closed ? 'repaid' : 'open',
      repaidOn: closed && amount > 0 ? (repayments[repayments.length - 1]?.repaidOn ?? null) : null,
      repayments,
      drill: rowDrill(row),
    }
  })

  const lent = sumOf(loanRows, (row) => (row.amount < 0 ? negateMoney(row.amount) : ZERO))
  const repaid = sumOf(repaymentRows, (row) => row.amount)
  const open = loans.filter((loan) => loan.status === 'open')
  return {
    loans,
    lent: { amount: lent, drill: drillToTransactions({ period: { preset: 'all' }, categories: loanOut, amount: DEBITS }) },
    repaid: { amount: repaid, drill: drillToTransactions({ period: { preset: 'all' }, categories: loanRepaid, amount: CREDITS }) },
    outstanding: {
      amount: subtractMoney(lent, repaid),
      drill: drillToTransactions({ period: { preset: 'all' }, categories: [...loanOut, ...loanRepaid] }),
    },
    openCount: open.length,
    oldestOpen: open[0]?.lentOn ?? null,
  }
}

/** Lent and repaid in each month asked for, with the balance at each month's end. */
export function loanMonths(
  transactions: readonly Transaction[],
  categories: readonly Category[],
  months: readonly MonthKey[],
  window: LedgerWindow,
): LoanMonth[] {
  const { loanOut, loanRepaid } = loanCategories(categories)
  const lentRows = transactions.filter((transaction) => loanOut.includes(transaction.category) && transaction.amount < 0)
  const repaidRows = transactions.filter((transaction) => loanRepaid.includes(transaction.category) && transaction.amount > 0)
  const inMonth = (month: MonthKey) => (transaction: Transaction) => monthOf(transaction.date) === month
  const upTo = (month: MonthKey) => (transaction: Transaction) => monthOf(transaction.date) <= month
  return months.map((month) => {
    const lent = sumOf(lentRows.filter(inMonth(month)), (row) => negateMoney(row.amount))
    const repaid = sumOf(repaidRows.filter(inMonth(month)), (row) => row.amount)
    const balance = subtractMoney(
      sumOf(lentRows.filter(upTo(month)), (row) => negateMoney(row.amount)),
      sumOf(repaidRows.filter(upTo(month)), (row) => row.amount),
    )
    return {
      month,
      complete: isCompleteMonth(window, month),
      lent: { amount: lent, drill: drillToTransactions({ period: monthPeriod(month), categories: loanOut, amount: DEBITS }) },
      repaid: { amount: repaid, drill: drillToTransactions({ period: monthPeriod(month), categories: loanRepaid, amount: CREDITS }) },
      outstanding: {
        amount: balance,
        drill: drillToTransactions({
          period: { preset: 'custom', range: { from: firstDayOf(window.firstMonth), to: lastDayOf(month) } },
          categories: [...loanOut, ...loanRepaid],
        }),
      },
    }
  })
}

function loanCategories(categories: readonly Category[]): { readonly loanOut: string[]; readonly loanRepaid: string[] } {
  return {
    loanOut: categoriesWithRole(categories, PACK_ROLES.ownerLoanOut),
    loanRepaid: categoriesWithRole(categories, PACK_ROLES.ownerLoanRepaid),
  }
}

/** Booking order: by date, then the order the bank booked them within the day. */
function oldestFirst(rows: readonly Transaction[]): Transaction[] {
  return [...rows].sort((earlier, later) => earlier.date.localeCompare(later.date) || earlier.sequence - later.sequence)
}

/** The one row, found again by its day, category and exact amount. */
function rowDrill(row: Transaction): DrillTarget {
  return drillToTransactions({
    period: { preset: 'custom', range: { from: row.date, to: row.date } },
    categories: [row.category],
    amount: { min: row.amount, max: row.amount },
  })
}

function sumOf(rows: readonly Transaction[], amountOf: (row: Transaction) => Money): Money {
  return rows.reduce((total, row) => addMoney(total, amountOf(row)), ZERO)
}
