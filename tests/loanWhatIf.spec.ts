import { describe, expect, it } from 'vitest'

import { loanPlan } from '../src/apps/loans/bankLoans/domain/loanPlan'
import { whatIfExtraPayment } from '../src/apps/loans/bankLoans/domain/whatIf'
import { sumMoney, subtractMoney } from '../src/shared/money/money'
import { civil, euros } from './fixtures/ledger'
import { bankLoan, extraPayment, ratePeriod } from './fixtures/loans'

describe('what an extra payment would do', () => {
  const loan = bankLoan()
  const periods = [ratePeriod(loan, '2026-02-05', '12')]

  it('shows a shorter term and a lower instalment side by side, against the plan as it stands', () => {
    const { outcomes, subsidyRepaidUntil } = whatIfExtraPayment(loan, periods, [], civil('2026-07-05'), euros(300))
    const interestOf = (effect: 'shorter-term' | 'lower-instalment') => sumMoney(loanPlan(loan, periods, [extraPayment(loan, '2026-07-05', 300, effect)]).map((row) => row.interest))
    const interestBefore = sumMoney(loanPlan(loan, periods, []).map((row) => row.interest))

    // As the plan specs work out: a shorter term ends with instalment 10 on 2026-11-05, two fewer, and a lower instalment pays 54.85 to the end.
    expect(outcomes).toEqual([
      { effect: 'shorter-term', payoff: civil('2026-11-05'), monthsSaved: 2, interestSaved: subtractMoney(interestBefore, interestOf('shorter-term')), nextInstalment: euros(106.62) },
      { effect: 'lower-instalment', payoff: civil('2027-01-05'), monthsSaved: 0, interestSaved: subtractMoney(interestBefore, interestOf('lower-instalment')), nextInstalment: euros(54.85) },
    ])
    expect(subsidyRepaidUntil).toBeNull()
  })

  it('warns up to 24 months after the subsidy’s last covered instalment, and not after', () => {
    const subsidised = bankLoan({ instalments: 60, subsidy: { monthly: euros(10), firstInstalment: 1, instalments: 12 } })
    const at = [ratePeriod(subsidised, '2026-02-05', '12')]

    // Instalment 12 falls due on 2027-01-05, so the window runs to 2029-01-05.
    expect(whatIfExtraPayment(subsidised, at, [], civil('2029-01-05'), euros(100)).subsidyRepaidUntil).toBe(civil('2029-01-05'))
    expect(whatIfExtraPayment(subsidised, at, [], civil('2029-01-06'), euros(100)).subsidyRepaidUntil).toBeNull()
  })
})
