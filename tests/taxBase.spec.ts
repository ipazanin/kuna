import { describe, expect, it } from 'vitest'

import { lossesCarriedInto, taxBase } from '../src/packs/hr-doo/domain/cit/taxBase'
import type { TaxBaseInput } from '../src/packs/hr-doo/domain/cit/taxBase'
import { tracedFigure } from '../src/packs/hr-doo/domain/payroll/payrollArithmetic'
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
    expect(
      increase(taxBase(input({ relatedPartyInterestShortfall: shortfall, lossesBroughtForward: [{ year: 2025, remaining: euros(5000) }] })), 'PD lines 16 and 25'),
    ).toBe(euros(40))
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
