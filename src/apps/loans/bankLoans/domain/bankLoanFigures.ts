import { balanceOn, interestOf, nextPayment, paymentsAfter, paymentsInYear, payoffDate, subsidyLastCovered } from './loanFigures'
import type { PaymentSplit } from './loanFigures'
import type { PlanRow } from './loanPlan'
import type { MonthBalance } from '../../balances/domain/monthBalance'
import type { BankLoanBook } from '../../workbook/domain/readLoanBook'
import { yearOf } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { lastDayOf, monthOf, monthsFrom } from '../../../../shared/calendar/monthKey'
import { ZERO, subtractMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import { wholePercentOf } from '../../../../shared/money/percent'
import { isShared, partOnDay, yourPartOf } from '../../../../shared/money/yourPart'

/** The figures a bank loan's card and page lead with, on a day. */
export interface BankLoanFigures {
  /** What the bank is owed on the day. */
  readonly owed: Money
  /** Your part of it, only for a loan you took out with others. */
  readonly yours?: Money
  /** The principal repaid by the day, and its whole percent of the principal borrowed. */
  readonly paidBack: Money
  readonly paidBackPercent: number
  /** The next payment, with the full instalment and what you pay of it, or null once the plan is paid. Your part of what you pay is only there for a loan you took out with others. */
  readonly next: (Pick<PlanRow, 'date' | 'payment' | 'youPay'> & { readonly yours?: Money }) | null
  /** When the subsidy's last covered instalment falls due, its instalments still to come, and the first instalment after it. Null for a loan without a subsidy. */
  readonly subsidy: { readonly lastCovered: CivilDate; readonly ended: boolean; readonly instalmentsLeft: number; readonly after: Money | null } | null
  readonly payoff: CivilDate | null
  readonly instalmentsLeft: number
  /** The interest of the day's year, and the part of it the subsidy pays. */
  readonly interestThisYear: { readonly year: number; readonly interest: Money; readonly subsidy: Money }
  /** Every payment still to fall due after the day, principal and interest, split by who pays it. */
  readonly stillToPay: PaymentSplit
}

/** The bank loan's figures on the day, or null while its plan cannot be worked out. */
export function bankLoanFigures(book: BankLoanBook, day: CivilDate): BankLoanFigures | null {
  const { loan, plan } = book
  if (plan === null) return null
  const next = nextPayment(plan, day)
  const { subsidy } = loan
  const lastCovered = subsidyLastCovered(loan)
  const year = yearOf(day)
  const balance = balanceWithYoursOn(book, plan, day)
  const { owed } = balance
  const paidBack = day < loan.drawdown ? ZERO : subtractMoney(loan.principal, owed)
  const thisYear = paymentsInYear(plan, year)
  const instalmentsAfter = plan.filter((row) => row.kind === 'instalment' && row.date > day)
  return {
    ...balance,
    paidBack,
    paidBackPercent: wholePercentOf(paidBack, loan.principal),
    next: next === null ? null : { date: next.date, payment: next.payment, youPay: next.youPay, ...yoursOf(book, next) },
    subsidy:
      subsidy === null || lastCovered === null
        ? null
        : {
            lastCovered,
            ended: lastCovered <= day,
            instalmentsLeft: instalmentsAfter.filter((row) => row.subsidy > 0).length,
            after: plan.find((row) => row.kind === 'instalment' && row.number === subsidy.firstInstalment + subsidy.instalments)?.payment ?? null,
          },
    payoff: payoffDate(plan),
    instalmentsLeft: instalmentsAfter.length,
    interestThisYear: { year, interest: interestOf(thisYear), subsidy: thisYear.subsidyInterest },
    stillToPay: paymentsAfter(plan, day),
  }
}

/** What the bank is owed on the day, and your part of it at that day's share for a loan you took out with others. */
export function balanceWithYoursOn(book: Pick<BankLoanBook, 'loan' | 'shares'>, plan: readonly PlanRow[], day: CivilDate): Pick<BankLoanFigures, 'owed' | 'yours'> {
  const owed = balanceOn(book.loan, plan, day)
  const share = partOnDay(book.loan.share, book.shares, day)
  return share === null ? { owed } : { owed, yours: yourPartOf(owed, share) }
}

/** Your part of what you pay on a row, at the part of its day, only for a loan you took out with others at any time. */
export function yoursOf(book: Pick<BankLoanBook, 'loan' | 'shares'>, row: Pick<PlanRow, 'date' | 'youPay'>): { readonly yours?: Money } {
  return isShared(book.loan.share, book.shares) ? { yours: yourPartOf(row.youPay, partOnDay(book.loan.share, book.shares, row.date)) } : {}
}

/** What you owe of the loan: your part of it, or all of it when you took it out alone. */
export function owedByYou(figures: Pick<BankLoanFigures, 'owed' | 'yours'>): Money {
  return figures.yours ?? figures.owed
}

/** The day the loan was paid off, once that day has come, or null while it is open or its plan cannot be worked out. */
export function bankLoanPaidOffOn(book: BankLoanBook, day: CivilDate): CivilDate | null {
  const payoff = book.plan === null ? null : payoffDate(book.plan)
  return payoff !== null && payoff <= day ? payoff : null
}

/** What the loan owes at each month end from its drawdown to its last payment, with your part at that day's share for a loan you took out with others. */
export function bankLoanMonths(book: BankLoanBook): MonthBalance[] {
  const { loan, plan } = book
  const end = plan === null ? null : payoffDate(plan)
  if (plan === null || end === null) return []
  return monthsFrom(monthOf(loan.drawdown), monthOf(end)).map((month) => ({ month, ...balanceWithYoursOn(book, plan, lastDayOf(month)) }))
}
