import type { PlanRow } from './loanPlan'
import type { BankLoan } from '../../workbook/domain/bankLoan'
import type { LateInstalment } from '../../workbook/domain/lateInstalment'
import type { RatePeriod } from '../../workbook/domain/ratePeriod'
import { yearOf } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { dayMonthsLater } from '../../../../shared/calendar/monthKey'
import { ZERO, addMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'

/** What is owed on the day once that day's payments are made, nothing before the drawdown. */
export function balanceOn(loan: BankLoan, plan: readonly PlanRow[], day: CivilDate): Money {
  if (day < loan.drawdown) return ZERO
  return plan.filter((row) => row.date <= day).at(-1)?.balance ?? loan.principal
}

/** The first instalment or interim interest due after the day, with the full payment and your share, or null once the plan is paid. */
export function nextPayment(plan: readonly PlanRow[], day: CivilDate): PlanRow | null {
  return plan.find((row) => row.kind !== 'extra-payment' && row.date > day) ?? null
}

/** The day the last instalment falls due. */
export function payoffDate(plan: readonly PlanRow[]): CivilDate | null {
  return plan.at(-1)?.date ?? null
}

export interface YearInterest {
  readonly year: number
  readonly interest: Money
  /** The part of the year's instalments the subsidy pays. */
  readonly subsidy: Money
}

/** Interest by the calendar year it falls due in, the interim interest included, with the subsidy of the same year. */
export function interestByYear(plan: readonly PlanRow[]): YearInterest[] {
  const years = new Map<number, YearInterest>()
  for (const row of plan) {
    const year = yearOf(row.date)
    const held = years.get(year) ?? { year, interest: ZERO, subsidy: ZERO }
    years.set(year, { year, interest: addMoney(held.interest, row.interest), subsidy: addMoney(held.subsidy, row.subsidy) })
  }
  return [...years.values()]
}

/** The interest still to fall due after the day, and what the subsidy still pays of it. */
export function interestLeft(plan: readonly PlanRow[], day: CivilDate): Omit<YearInterest, 'year'> {
  return plan
    .filter((row) => row.date > day)
    .reduce((left, row) => ({ interest: addMoney(left.interest, row.interest), subsidy: addMoney(left.subsidy, row.subsidy) }), { interest: ZERO, subsidy: ZERO })
}

export type PaidSoFar = Pick<PlanRow, 'payment' | 'principal' | 'interest' | 'subsidy' | 'yourShare'>

/** What the rows paid by the day add up to. A row counts from its date, and a late instalment from the day it was paid. */
export function paidSoFar(plan: readonly PlanRow[], lateInstalments: readonly LateInstalment[], day: CivilDate): PaidSoFar {
  const paidOn = new Map(lateInstalments.map((late) => [late.due, late.paid]))
  return plan
    .filter((row) => (row.kind === 'instalment' ? (paidOn.get(row.date) ?? row.date) : row.date) <= day)
    .reduce(
      (paid, row) => ({
        payment: addMoney(paid.payment, row.payment),
        principal: addMoney(paid.principal, row.principal),
        interest: addMoney(paid.interest, row.interest),
        subsidy: addMoney(paid.subsidy, row.subsidy),
        yourShare: addMoney(paid.yourShare, row.yourShare),
      }),
      { payment: ZERO, principal: ZERO, interest: ZERO, subsidy: ZERO, yourShare: ZERO },
    )
}

/** The rate period an instalment due on the day is worked out at: the latest that starts by then. */
export function ratePeriodOn(periods: readonly RatePeriod[], day: CivilDate): RatePeriod | null {
  return periods.filter((period) => period.from <= day).reduce<RatePeriod | null>((latest, period) => (latest === null || period.from > latest.from ? period : latest), null)
}

/** The due date of the last instalment the subsidy covers, as the loan was signed. */
export function subsidyLastCovered(loan: BankLoan): CivilDate | null {
  return loan.subsidy === null ? null : dayMonthsLater(loan.firstInstalment, loan.subsidy.firstInstalment + loan.subsidy.instalments - 2)
}
