import { balanceOn, interestOf, nextPayment, paymentsAfter, paymentsByYear, payoffDate, ratePeriodOn, subsidyLastCovered } from '../domain/loanFigures'
import type { PaymentSplit } from '../domain/loanFigures'
import type { PlanRow } from '../domain/loanPlan'
import type { MonthBalance } from '../../balances/presentation/balanceChart'
import type { BankLoanBook } from '../../workbook/domain/readLoanBook'
import { daysBetween, yearOf } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { shortDayLabel } from '../../../../shared/calendar/dayLabel'
import { lastDayOf, monthOf, monthsFrom } from '../../../../shared/calendar/monthKey'
import { ZERO, addMoney, subtractMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'

/** The figures a bank loan's card and page lead with, on a day. */
export interface BankLoanFigures {
  readonly owed: Money
  /** The principal repaid by the day, and its whole percent of the principal borrowed. */
  readonly paidBack: Money
  readonly paidBackPercent: number
  /** The next payment, with the full instalment and your share, or null once the plan is paid. */
  readonly next: Pick<PlanRow, 'date' | 'payment' | 'yourShare'> | null
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
  const owed = balanceOn(loan, plan, day)
  const paidBack = day < loan.drawdown ? ZERO : subtractMoney(loan.principal, owed)
  const thisYear = paymentsByYear(plan).find((entry) => entry.year === year)
  const instalmentsAfter = plan.filter((row) => row.kind === 'instalment' && row.date > day)
  return {
    owed,
    paidBack,
    paidBackPercent: Math.floor((paidBack * 100) / loan.principal),
    next: next === null ? null : { date: next.date, payment: next.payment, yourShare: next.yourShare },
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
    interestThisYear: { year, interest: thisYear === undefined ? ZERO : interestOf(thisYear), subsidy: thisYear?.subsidyInterest ?? ZERO },
    stillToPay: paymentsAfter(plan, day),
  }
}

/** One row of the plan as the table shows it. */
export interface PlanLine {
  readonly key: string
  readonly kind: PlanRow['kind']
  readonly date: CivilDate
  readonly number: number | null
  readonly payment: Money
  readonly yourShare: Money
  readonly interest: Money
  readonly principal: Money
  readonly subsidy: Money
  readonly balance: Money
  /** Worked out at a variable rate, so the bank's figure may differ. */
  readonly estimate: boolean
  readonly late: boolean
  /** "Paid", "Due", "Paid 8 Dec, 18 days late" or "Extra payment". */
  readonly status: string
}

export type PlanTotals = Pick<PlanLine, 'payment' | 'yourShare' | 'interest' | 'principal' | 'subsidy'>

export interface PlanYear {
  readonly year: number
  readonly lines: readonly PlanLine[]
  readonly totals: PlanTotals
  /** What is owed once the year's last row is paid. */
  readonly balance: Money
  readonly estimate: boolean
}

function statusOf(row: PlanRow, paidLate: CivilDate | undefined, day: CivilDate): string {
  if (row.kind === 'extra-payment') return 'Extra payment'
  if (row.kind === 'interim-interest') return row.date <= day ? 'Interim interest, paid' : 'Interim interest, due'
  if (paidLate !== undefined) return `Paid ${shortDayLabel(paidLate)}, ${daysBetween(row.date, paidLate)} days late`
  return row.date <= day ? 'Paid' : 'Due'
}

const NO_TOTALS: PlanTotals = { payment: ZERO, yourShare: ZERO, interest: ZERO, principal: ZERO, subsidy: ZERO }

/** The plan grouped by the calendar year its rows fall due in, with each year's totals, oldest first. */
export function planYears(book: BankLoanBook, day: CivilDate): PlanYear[] {
  const paidLate = new Map(book.lateInstalments.map((late) => [late.due, late.paid]))
  const years = new Map<number, PlanLine[]>()
  for (const [index, row] of (book.plan ?? []).entries()) {
    const line: PlanLine = {
      ...row,
      key: `${row.kind}-${row.date}-${index}`,
      estimate: row.kind === 'instalment' && row.date > day && ratePeriodOn(book.ratePeriods, row.date)?.rateType === 'variable',
      late: row.kind === 'instalment' && paidLate.has(row.date),
      status: statusOf(row, row.kind === 'instalment' ? paidLate.get(row.date) : undefined, day),
    }
    const year = yearOf(row.date)
    years.set(year, [...(years.get(year) ?? []), line])
  }
  return [...years].map(([year, lines]) => ({
    year,
    lines,
    totals: lines.reduce(
      (sum, line) => ({
        payment: addMoney(sum.payment, line.payment),
        yourShare: addMoney(sum.yourShare, line.yourShare),
        interest: addMoney(sum.interest, line.interest),
        principal: addMoney(sum.principal, line.principal),
        subsidy: addMoney(sum.subsidy, line.subsidy),
      }),
      NO_TOTALS,
    ),
    balance: lines.at(-1)!.balance,
    estimate: lines.some((line) => line.estimate),
  }))
}

/** What the loan owes at each month end from its drawdown to its last payment. */
export function bankLoanMonths(book: BankLoanBook): MonthBalance[] {
  const { loan, plan } = book
  const end = plan === null ? null : payoffDate(plan)
  if (plan === null || end === null) return []
  return monthsFrom(monthOf(loan.drawdown), monthOf(end)).map((month) => ({ month, owed: balanceOn(loan, plan, lastDayOf(month)) }))
}
