import { describe, expect, it } from 'vitest'

import type { YearEndLine } from '../src/features/workbook/domain/yearEnd'
import { accrualYear } from '../src/packs/hr-doo/domain/accrual/accrualYear'
import { compareYearEnd } from '../src/packs/hr-doo/domain/yearEnd/yearEndComparison'
import type { ComparedLine, YearEndComparison } from '../src/packs/hr-doo/domain/yearEnd/yearEndComparison'
import { sumMoney } from '../src/shared/money/money'
import { civil, euros } from './fixtures/ledger'
import { exampleStudio, yearEndLine } from './fixtures/exampleStudio'

function compared(lines: readonly YearEndLine[]): YearEndComparison {
  const workbook = exampleStudio({ yearEndLines: lines })
  return compareYearEnd(workbook, accrualYear(workbook, 2025, { depreciation: { depreciationDoubled: false }, citAdvancesPaid: null }))
}

function line(comparison: YearEndComparison, statement: ComparedLine['statement'], id: string): ComparedLine | undefined {
  return comparison.lines.find((candidate) => candidate.statement === statement && candidate.line === id)
}

describe('compareYearEnd', () => {
  it('sets a line beside the cash view and names the adjustments that lead from one to the other', () => {
    const sales = line(compared([yearEndLine(2025, 'pl', 'sales', 8100)]), 'pl', 'sales')

    // 5,000.00 was paid in 2025, and 8,100.00 delivered.
    expect(sales).toMatchObject({ cash: { amount: euros(5000) }, difference: euros(3100), residual: euros(0), status: 'explained' })
    expect(sales?.explainedBy.map((adjustment) => adjustment.id)).toEqual(['revenue-by-delivery'])
  })

  it('marks a line matched when ours agrees and the cash view has nothing to adjust', () => {
    const comparison = compared([yearEndLine(2025, 'balance', 'tangible-assets', 1600), yearEndLine(2025, 'tax', 'rate', { kind: 'rate', basisPoints: 1000 })])

    expect(line(comparison, 'balance', 'tangible-assets')).toMatchObject({ cash: null, difference: null, residual: euros(0), status: 'matched' })
    expect(line(comparison, 'balance', 'tangible-assets')?.explainedBy.map((adjustment) => adjustment.id)).toEqual(['capital-purchases'])
    expect(line(comparison, 'tax', 'rate')).toMatchObject({ residual: null, status: 'matched' })
  })

  it('marks a line that rests on an accountant’s choice as a judgement', () => {
    const released = line(compared([yearEndLine(2025, 'grant', 'released-in-year', 4900)]), 'grant', 'released-in-year')

    // The grant came in whole as cash, 10,000.00.
    expect(released).toMatchObject({ cash: { amount: euros(10000) }, residual: euros(0), status: 'judgement' })
    expect(released?.explainedBy.map((adjustment) => adjustment.id)).toEqual(['grant-release', 'grant-schedule'])
  })

  it('leaves a line open with its residual, or when a count differs', () => {
    const comparison = compared([yearEndLine(2025, 'pl', 'profit-before-tax', 9000), yearEndLine(2025, 'tax', 'months-of-operation', { kind: 'count', count: 12 })])

    // 9,000.00 against our 8,881.70.
    expect(line(comparison, 'pl', 'profit-before-tax')).toMatchObject({ residual: euros(118.3), status: 'open' })
    expect(line(comparison, 'pl', 'profit-before-tax')?.explainedBy.length).toBeGreaterThan(5)
    expect(line(comparison, 'tax', 'months-of-operation')).toMatchObject({ residual: null, status: 'open' })
  })

  it('lays the cash view on the profit and loss lines so they add up to the cash net', () => {
    const comparison = compared(
      ['sales', 'other-operating-income', 'material-costs', 'personnel-costs', 'other-costs', 'profit-before-tax'].map((id) => yearEndLine(2025, 'pl', id, 0)),
    )
    const cash = (id: string) => line(comparison, 'pl', id)?.cash?.amount ?? euros(0)

    // Equipment 3,250.00, software 175.00 with the advance, fines, car, representation and insurance, less the 500.00 VAT refund.
    expect(cash('material-costs')).toBe(euros(3482.5))
    // Two months of pay and the loan to the owner, which the cash view counts as owner pay.
    expect(cash('personnel-costs')).toBe(euros(2600))
    expect(cash('other-operating-income')).toBe(euros(10000))
    expect(sumMoney([cash('sales'), cash('other-operating-income')]) - sumMoney([cash('material-costs'), cash('personnel-costs'), cash('other-costs')])).toBe(
      cash('profit-before-tax'),
    )
    expect(cash('profit-before-tax')).toBe(euros(8917.5))
  })

  it('records dates and the distribution decision, checked against the ledger where it can be', () => {
    const comparison = compared([
      yearEndLine(2025, 'tax', 'filed-on', { kind: 'date', date: civil('2026-04-28') }),
      yearEndLine(2025, 'tax', 'paid-on', { kind: 'date', date: civil('2026-04-30') }),
      yearEndLine(2025, 'distribution', 'retained', 6981.72),
      yearEndLine(2025, 'distribution', 'dividend', 1000),
    ])

    expect(comparison.recorded.map((entry) => [entry.accountant.line, entry.check?.holds ?? null])).toEqual([
      ['filed-on', null],
      ['paid-on', true],
      ['retained', null],
      // A later decision can pay out what this one kept, so the payout is not checked against the ledger.
      ['dividend', null],
    ])
    expect(comparison.distribution).toEqual({ shared: euros(7981.72), profitAfterTax: euros(7981.72), residual: euros(0) })
    expect(comparison.lines).toEqual([])
  })

  it('finds no payment of our balance due on a day the ledger paid something else', () => {
    const comparison = compared([yearEndLine(2025, 'tax', 'paid-on', { kind: 'date', date: civil('2026-04-29') })])

    expect(comparison.recorded[0]?.check?.holds).toBe(false)
  })

  it('groups konto lines that share a category, beside our figure for those categories', () => {
    const comparison = compared([
      yearEndLine(2025, 'konto', '41800', 78, ['representation']),
      yearEndLine(2025, 'konto', '41801', 2, ['representation']),
      yearEndLine(2025, 'konto', '41000', 150, ['software']),
      yearEndLine(2025, 'konto', '49000', 12),
    ])

    expect(comparison.konto.map((group) => [group.konto.map((entry) => entry.line), group.accountant, group.ours, group.difference])).toEqual([
      [['41800', '41801'], euros(80), euros(80), euros(0)],
      // 100.00 of software without its VAT and the owner's 40.00 advance.
      [['41000'], euros(150), euros(140), euros(10)],
    ])
    expect(comparison.konto[1]?.categories[0]?.drill).not.toBeNull()
    expect(comparison.unnamedKonto.map((entry) => entry.line)).toEqual(['49000'])
  })

  it('adds the small inventory the year wrote off to the category its payment sits in', () => {
    const comparison = compared([yearEndLine(2025, 'konto', '40120', 200, ['equipment'])])

    // The desk, 200.00 without its VAT, paid on equipment and written off when put in use. The laptop went to the asset books.
    expect(comparison.konto.map((group) => [group.ours, group.difference])).toEqual([[euros(200), euros(0)]])
    expect(comparison.konto[0]?.categories.map((figure) => [figure.label, figure.amount])).toEqual([
      ['Equipment', euros(0)],
      ['Equipment, small inventory written off', euros(200)],
    ])
  })
})
