import { subsidyRepaidUntil } from './loanFigures'
import { NO_COSTS } from '../../scenarios/domain/loanScenario'
import { scenarioOutcome } from '../../scenarios/domain/scenarioOutcome'
import { asItStands, scenarioPlan } from '../../scenarios/domain/scenarioPlan'
import { EXTRA_PAYMENT_EFFECTS } from '../../workbook/domain/extraPayment'
import type { ExtraPayment } from '../../workbook/domain/extraPayment'
import type { BankLoanBook } from '../../workbook/domain/readLoanBook'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { subtractMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'

/** What one effect of an extra payment does to the plan, against the plan without it. */
export interface ExtraPaymentOutcome {
  readonly effect: ExtraPayment['effect']
  readonly payoff: CivilDate | null
  /** Instalments the plan no longer has. */
  readonly monthsSaved: number
  /** The interest you no longer pay, leaving out what the subsidy would have paid. */
  readonly interestSaved: Money
  /** The first instalment after the payment, or null once the payment repays the loan. */
  readonly nextInstalment: Money | null
}

export interface WhatIfExtraPayment {
  readonly outcomes: readonly ExtraPaymentOutcome[]
  /** The last day on which an early repayment means paying the subsidy back, or null when the payment falls after it or the loan has no subsidy. */
  readonly subsidyRepaidUntil: CivilDate | null
}

/**
 * What an extra payment of the amount on the day would do with each effect, against the plan as it
 * stands, without saving anything. Each is a scenario of one extra payment. Null while the loan's
 * plan cannot be worked out.
 */
export function whatIfExtraPayment(book: BankLoanBook, date: CivilDate, amount: Money): WhatIfExtraPayment | null {
  const before = asItStands(book)
  if (before === null) return null
  const stands = scenarioOutcome(before, null)
  const outcomes = EXTRA_PAYMENT_EFFECTS.flatMap((effect): ExtraPaymentOutcome[] => {
    const tried = scenarioPlan({ ...book, costs: NO_COSTS }, [{ kind: 'extra-payment', date, amount, effect }], null)
    if ('refused' in tried) return []
    const after = scenarioOutcome(tried, null)
    return [
      {
        effect,
        payoff: after.payoff,
        monthsSaved: stands.instalments - after.instalments,
        interestSaved: subtractMoney(stands.interest, after.interest),
        nextInstalment: tried.rows.find((row) => row.kind === 'instalment' && row.date > date)?.payment ?? null,
      },
    ]
  })
  const repaidUntil = subsidyRepaidUntil(book.loan)
  return { outcomes, subsidyRepaidUntil: repaidUntil !== null && date <= repaidUntil ? repaidUntil : null }
}
