import { describe, expect, it } from 'vitest'

import { donationsOfYear, lossesCarriedInto, taxBase } from '../src/apps/company/packs/hr-doo/domain/cit/taxBase'
import type { TaxBaseInput } from '../src/apps/company/packs/hr-doo/domain/cit/taxBase'
import { tracedFigure } from '../src/apps/company/packs/hr-doo/domain/payroll/payrollArithmetic'
import type { RuleSource } from '../src/apps/company/packs/hr-doo/domain/payroll/payrollArithmetic'
import { ruleValue } from '../src/apps/company/packs/hr-doo/ruleset/ruleset'
import { basisPoints, text } from '../src/apps/company/packs/hr-doo/ruleset/schema'
import { parseCivilDate } from '../src/shared/calendar/civilDate'
import { yearEndLine } from './fixtures/exampleStudio'
import { euros } from './fixtures/ledger'

function figure(amount: number) {
  return tracedFigure('Example', euros(amount), 'ledger', [])
}

function input(changes: Partial<TaxBaseInput> = {}): TaxBaseInput {
  return {
    year: 2026,
    revenue: figure(50000),
    expenses: figure(30000),
    representation: figure(0),
    personalTransport: figure(0),
    carDepreciationAllowed: figure(0),
    nonDeductible: figure(0),
    depreciationAboveAllowed: figure(0),
    relatedPartyInterestShortfall: figure(0),
    lossesBroughtForward: [],
    ...changes,
  }
}

function increase(base: ReturnType<typeof taxBase>, label: string) {
  return base.increases.steps.find((step) => step.label.startsWith(label))?.amount
}

describe('taxBase', () => {
  it('starts from accounting profit and adds back half of representation with its VAT', () => {
    const base = taxBase(input({ representation: figure(121) }))

    expect(base.profitBeforeTax.amount).toBe(euros(20000))
    expect(increase(base, 'PD line 6')).toBe(euros(60.5))
    expect(base.base.amount).toBe(euros(20060.5))
    expect(base.increases.rules.map((citation) => citation.ruleId)).toContain('hr.cit.representation-add-back')
  })

  it('rounds the deductible half and adds back the rest', () => {
    // Half of 100.01 is 50.005, so 50.01 is deductible and 50.00 added back.
    expect(increase(taxBase(input({ representation: figure(100.01) })), 'PD line 6')).toBe(euros(50))
  })

  it('adds back half of personal transport, all fines and private costs, and depreciation above the caps', () => {
    const base = taxBase(input({ personalTransport: figure(300), nonDeductible: figure(75), depreciationAboveAllowed: figure(120) }))

    expect(increase(base, 'PD line 7')).toBe(euros(150))
    expect(increase(base, 'PD lines 9, 11 and 24')).toBe(euros(75))
    expect(increase(base, 'PD line 18')).toBe(euros(120))
    expect(base.increases.amount).toBe(euros(345))
  })

  it('sets losses off oldest first, drops one older than five years and carries the rest', () => {
    const base = taxBase(
      input({
        year: 2031,
        revenue: figure(1600),
        expenses: figure(1000),
        lossesBroughtForward: [
          { year: 2027, remaining: euros(200) },
          { year: 2025, remaining: euros(300) },
          { year: 2026, remaining: euros(500) },
        ],
      }),
    )

    expect(base.lossesUsed.steps.map((step) => [step.label, step.amount])).toEqual([
      ['Loss of 2026 set off', euros(500)],
      ['Loss of 2027 set off', euros(100)],
    ])
    expect(base.base.amount).toBe(euros(0))
    expect(base.lossesCarried).toEqual([{ year: 2027, remaining: euros(100) }])
  })

  it('carries a loss of the year forward', () => {
    const base = taxBase(input({ revenue: figure(1000), expenses: figure(1500) }))

    expect(base.base.amount).toBe(euros(-500))
    expect(base.lossesCarried).toEqual([{ year: 2026, remaining: euros(500) }])
  })

  it('adds the related-party interest shortfall only while the company has a loss to carry forward', () => {
    const shortfall = figure(40)

    expect(increase(taxBase(input({ relatedPartyInterestShortfall: shortfall })), 'PD lines 16 and 25')).toBe(euros(0))
    expect(increase(taxBase(input({ relatedPartyInterestShortfall: shortfall, lossesBroughtForward: [{ year: 2025, remaining: euros(5000) }] })), 'PD lines 16 and 25')).toBe(euros(40))
  })
})

describe('taxBase with donations and sponsorships', () => {
  const donated = (amount: number, revenueYearBefore: number | null = null) => ({ given: figure(amount), revenueYearBefore: revenueYearBefore === null ? null : figure(revenueYearBefore) })

  it('shows no donation or sponsorship line while no category carries the class', () => {
    const base = taxBase(input())

    expect(base.increases.steps.map((step) => step.label)).not.toContainEqual(expect.stringMatching(/^PD line 14/))
    expect(base.decreases.steps).toEqual([])
    expect(base.decreases.label).toBe('PD line 35, decreases: none recorded')
  })

  it('adds back the donations above 2% of the revenue of whichever year allows more', () => {
    // 2% of this year's 50,000.00 is 1,000.00, more than 2% of last year's 40,000.00, so 1,200.00 given leaves 200.00.
    expect(increase(taxBase(input({ donations: donated(1200, 40000) })), 'PD line 14')).toBe(euros(200))
    // 2% of last year's 60,000.00 is 1,200.00, so all of it is allowed.
    expect(increase(taxBase(input({ donations: donated(1200, 60000) })), 'PD line 14')).toBe(euros(0))
  })

  it("takes a first year's cap from its own revenue, and adds nothing back under the cap", () => {
    expect(increase(taxBase(input({ donations: donated(1500) })), 'PD line 14')).toBe(euros(500))
    expect(increase(taxBase(input({ donations: donated(800) })), 'PD line 14')).toBe(euros(0))
  })

  it('rounds the cap once, to the cent, and names the year it is taken from', () => {
    // 2% of 76,765.34 is 1,535.3068, so the cap is 1,535.31 and 3,000.00 given leaves 1,464.69.
    const base = taxBase(input({ revenue: figure(76765.34), donations: donated(3000, 59197.37) }))
    const line = base.increases.steps.find((step) => step.label.startsWith('PD line 14'))!

    expect(line.amount).toBe(euros(1464.69))
    expect(line.steps.map((step) => step.label)).toEqual(['Example', 'The cap, 2% of 2026 revenue, the higher year'])
    expect(taxBase(input({ donations: donated(1200, 60000) })).increases.steps.find((step) => step.label.startsWith('PD line 14'))!.steps[1]!.label).toBe(
      'The cap, 2% of 2025 revenue, the higher year',
    )
    expect(taxBase(input({ donations: donated(1500) })).increases.steps.find((step) => step.label.startsWith('PD line 14'))!.steps[1]!.label).toBe('The cap, 2% of 2026 revenue')
  })

  it('takes listed sponsorships off the base from 2026, and only shows them in 2025', () => {
    const base = taxBase(input({ listedSponsorships: figure(1000) }))

    expect(base.decreases.amount).toBe(euros(1000))
    expect(base.decreases.steps.map((step) => step.label)).toEqual(['PD line 33.a, sponsorships to recipients on a ministry list'])
    expect(base.base.amount).toBe(euros(19000))
    const in2025 = taxBase(input({ year: 2025, listedSponsorships: figure(1000) }))
    expect(in2025.decreases.amount).toBe(euros(0))
    expect(in2025.decreases.steps.map((step) => step.label)).toEqual(['PD line 33.a, sponsorships to recipients on a ministry list: no decrease in 2025'])
  })

  it('refuses a donation rule that reads its revenue another way, and fines and private costs that add back different shares', () => {
    const changed =
      (id: 'hr.cit.donation-cap' | 'hr.cit.fines-add-back', change: Record<string, unknown>): RuleSource =>
      (rule, on) => {
        const lookup = ruleValue(rule, on)
        return rule === id ? ({ ...lookup, value: { ...lookup.value, ...change } } as typeof lookup) : lookup
      }

    expect(() => taxBase(input({ donations: donated(100) }), changed('hr.cit.donation-cap', { revenueBasis: text('prior-period') }))).toThrow(RangeError)
    expect(() => taxBase(input(), changed('hr.cit.fines-add-back', { addBackShare: basisPoints(5000) }))).toThrow(RangeError)
  })
})

describe('donationsOfYear', () => {
  const given = figure(500)
  const revenueOf = (year: number) => tracedFigure(`Revenue of ${year}`, euros(70000), 'ledger', [])

  it("reads the year before from the accountant's PD line 1, else from Kuna's own figure", () => {
    const filed = donationsOfYear(given, 2026, parseCivilDate('2025-05-12'), [yearEndLine(2025, 'tax', 'revenue', 59197.37)], revenueOf)
    const own = donationsOfYear(given, 2026, parseCivilDate('2025-05-12'), [], revenueOf)

    expect(filed.revenueYearBefore).toMatchObject({ label: 'PD line 1 for 2025, as the accountant filed it', amount: euros(59197.37), basis: 'accountant' })
    expect(own.revenueYearBefore).toMatchObject({ label: 'PD line 1 for 2025, as Kuna counts it', amount: euros(70000) })
  })

  it('reads no year before for a first year or a year with no donations', () => {
    expect(donationsOfYear(given, 2025, parseCivilDate('2025-05-12'), [], revenueOf).revenueYearBefore).toBeNull()
    expect(donationsOfYear(figure(0), 2026, parseCivilDate('2025-05-12'), [], revenueOf).revenueYearBefore).toBeNull()
  })
})

describe('lossesCarriedInto', () => {
  it('reads a loss from an earlier PD and takes off what a later year set against it', () => {
    const lines = [
      yearEndLine(2025, 'tax', 'tax-base', -1000),
      yearEndLine(2026, 'tax', 'revenue', 5000),
      yearEndLine(2026, 'tax', 'expenses', 4600),
      yearEndLine(2026, 'tax', 'increases', 0),
      yearEndLine(2026, 'tax', 'decreases', 0),
      yearEndLine(2026, 'tax', 'tax-base', 0),
    ]

    expect(lossesCarriedInto(2027, lines)).toEqual([{ year: 2025, remaining: euros(600) }])
    expect(lossesCarriedInto(2026, lines)).toEqual([{ year: 2025, remaining: euros(1000) }])
  })
})
