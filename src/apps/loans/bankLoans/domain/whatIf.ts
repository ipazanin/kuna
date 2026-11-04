import { ratePeriodOn, subsidyRepaidUntil } from './loanFigures'
import type { YearlyRate } from './yearlyRate'
import { NO_COSTS, changeDate } from '../../scenarios/domain/loanScenario'
import type { LoanChange } from '../../scenarios/domain/loanScenario'
import { scenarioOutcome } from '../../scenarios/domain/scenarioOutcome'
import { asItStands, scenarioPlan } from '../../scenarios/domain/scenarioPlan'
import { EXTRA_PAYMENT_EFFECTS } from '../../workbook/domain/extraPayment'
import type { ExtraPayment } from '../../workbook/domain/extraPayment'
import type { BankLoanBook } from '../../workbook/domain/readLoanBook'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { subtractMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'

/** What one change does to the plan, against the plan without it. */
export interface TriedOutcome {
  readonly payoff: CivilDate | null
  /** Instalments the plan no longer has. */
  readonly monthsSaved: number
  /** The interest you no longer pay, leaving out what the subsidy would have paid. Below zero when you pay more. */
  readonly interestSaved: Money
  /** The first instalment the change reaches, or null once it repays the loan. */
  readonly nextInstalment: Money | null
}

/** What one effect of an extra payment does to the plan. */
export interface ExtraPaymentOutcome extends TriedOutcome {
  readonly effect: ExtraPayment['effect']
}

export interface WhatIfExtraPayment {
  readonly outcomes: readonly ExtraPaymentOutcome[]
  /** The last day on which an early repayment means paying the subsidy back, or null when the payment falls after it or the loan has no subsidy. */
  readonly subsidyRepaidUntil: CivilDate | null
}

/**
 * What one change would do against the plan as it stands, without saving anything, as a scenario of
 * that change. An extra payment reaches the instalments after its day, a rate or term change the one
 * due on its day. Null while the loan's plan, or the tried one, cannot be worked out.
 */
export function whatIfChange(book: BankLoanBook, change: LoanChange): TriedOutcome | null {
  const before = asItStands(book)
  if (before === null) return null
  const tried = scenarioPlan({ ...book, costs: NO_COSTS }, [change], null)
  if ('refused' in tried) return null
  const stands = scenarioOutcome(before, null)
  const after = scenarioOutcome(tried, null)
  const day = changeDate(change)
  const reached = (date: CivilDate): boolean => (change.kind === 'extra-payment' ? date > day : date >= day)
  return {
    payoff: after.payoff,
    monthsSaved: stands.instalments - after.instalments,
    interestSaved: subtractMoney(stands.interest, after.interest),
    nextInstalment: tried.rows.find((row) => row.kind === 'instalment' && reached(row.date))?.payment ?? null,
  }
}

/** What an extra payment of the amount on the day would do with each effect. Null while the loan's plan cannot be worked out. */
export function whatIfExtraPayment(book: BankLoanBook, date: CivilDate, amount: Money): WhatIfExtraPayment | null {
  if (book.plan === null) return null
  const outcomes = EXTRA_PAYMENT_EFFECTS.flatMap((effect): ExtraPaymentOutcome[] => {
    const outcome = whatIfChange(book, { kind: 'extra-payment', date, amount, effect })
    return outcome === null ? [] : [{ ...outcome, effect }]
  })
  const repaidUntil = subsidyRepaidUntil(book.loan)
  return { outcomes, subsidyRepaidUntil: repaidUntil !== null && date <= repaidUntil ? repaidUntil : null }
}

/** A new rate from a due date on, fixed or variable as the rate in force then is, since a reset keeps the loan's kind of rate. */
export function triedRate(book: BankLoanBook, from: CivilDate, rate: YearlyRate): Extract<LoanChange, { readonly kind: 'rate-change' }> {
  return { kind: 'rate-change', from, rate, rateType: ratePeriodOn(book.ratePeriods, from)?.rateType ?? 'fixed' }
}
