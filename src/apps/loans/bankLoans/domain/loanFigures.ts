import type { PlanRow } from './loanPlan'
import type { BankLoan } from '../../workbook/domain/bankLoan'
import type { LateInstalment } from '../../workbook/domain/lateInstalment'
import type { RatePeriod } from '../../workbook/domain/ratePeriod'
import { yearOf } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { dayMonthsLater } from '../../../../shared/calendar/monthKey'
import { ZERO, addMoney, subtractMoney } from '../../../../shared/money/money'
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

/** Where payments go: the principal and interest you pay, the part of each the subsidy pays, and principal you pay early. */
export interface PaymentSplit {
  readonly principal: Money
  readonly interest: Money
  readonly subsidyPrincipal: Money
  readonly subsidyInterest: Money
  readonly extra: Money
}

const NO_PAYMENTS: PaymentSplit = { principal: ZERO, interest: ZERO, subsidyPrincipal: ZERO, subsidyInterest: ZERO, extra: ZERO }

/**
 * Where a row's payment goes. The subsidy pays the instalment's interest first, and only a subsidy
 * larger than the interest repays principal. An extra payment is principal you pay early.
 */
export function splitOf(row: PlanRow): PaymentSplit {
  if (row.kind === 'extra-payment') return { ...NO_PAYMENTS, extra: row.principal }
  const subsidyInterest = row.subsidy < row.interest ? row.subsidy : row.interest
  const subsidyPrincipal = subtractMoney(row.subsidy, subsidyInterest)
  return { principal: subtractMoney(row.principal, subsidyPrincipal), interest: subtractMoney(row.interest, subsidyInterest), subsidyPrincipal, subsidyInterest, extra: ZERO }
}

function addSplits(sum: PaymentSplit, split: PaymentSplit): PaymentSplit {
  return {
    principal: addMoney(sum.principal, split.principal),
    interest: addMoney(sum.interest, split.interest),
    subsidyPrincipal: addMoney(sum.subsidyPrincipal, split.subsidyPrincipal),
    subsidyInterest: addMoney(sum.subsidyInterest, split.subsidyInterest),
    extra: addMoney(sum.extra, split.extra),
  }
}

/** Where the rows' payments go, added up. */
export function splitOfRows(rows: readonly PlanRow[]): PaymentSplit {
  return rows.map(splitOf).reduce(addSplits, NO_PAYMENTS)
}

/** Principal and interest together, whoever pays them. */
export function paymentOf(split: PaymentSplit): Money {
  return addMoney(principalOf(split), interestOf(split))
}

/** What the subsidy pays of principal and interest. */
export function subsidyShareOf(split: PaymentSplit): Money {
  return addMoney(split.subsidyPrincipal, split.subsidyInterest)
}

/** What you pay: everything the subsidy does not. */
export function yourShareOf(split: PaymentSplit): Money {
  return addMoney(addMoney(split.principal, split.interest), split.extra)
}

/** The principal you pay, early payments included. */
export function yourPrincipalOf(split: PaymentSplit): Money {
  return addMoney(split.principal, split.extra)
}

/** Principal, whoever pays it, early payments included. */
export function principalOf(split: PaymentSplit): Money {
  return addMoney(addMoney(split.principal, split.subsidyPrincipal), split.extra)
}

/** Interest, whoever pays it. */
export function interestOf(split: PaymentSplit): Money {
  return addMoney(split.interest, split.subsidyInterest)
}

export interface YearPayments extends PaymentSplit {
  readonly year: number
  readonly instalments: number
}

/** Where each calendar year's payments go, the interim interest and extra payments included, oldest first. */
export function paymentsByYear(plan: readonly PlanRow[]): YearPayments[] {
  const years = new Map<number, PlanRow[]>()
  for (const row of plan) {
    const year = yearOf(row.date)
    years.set(year, [...(years.get(year) ?? []), row])
  }
  return [...years].map(([year, rows]) => ({ year, instalments: rows.filter((row) => row.kind === 'instalment').length, ...splitOfRows(rows) }))
}

/** Where the payments still to fall due after the day go. */
export function paymentsAfter(plan: readonly PlanRow[], day: CivilDate): PaymentSplit {
  return splitOfRows(plan.filter((row) => row.date > day))
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
