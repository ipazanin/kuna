import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { rateOfText } from '../src/apps/loans/bankLoans/domain/yearlyRate'
import type { YearlyRate } from '../src/apps/loans/bankLoans/domain/yearlyRate'
import { offerEks } from '../src/apps/loans/scenarios/domain/effectiveRate'
import { eksAgreement } from '../src/apps/loans/scenarios/domain/eksAgreement'
import type { OfferTerms } from '../src/apps/loans/scenarios/domain/loanScenario'
import { offerBase } from '../src/apps/loans/scenarios/domain/scenarioPlan'
import { offerTexts, typedOffer } from '../src/apps/loans/scenarios/presentation/offerTexts'
import { civil, euros } from './fixtures/ledger'

function rate(text: string): YearlyRate {
  const parsed = rateOfText(text)
  if (parsed === null) throw new Error(`${text} is not a rate`)
  return parsed
}

describe('an offer as typed', () => {
  const blank = offerTexts('', null, [], civil('2026-11-07')).texts

  it('gives the terms and the first rate from the first instalment, a month after the payout', () => {
    const typed = typedOffer({ ...blank, principal: '150000', rate: '3.18', years: '30', bankEks: '3.4' })

    expect(typed.terms).toMatchObject({ principal: euros(150_000), drawdown: '2026-11-07', firstInstalment: '2026-12-07', instalments: 360, bankEks: rate('3.4') })
    expect(typed.rates).toEqual([{ kind: 'rate-change', from: '2026-12-07', rate: rate('3.18'), rateType: 'fixed' }])
  })

  it('adds a variable rate after the fixed years', () => {
    const typed = typedOffer({ ...blank, principal: '150000', rate: '3.18', years: '30', fixedYears: '5', thenVariable: '4.1' })

    expect(typed.rates.map((change) => [change.from, change.rateType])).toEqual([
      ['2026-12-07', 'fixed'],
      ['2031-12-07', 'variable'],
    ])
  })

  it('gives no terms while a field is wrong, and says which', () => {
    const typed = typedOffer({ ...blank, principal: '150000', rate: '3.18', years: '30', bankEks: 'about 3' })

    expect(typed.terms).toBeNull()
    expect(typed.errors.bankEks).not.toBeNull()
    expect(typed.errors.rate).toBeNull()
  })

  it('reads a saved offer back into the same fields', () => {
    const typed = typedOffer({ ...blank, principal: '150000', rate: '3.18', years: '30', fixedYears: '5', thenVariable: '4.1' })
    if (typed.terms === null) throw new Error('expected terms')

    const { texts, later } = offerTexts('Bank A', typed.terms, typed.rates, civil('2027-01-01'))
    expect(texts).toMatchObject({ principal: '150000.00', rate: '3.18', years: '30', months: '0', fixedYears: '5', thenVariable: '4.1', payout: '2026-11-07', name: 'Bank A' })
    expect(later).toEqual([])
  })
})

describe("Kuna's EKS against the printed one", () => {
  it.each([
    ['3.49', 'agrees'],
    ['3.5', 'agrees'],
    ['3.51', 'differs'],
    ['3.31', 'agrees'],
    ['3.3', 'agrees'],
    ['3.29', 'differs'],
  ])('with Kuna at 3.4 and the bank at %s, %s', (printed, kind) => {
    expect(eksAgreement(rate('3.4'), rate(printed)).kind).toBe(kind)
  })

  it('names both rates and the points between them when they differ', () => {
    expect(eksAgreement(rate('4.4'), rate('3.4'))).toEqual({ kind: 'differs', estimated: rate('4.4'), printed: rate('3.4'), points: 1 })
  })

  it('compares nothing while either is missing', () => {
    expect(eksAgreement(null, rate('3.4'))).toEqual({ kind: 'not-compared' })
    expect(eksAgreement(rate('3.4'), null)).toEqual({ kind: 'not-compared' })
  })

  it("warns on the wrong-EKS offer fixture, whose printed EKS is a point under Kuna's for its terms", () => {
    const offer = JSON.parse(readFileSync(join(import.meta.dirname, 'fixtures', 'documents', 'offer-wrong-eks.json'), 'utf8')) as Record<string, string>
    const terms: OfferTerms = {
      lender: offer['lender']!,
      principal: euros(Number(offer['principal'])),
      drawdown: civil(offer['drawdown']!),
      firstInstalment: civil(offer['firstInstalment']!),
      instalments: Number(offer['instalments']),
      interimInterest: null,
      subsidy: null,
      repayment: 'annuity',
      costs: { upfront: euros(Number(offer['upfront'])), monthly: euros(0), yearly: euros(0) },
      bankEks: rate(offer['printedEks']!),
    }
    const estimated = offerEks(offerBase('Offer', terms), [{ kind: 'rate-change', from: terms.firstInstalment, rate: rate(offer['rate']!), rateType: 'fixed' }])

    expect(estimated).toBe(rate(offer['kunaEks']!))
    expect(eksAgreement(estimated, terms.bankEks)).toMatchObject({ kind: 'differs', points: 1 })
  })
})
