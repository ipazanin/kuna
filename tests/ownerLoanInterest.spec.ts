import { describe, expect, it } from 'vitest'

import { DEFAULT_SETTINGS } from '../src/features/settings/domain/settings'
import type { Workbook } from '../src/features/workbook/domain/workbook'
import { loanBenefit, loanBenefitByYear, relatedPartyInterest, shortfallRate } from '../src/packs/hr-doo/domain/ownerLoanInterest'
import { ruleValue } from '../src/packs/hr-doo/ruleset/ruleset'
import type { Rate } from '../src/packs/hr-doo/ruleset/schema'
import { exampleStudio } from './fixtures/exampleStudio'
import { withPackBuckets } from './fixtures/hrDooCategories'
import { civil, euros, ledger } from './fixtures/ledger'
import type { RowSpec } from './fixtures/ledger'

function studio(rows: readonly RowSpec[], ownerLoanInterest = 0): Workbook {
  const workbook = exampleStudio()
  return exampleStudio({
    transactions: withPackBuckets(ledger(rows), workbook.categories),
    settings: { ...DEFAULT_SETTINGS, companyFacts: { ...DEFAULT_SETTINGS.companyFacts, ownerLoanInterest } },
  })
}

const LENT_ON_NEW_YEAR: readonly RowSpec[] = [{ date: '2025-01-01', amount: -3650, category: 'owner-loan-out' }]

describe('shortfallRate', () => {
  it('is what the loans carry below the prescribed rate, and nothing at or above it', () => {
    expect(shortfallRate(200 as Rate, 0 as Rate)).toBe(200)
    expect(shortfallRate(200 as Rate, 50 as Rate)).toBe(150)
    expect(shortfallRate(200 as Rate, 200 as Rate)).toBe(0)
    expect(shortfallRate(200 as Rate, 250 as Rate)).toBe(0)
  })
})

describe('loanBenefit', () => {
  it('is 2% a year on each day the loan is owed, from the day after it was lent', () => {
    const benefit = loanBenefit(studio(LENT_ON_NEW_YEAR), 2025, civil('2025-12-31'), ruleValue)

    // 3,650.00 owed from 2 January to 31 December is 364 days: 3,650.00 × 2% × 364 / 365 = 72.80.
    expect(benefit?.figure.amount).toBe(euros(72.8))
    expect(benefit).toMatchObject({ year: 2025, prescribed: 200, carried: 0, loans: 1 })
    expect(benefit?.figure.steps.map((step) => [step.label, step.on, step.amount])).toEqual([['364 days owed in 2025 on the loan of', civil('2025-01-01'), euros(72.8)]])
    expect(benefit?.figure.rules.map((citation) => citation.ruleId)).toEqual(['hr.pit.loan-benefit'])
  })

  it('takes off the rate the loans carry, and gives nothing once they carry the prescribed rate', () => {
    // 3,650.00 × (2% − 0.5%) × 364 / 365 = 54.60.
    expect(loanBenefit(studio(LENT_ON_NEW_YEAR, 50), 2025, civil('2025-12-31'), ruleValue)?.figure.amount).toBe(euros(54.6))
    expect(loanBenefit(studio(LENT_ON_NEW_YEAR, 200), 2025, civil('2025-12-31'), ruleValue)?.figure.amount).toBe(0)
    expect(loanBenefit(studio(LENT_ON_NEW_YEAR, 250), 2025, civil('2025-12-31'), ruleValue)).toMatchObject({ carried: 250, figure: { amount: 0 } })
  })

  it('follows the balance down as repayments come in', () => {
    const benefit = loanBenefit(
      studio([...LENT_ON_NEW_YEAR, { date: '2025-07-02', amount: 1825, category: 'owner-loan-repaid' }]),
      2025,
      civil('2025-12-31'),
      ruleValue,
    )

    // 3,650.00 for the 182 days to 2 July, then 1,825.00 for the 182 days to 31 December:
    // (3,650.00 × 182 + 1,825.00 × 182) × 2% / 365 = 54.60.
    expect(benefit?.figure.amount).toBe(euros(54.6))
  })

  it('counts a year in progress up to the day given, at the year’s length', () => {
    const benefit = loanBenefit(studio(LENT_ON_NEW_YEAR), 2026, civil('2026-03-01'), ruleValue)

    // 1 January to 1 March 2026 is 60 days: 3,650.00 × 2% × 60 / 365 = 12.00.
    expect(benefit?.figure.amount).toBe(euros(12))
  })

  it('is null for a year no loan had a balance in', () => {
    const repaid = studio([...LENT_ON_NEW_YEAR, { date: '2025-03-01', amount: 3650, category: 'owner-loan-repaid' }])

    expect(loanBenefit(repaid, 2026, civil('2026-12-31'), ruleValue)).toBeNull()
    expect(loanBenefitByYear(repaid, civil('2026-10-01'), ruleValue).map((benefit) => benefit.year)).toEqual([2025])
    expect(loanBenefitByYear(studio(LENT_ON_NEW_YEAR), civil('2026-10-01'), ruleValue).map((benefit) => benefit.year)).toEqual([2026, 2025])
  })
})

describe('relatedPartyInterest', () => {
  it('works out the related-party rate less the rate the loans carry, only with a tax loss', () => {
    const losses = [{ year: 2024, remaining: euros(5000) }]

    // 2025's related-party rate is 4.38%: 3,650.00 × 4.38% × 364 / 365 = 159.43.
    expect(relatedPartyInterest(studio(LENT_ON_NEW_YEAR), 2025, euros(-100), losses, ruleValue).amount).toBe(euros(159.43))
    // Carrying 2%, the shortfall is 2.38%: 3,650.00 × 2.38% × 364 / 365 = 86.63.
    expect(relatedPartyInterest(studio(LENT_ON_NEW_YEAR, 200), 2025, euros(-100), losses, ruleValue).amount).toBe(euros(86.63))
    expect(relatedPartyInterest(studio(LENT_ON_NEW_YEAR), 2025, euros(100), [], ruleValue).amount).toBe(0)
  })
})
