import { annuity, monthlyInterest } from './yearlyRate'
import type { YearlyRate } from './yearlyRate'
import type { BankLoan, LoanSubsidy } from '../../workbook/domain/bankLoan'
import type { ExtraPayment } from '../../workbook/domain/extraPayment'
import type { RatePeriod } from '../../workbook/domain/ratePeriod'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { dayMonthsLater, monthCountBetween, monthOf } from '../../../../shared/calendar/monthKey'
import { ZERO, addMoney, subtractMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'

/** One dated payment of a bank loan's plan. */
export interface PlanRow {
  readonly kind: 'interim-interest' | 'instalment' | 'extra-payment'
  readonly date: CivilDate
  /** The instalment's number, counting from 1. Null for the other kinds. */
  readonly number: number | null
  /** What the bank receives on the day: principal plus interest. */
  readonly payment: Money
  readonly principal: Money
  readonly interest: Money
  /** The part of the payment the subsidy pays. */
  readonly subsidy: Money
  /** The payment less the subsidy. */
  readonly yourShare: Money
  /** What is owed once the row is paid. */
  readonly balance: Money
}

/** How many instalments of `instalment` repay the balance at the rate, or null when the instalment does not cover a month's interest. */
function instalmentsToRepay(balance: Money, rate: YearlyRate, instalment: Money): number | null {
  let left = balance
  let count = 0
  while (left > 0) {
    const principal = subtractMoney(instalment, monthlyInterest(left, rate))
    if (principal <= 0) return null
    left = principal < left ? subtractMoney(left, principal) : ZERO
    count += 1
  }
  return count
}

/** What the subsidy pays of the instalment with this number: its monthly amount, or the whole payment when that is less. */
function subsidyOf(subsidy: LoanSubsidy | null, number: number, payment: Money): Money {
  if (subsidy === null || number < subsidy.firstInstalment || number >= subsidy.firstInstalment + subsidy.instalments) return ZERO
  return subsidy.monthly < payment ? subsidy.monthly : payment
}

/**
 * The due date of the instalment with this number, counted in months from `anchor`, an earlier or the
 * same due date whose day of the month every due date keeps where the month has it. A loan that takes
 * over another one's due dates passes that loan's first instalment, so a month-end day stays one.
 */
export function dueDateOf(loan: BankLoan, number: number, anchor: CivilDate = loan.firstInstalment): CivilDate {
  return dayMonthsLater(anchor, monthCountBetween(monthOf(anchor), monthOf(loan.firstInstalment)) + number - 2)
}

/**
 * The bank loan's plan from its terms, oldest first. The first instalment is the annuity of the
 * principal over every instalment at the first period's rate. Each month's interest is the balance
 * times the yearly rate over 12, and the rest of the instalment repays principal. A rate period
 * recomputes the instalment on the balance over the instalments left, so the loan still ends when it
 * would have. An extra payment lowers the balance on its date, after an instalment due that day:
 * with a lower instalment the next instalment is recomputed the same way, and with a shorter term
 * the instalment stays and the plan ends once the balance is repaid. The last instalment takes what
 * is left. The subsidy pays its amount of each instalment it covers and leaves principal, interest
 * and balance alone. Every period's `from` must be a due date of the loan and one must start at the
 * first instalment, as the reader keeps them. The due dates count from `anchor` as `dueDateOf` does.
 */
export function loanPlan(loan: BankLoan, periods: readonly RatePeriod[], extraPayments: readonly ExtraPayment[], anchor: CivilDate = loan.firstInstalment): PlanRow[] {
  const rateOn = new Map(periods.map((period) => [period.from, period.rate]))
  const extras = [...extraPayments].sort((earlier, later) => earlier.date.localeCompare(later.date))
  const firstRate = rateOn.get(loan.firstInstalment)
  if (firstRate === undefined) {
    throw new Error(`No rate period of ${loan.name} starts at its first instalment.`)
  }
  const rows: PlanRow[] = []
  let balance = loan.principal
  let rate = firstRate
  let instalment = annuity(loan.principal, rate, loan.instalments)
  let last = loan.instalments
  let pending: ExtraPayment['effect'][] = []
  let nextExtra = 0

  const payExtrasUpTo = (holds: (date: CivilDate) => boolean): void => {
    while (nextExtra < extras.length && holds(extras[nextExtra]!.date)) {
      const extra = extras[nextExtra]!
      nextExtra += 1
      if (balance === 0) continue
      const principal = extra.amount < balance ? extra.amount : balance
      balance = subtractMoney(balance, principal)
      rows.push({ kind: 'extra-payment', date: extra.date, number: null, payment: principal, principal, interest: ZERO, subsidy: ZERO, yourShare: principal, balance })
      pending.push(extra.effect)
    }
  }

  if (loan.interimInterest !== null) {
    const { amount, date } = loan.interimInterest
    payExtrasUpTo((paid) => paid < date)
    rows.push({ kind: 'interim-interest', date, number: null, payment: amount, principal: ZERO, interest: amount, subsidy: ZERO, yourShare: amount, balance })
  }

  for (let number = 1; number <= last; number += 1) {
    const due = dueDateOf(loan, number, anchor)
    payExtrasUpTo((date) => date < due)
    if (balance === 0) break
    for (const effect of pending) {
      if (effect === 'lower-instalment') {
        instalment = annuity(balance, rate, last - number + 1)
      } else {
        const left = instalmentsToRepay(balance, rate, instalment)
        last = left === null ? last : Math.min(last, number - 1 + left)
      }
    }
    pending = []
    const newRate = rateOn.get(due)
    if (number > 1 && newRate !== undefined) {
      rate = newRate
      instalment = annuity(balance, rate, last - number + 1)
    }
    const interest = monthlyInterest(balance, rate)
    const principal = number === last || instalment - interest >= balance ? balance : subtractMoney(instalment, interest)
    const payment = addMoney(principal, interest)
    const subsidy = subsidyOf(loan.subsidy, number, payment)
    balance = subtractMoney(balance, principal)
    rows.push({ kind: 'instalment', date: due, number, payment, principal, interest, subsidy, yourShare: subtractMoney(payment, subsidy), balance })
    payExtrasUpTo((date) => date === due)
  }
  return rows
}
