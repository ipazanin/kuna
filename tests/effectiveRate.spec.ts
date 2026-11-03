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
      repayment: 'annuity',
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
      repayment: 'annuity',
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
      repayment: 'annuity',
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
      repayment: 'annuity',
      costs: NO_COSTS,
      bankEks: null,
    }
    const plan = offerPlan(terms, '3')

    expect(effectiveRate(terms.principal, terms.drawdown, plan.rows, plan.costs)).toBe(percent('3.04'))
  })

  describe('on 100,000.00 at 4% over 120 months', () => {
    const terms = (repayment: OfferTerms['repayment'], upfront: number): OfferTerms => ({
      lender: 'Example Bank',
      principal: euros(100_000),
      drawdown: civil('2026-01-05'),
      firstInstalment: civil('2026-02-05'),
      instalments: 120,
      interimInterest: null,
      subsidy: null,
      repayment,
      costs: { upfront: euros(upfront), monthly: euros(0), yearly: euros(0) },
      bankEks: null,
    })
    const eksOf = (offer: OfferTerms) => {
      const plan = offerPlan(offer, '4')
      return effectiveRate(offer.principal, offer.drawdown, plan.rows, plan.costs)
    }

    it('gives 4.07% for an annuity and for equal principal with no costs', () => {
      // (1 + 0.04 / 12)^12 − 1 = 4.0742%, whatever the instalments are.
      expect(eksOf(terms('annuity', 0))).toBe(percent('4.07'))
      expect(eksOf(terms('equal-principal', 0))).toBe(percent('4.07'))
    })

    it('puts 1,000.00 up front a little higher on equal principal, which repays faster', () => {
      expect(eksOf(terms('annuity', 1000))).toBe(percent('4.3'))
      expect(eksOf(terms('equal-principal', 1000))).toBe(percent('4.31'))
    })
  })
})
