import { describe, expect, it } from 'vitest'

import { leftOver } from '../src/apps/loans/scenarios/domain/leftOver'
import { NO_COSTS } from '../src/apps/loans/scenarios/domain/loanScenario'
import type { OfferTerms } from '../src/apps/loans/scenarios/domain/loanScenario'
import { offerBase, scenarioPlan } from '../src/apps/loans/scenarios/domain/scenarioPlan'
import type { ScenarioPlan } from '../src/apps/loans/scenarios/domain/scenarioPlan'
import { civil, euros } from './fixtures/ledger'
import { percent } from './fixtures/loans'

function loanOver(instalments: number): ScenarioPlan {
  const terms: OfferTerms = {
    lender: 'Example Bank',
    principal: euros(150_000),
    drawdown: civil('2026-01-05'),
    firstInstalment: civil('2026-02-05'),
    instalments,
    interimInterest: null,
    subsidy: null,
    repayment: 'annuity',
    costs: NO_COSTS,
    bankEks: null,
  }
  const plan = scenarioPlan(offerBase('Offer', terms), [{ kind: 'rate-change', from: terms.firstInstalment, rate: percent('3.5'), rateType: 'fixed' }], null)
  if ('refused' in plan) throw new Error(`The offer is refused: ${plan.refused}`)
  return plan
}

describe('what a scenario leaves you, at what your savings earn', () => {
  // 150,000.00 at 3.5% over 20 years (869.94 a month) or 30 years (673.57). With the 30-year loan you could save the 196.37
  // difference each month, and after 20 years it still owes 68,114.58.
  const twenty = loanOver(240)
  const thirty = loanOver(360)

  it.each([
    ['2', -10_225.36],
    ['3.5', 0.11],
    ['5', 12_600.07],
  ])('leaves the 30-year loan, against the 20-year one, %s%% savings: %s', (savings, ahead) => {
    expect(leftOver([twenty, thirty], twenty, percent(savings))).toEqual([0, euros(ahead)])
  })

  it('takes the horizon from the earliest payoff, whichever is the base', () => {
    expect(leftOver([twenty, thirty], thirty, percent('2'))).toEqual([euros(10_225.36), 0])
  })

  it('rounds half a cent the same way whichever scenario is ahead', () => {
    const planOf = (rows: readonly { date: string; yourShare: number }[]) =>
      ({ loan: { principal: 0 }, costs: [], rows: rows.map((row) => ({ date: civil(row.date), yourShare: row.yourShare, balance: 0 })) }) as unknown as ScenarioPlan
    const paysEarly = planOf([
      { date: '2026-01-01', yourShare: 8 },
      { date: '2026-02-01', yourShare: 0 },
    ])
    const paysNothing = planOf([{ date: '2026-02-01', yourShare: 0 }])
    // At 75% a year a month grows by exactly 6.25%, so 8 cents paid a month before the horizon cost 8.5 cents.
    expect(leftOver([paysEarly, paysNothing], paysEarly, percent('75'))).toEqual([0, 9])
    expect(leftOver([paysEarly, paysNothing], paysNothing, percent('75'))).toEqual([-9, 0])
  })
})
