import { loanPlan } from './loanPlan'
import type { PlanRow } from './loanPlan'
import { payoffDate, subsidyLastCovered } from './loanFigures'
import type { BankLoan } from '../../workbook/domain/bankLoan'
import { EXTRA_PAYMENT_EFFECTS } from '../../workbook/domain/extraPayment'
import type { ExtraPayment } from '../../workbook/domain/extraPayment'
import { EXTRA_PAYMENT_RECORDS } from '../../workbook/domain/loanKinds'
import type { RatePeriod } from '../../workbook/domain/ratePeriod'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { dayMonthsLater } from '../../../../shared/calendar/monthKey'
import { subtractMoney, sumMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import { recordIdOf } from '../../../../shared/storage/domain/recordId'

/** How long after the subsidy's last covered instalment repaying early still means paying the subsidy back, by the APN loan contract. */
const SUBSIDY_REPAID_WITHIN_MONTHS = 24

/** What one effect of an extra payment does to the plan, against the plan without it. */
export interface ExtraPaymentOutcome {
  readonly effect: ExtraPayment['effect']
  readonly payoff: CivilDate | null
  /** Instalments the plan no longer has. */
  readonly monthsSaved: number
  readonly interestSaved: Money
  /** The first instalment after the payment, or null once the payment repays the loan. */
  readonly nextInstalment: Money | null
}

export interface WhatIfExtraPayment {
  readonly outcomes: readonly ExtraPaymentOutcome[]
  /** The last day on which an early repayment means paying the subsidy back, or null when the payment falls after it or the loan has no subsidy. */
  readonly subsidyRepaidUntil: CivilDate | null
}

function instalmentCount(plan: readonly PlanRow[]): number {
  return plan.filter((row) => row.kind === 'instalment').length
}

function interestOf(plan: readonly PlanRow[]): Money {
  return sumMoney(plan.map((row) => row.interest))
}

/**
 * What an extra payment of the amount on the day would do with each effect, against the plan as it
 * stands, without saving anything. A payment up to 24 months after the subsidy's last covered
 * instalment means paying the subsidy back.
 */
export function whatIfExtraPayment(loan: BankLoan, periods: readonly RatePeriod[], extraPayments: readonly ExtraPayment[], date: CivilDate, amount: Money): WhatIfExtraPayment {
  const before = loanPlan(loan, periods, extraPayments)
  const outcomes = EXTRA_PAYMENT_EFFECTS.map((effect): ExtraPaymentOutcome => {
    const extra: ExtraPayment = { id: recordIdOf(EXTRA_PAYMENT_RECORDS, 'what-if'), loan: loan.id, date, amount, effect }
    const after = loanPlan(loan, periods, [...extraPayments, extra])
    return {
      effect,
      payoff: payoffDate(after),
      monthsSaved: instalmentCount(before) - instalmentCount(after),
      interestSaved: subtractMoney(interestOf(before), interestOf(after)),
      nextInstalment: after.find((row) => row.kind === 'instalment' && row.date > date)?.payment ?? null,
    }
  })
  const lastCovered = subsidyLastCovered(loan)
  const repaidUntil = lastCovered === null ? null : dayMonthsLater(lastCovered, SUBSIDY_REPAID_WITHIN_MONTHS)
  return { outcomes, subsidyRepaidUntil: repaidUntil !== null && date <= repaidUntil ? repaidUntil : null }
}
