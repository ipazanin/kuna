import { balanceOn, interestOf, isEstimate, paymentsAfter, paymentsDueAfter, paymentsInYear, payoffDate, scheduledPayments } from '../../bankLoans/domain/loanFigures'
import type { PaymentSplit } from '../../bankLoans/domain/loanFigures'
import type { PlanRow } from '../../bankLoans/domain/loanPlan'
import type { BankLoan } from '../../workbook/domain/bankLoan'
import type { BankLoanBook } from '../../workbook/domain/readLoanBook'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { lastDayOf, monthOf, monthsFrom } from '../../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../../shared/calendar/monthKey'
import { ZERO, addMoney, sumMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'

/** A bank loan whose plan is worked out. */
export type PlannedLoan = BankLoanBook & { readonly plan: readonly PlanRow[] }

/** The bank loans whose plan is worked out, in the order of the file. */
export function plannedLoans(books: readonly BankLoanBook[]): PlannedLoan[] {
  return books.filter((book): book is PlannedLoan => book.plan !== null)
}

/** A month over the loans: each loan's amount, in the order of the loans, and their sum. */
export interface LoansMonth {
  readonly month: MonthKey
  readonly amounts: readonly Money[]
  readonly total: Money
}

function monthsOver(loans: readonly PlannedLoan[], startOf: (loan: PlannedLoan) => CivilDate, amountOf: (loan: PlannedLoan, month: MonthKey) => Money): LoansMonth[] {
  const first = loans.map(startOf).reduce<CivilDate | null>((earliest, start) => (earliest === null || start < earliest ? start : earliest), null)
  const last = debtFreeOn(loans)
  if (first === null || last === null) return []
  return monthsFrom(monthOf(first), monthOf(last)).map((month) => {
    const amounts = loans.map((loan) => amountOf(loan, month))
    return { month, amounts, total: sumMoney(amounts) }
  })
}

/** What each loan owes at each month end, from the earliest drawdown to the last payoff. */
export function owedByMonth(loans: readonly PlannedLoan[]): LoansMonth[] {
  return monthsOver(
    loans,
    (loan) => loan.loan.drawdown,
    (loan, month) => balanceOn(loan.loan, loan.plan, lastDayOf(month)),
  )
}

/**
 * Your share of each loan's instalments due in each month, from the earliest scheduled payment to the
 * last payoff. Extra payments are left out, since a one-off sum would dwarf every month around it.
 */
export function outgoingByMonth(loans: readonly PlannedLoan[]): LoansMonth[] {
  const byMonth = new Map(
    loans.map((loan) => {
      const months = new Map<MonthKey, Money>()
      for (const row of scheduledPayments(loan.plan)) months.set(monthOf(row.date), addMoney(months.get(monthOf(row.date)) ?? ZERO, row.yourShare))
      return [loan, months] as const
    }),
  )
  return monthsOver(
    loans,
    (loan) => scheduledPayments(loan.plan)[0]?.date ?? loan.loan.firstInstalment,
    (loan, month) => byMonth.get(loan)?.get(month) ?? ZERO,
  )
}

/** A payment still to fall due on one of the loans. */
export interface UpcomingPayment {
  readonly loan: BankLoan
  readonly date: CivilDate
  readonly payment: Money
  readonly yourShare: Money
}

/** Every scheduled payment after the day over the loans, by due date, and by the order of the loans on one day. */
export function upcomingPayments(loans: readonly PlannedLoan[], day: CivilDate): UpcomingPayment[] {
  return loans
    .flatMap((loan) => paymentsDueAfter(loan.plan, day).map((row) => ({ loan: loan.loan, date: row.date, payment: row.payment, yourShare: row.yourShare })))
    .sort((earlier, later) => earlier.date.localeCompare(later.date))
}

/** The bank's interest over the loans, and the part of it subsidies pay, which pay an instalment's interest first. */
export interface InterestPart {
  readonly interest: Money
  readonly subsidy: Money
}

function interestOfSplits(splits: readonly PaymentSplit[]): InterestPart {
  return { interest: sumMoney(splits.map(interestOf)), subsidy: sumMoney(splits.map((split) => split.subsidyInterest)) }
}

/** The interest of the year's payments over the loans, as each loan's card gives it. */
export function interestInYear(loans: readonly PlannedLoan[], year: number): InterestPart {
  return interestOfSplits(loans.map((loan) => paymentsInYear(loan.plan, year)))
}

/** The interest of every payment still to fall due after the day over the loans. */
export function interestAfter(loans: readonly PlannedLoan[], day: CivilDate): InterestPart {
  return interestOfSplits(loans.map((loan) => paymentsAfter(loan.plan, day)))
}

/** The day the last bank loan is paid off, or null without a bank loan or while one's plan cannot be worked out. */
export function debtFreeOn(books: readonly BankLoanBook[]): CivilDate | null {
  const planned = plannedLoans(books)
  if (planned.length < books.length) return null
  return planned.flatMap((loan) => payoffDate(loan.plan) ?? []).reduce<CivilDate | null>((latest, payoff) => (latest === null || payoff > latest ? payoff : latest), null)
}

/** The first month after the day whose payments on any of the loans are worked out at a variable rate, so the figures from it are estimates. */
export function estimateFrom(loans: readonly PlannedLoan[], day: CivilDate): MonthKey | null {
  const dates = loans.flatMap((loan) => {
    const row = loan.plan.find((entry) => isEstimate(entry, loan.ratePeriods, day))
    return row === undefined ? [] : [row.date]
  })
  const first = dates.reduce<CivilDate | null>((earliest, date) => (earliest === null || date < earliest ? date : earliest), null)
  return first === null ? null : monthOf(first)
}
