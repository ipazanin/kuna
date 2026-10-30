import { describe, expect, it } from 'vitest'

import { effectiveRate, offerEks } from '../src/apps/loans/scenarios/domain/effectiveRate'
import { NO_COSTS } from '../src/apps/loans/scenarios/domain/loanScenario'
import type { OfferTerms } from '../src/apps/loans/scenarios/domain/loanScenario'
import { offerBase, scenarioPlan } from '../src/apps/loans/scenarios/domain/scenarioPlan'
import type { ScenarioPlan } from '../src/apps/loans/scenarios/domain/scenarioPlan'
import { civil, euros } from './fixtures/ledger'
import { percent } from './fixtures/loans'

function offerPlan(terms: OfferTerms, rate: string): ScenarioPlan {
  const plan = scenarioPlan(offerBase('Offer', terms), [{ kind: 'rate-change', from: terms.firstInstalment, rate: percent(rate), rateType: 'fixed' }], null)
  if ('refused' in plan) throw new Error(`The offer is refused: ${plan.refused}`)
  return plan
}

describe("Kuna's estimate of the effective rate", () => {
  // HPB's 2025 representative examples: 120,000.00 drawn on 1 January, a month of interim interest on 1 February, 360 instalments
  // from 1 March, a 2.00 payment order up front and 33.18 of property insurance at the start of each of the 30 years. The client
  // rates, 0.60 points lower, add the 1.89 monthly account fee from the interim interest on, 361 payments. The insured rates, 0.20
  // points lower, add 4.56% credit protection up front, 5,472.00.
  it.each([
    ['2.89', 289, true, true, '3.38'],
    ['3.09', 309, true, false, '3.21'],
    ['3.49', 349, false, true, '3.98'],
    ['3.69', 369, false, false, '3.8'],
  ])("gives HPB's printed EKS for its example at %s%% (interim %s, client %s, insured %s): %s%%", (rate, interim, client, insured, eks) => {
    const terms: OfferTerms = {
      lender: 'HPB',
      principal: euros(120_000),
      drawdown: civil('2025-01-01'),
      firstInstalment: civil('2025-03-01'),
      instalments: 360,
      interimInterest: { amount: euros(interim), date: civil('2025-02-01') },
      subsidy: null,
      costs: { upfront: euros(insured ? 5474 : 2), monthly: euros(client ? 1.89 : 0), yearly: euros(33.18) },
      bankEks: null,
    }
    const plan = offerPlan(terms, rate)

    expect(plan.costs).toHaveLength(1 + (client ? 361 : 0) + 30)
    expect(effectiveRate(terms.principal, terms.drawdown, plan.rows, plan.costs)).toBe(percent(eks))
  })

  it('puts a cost-free 3.00% loan at 3.04%, the monthly rate compounded over the year', () => {
    // (1 + 0.03 / 12)^12 − 1 = 3.0416%, so 3.04%.
    const terms: OfferTerms = {
      lender: 'Example Bank',
      principal: euros(100_000),
      drawdown: civil('2026-01-05'),
      firstInstalment: civil('2026-02-05'),
      instalments: 240,
      interimInterest: null,
      subsidy: null,
      costs: NO_COSTS,
      bankEks: null,
    }
    const plan = offerPlan(terms, '3')

    expect(effectiveRate(terms.principal, terms.drawdown, plan.rows, plan.costs)).toBe(percent('3.04'))
  })

  it('works an offer out as signed, so an extra payment you plan leaves the estimate where it was', () => {
    const terms: OfferTerms = {
      lender: 'Example Bank',
      principal: euros(100_000),
      drawdown: civil('2026-01-05'),
      firstInstalment: civil('2026-02-05'),
      instalments: 240,
      interimInterest: null,
      subsidy: null,
      costs: { upfront: euros(1000), monthly: euros(0), yearly: euros(0) },
      bankEks: null,
    }
    const rate = { kind: 'rate-change', from: terms.firstInstalment, rate: percent('3'), rateType: 'fixed' } as const
    const plan = offerPlan(terms, '3')
    const signed = offerEks(offerBase('Offer', terms), [rate])

    expect(signed).toBe(effectiveRate(terms.principal, terms.drawdown, plan.rows, plan.costs))
    expect(offerEks(offerBase('Offer', terms), [rate, { kind: 'extra-payment', date: civil('2027-02-05'), amount: euros(20_000), effect: 'shorter-term' }])).toBe(signed)
  })

  it('counts the full instalment a subsidy pays part of, as the bank does', () => {
    const terms: OfferTerms = {
      lender: 'Example Bank',
      principal: euros(100_000),
      drawdown: civil('2026-01-05'),
      firstInstalment: civil('2026-02-05'),
      instalments: 240,
      interimInterest: null,
      subsidy: { monthly: euros(200), firstInstalment: 1, instalments: 60, payer: 'APN' },
      costs: NO_COSTS,
      bankEks: null,
    }
    const plan = offerPlan(terms, '3')

    expect(effectiveRate(terms.principal, terms.drawdown, plan.rows, plan.costs)).toBe(percent('3.04'))
  })
})
