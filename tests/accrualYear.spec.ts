import { describe, expect, it } from 'vitest'

import type { YearEndLine } from '../src/packs/hr-doo/domain/yearEnd/yearEnd'
import type { AccrualAdjustment, AdjustmentId } from '../src/packs/hr-doo/domain/accrual/accrualAdjustment'
import { accrualLine, accrualYear } from '../src/packs/hr-doo/domain/accrual/accrualYear'
import type { AccrualYear } from '../src/packs/hr-doo/domain/accrual/accrualYear'
import type { HrDooWorkbook } from '../src/packs/hr-doo/domain/hrDooPart'
import { sumMoney } from '../src/shared/money/money'
import type { Money } from '../src/shared/money/money'
import { STUDIO_CATEGORIES, exampleStudio, yearEndLine } from './fixtures/exampleStudio'
import { euros } from './fixtures/ledger'

function accrual(year: number, workbook: HrDooWorkbook = exampleStudio()): AccrualYear {
  return accrualYear(workbook, year, { depreciation: { depreciationDoubled: false }, citAdvancesPaid: null })
}

function step(result: AccrualYear, id: AdjustmentId): AccrualAdjustment | undefined {
  return result.adjustments.find((adjustment) => adjustment.id === id)
}

function amountOfStep(result: AccrualYear, id: AdjustmentId): Money | undefined {
  return step(result, id)?.figure.amount
}

function lineAmount(result: AccrualYear, statement: 'pl' | 'balance' | 'tax' | 'grant', line: string): Money | null {
  const found = accrualLine(result, statement, line)
  return found?.kind === 'money' ? found.figure.amount : null
}

function bridgeTotal(result: AccrualYear): Money {
  return sumMoney([result.bridge.cashNet.amount, ...result.bridge.steps.map((entry) => entry.figure.amount)])
}

describe('accrualYear, a first tax period', () => {
  const year = accrual(2025)

  it('bridges the cash net to profit before tax, one adjustment at a time', () => {
    // Bank rows and the owner's advance of 2025 net to 8,917.50.
    expect(year.bridge.cashNet.amount).toBe(euros(8917.5))
    expect(year.bridge.steps.map((entry) => [entry.id, entry.kind, entry.figure.amount])).toEqual([
      ['revenue-by-delivery', 'explained', euros(3100)],
      ['owner-loans', 'explained', euros(1000)],
      ['grant-receipts', 'explained', euros(-10000)],
      ['grant-release', 'explained', euros(5000)],
      ['capital-purchases', 'explained', euros(2600)],
      ['depreciation', 'explained', euros(-800)],
      ['asset-write-offs', 'explained', euros(-200)],
      ['input-vat', 'explained', euros(691.25)],
      ['vat-settlements', 'explained', euros(-500)],
      ['arrears-accrued', 'explained', euros(-1200.05)],
      ['prepaid-spread', 'explained', euros(273)],
    ])
    expect(bridgeTotal(year)).toBe(euros(8881.7))
    expect(year.bridge.profitBeforeTax.amount).toBe(euros(8881.7))
    // No year-end rows, so nothing is held against an accountant.
    expect(year.bridge.unexplainedBeforeTax).toBeNull()
  })

  it('lays the same profit out on the year-end tab lines', () => {
    expect(lineAmount(year, 'pl', 'sales')).toBe(euros(8100))
    expect(lineAmount(year, 'pl', 'other-operating-income')).toBe(euros(5000))
    expect(lineAmount(year, 'pl', 'depreciation')).toBe(euros(800))
    // Pay, payroll tax and rent count by bucket, with no konto lines to say otherwise.
    expect(lineAmount(year, 'pl', 'personnel-costs')).toBe(euros(2800.05))
    // Software 140.00, representation 80.00, insurance 92.00, fines 50.00, car 56.25 and the desk 200.00.
    expect(lineAmount(year, 'pl', 'material-costs')).toBe(euros(618.25))
    expect(lineAmount(year, 'pl', 'profit-before-tax')).toBe(euros(8881.7))
  })

  it('moves a cost paid in arrears back across the year end, and out of the next year', () => {
    const next = accrual(2026)

    expect(step(year, 'arrears-accrued')?.figure.steps.map((entry) => entry.amount)).toEqual([euros(-800), euros(-100), euros(-300), euros(-0.05)])
    expect(amountOfStep(next, 'arrears-reversed')).toBe(euros(1200.05))
    expect(lineAmount(year, 'balance', 'payables-employees')).toBe(euros(1100))
  })

  it('counts revenue by its delivery days, splitting an invoice across the year end', () => {
    const next = accrual(2026)

    expect(lineAmount(year, 'pl', 'sales')).toBe(euros(8100))
    expect(lineAmount(next, 'pl', 'sales')).toBe(euros(3100))
    // Delivered in December on an invoice issued in January: earned, not yet invoiced.
    expect(lineAmount(year, 'balance', 'prepaid-accrued-income')).toBe(euros(3373))
    expect(lineAmount(year, 'balance', 'receivables-trade')).toBe(euros(0))
    expect(year.uninvoicedMonths.map((entry) => entry.month)).toEqual(['2025-04', '2025-05', '2025-06', '2025-07', '2025-08', '2025-09', '2025-10', '2025-11'])
  })

  it('spreads a cost paid ahead over the days it covers, the rest prepaid at the year end', () => {
    const next = accrual(2026)

    expect(amountOfStep(year, 'prepaid-spread')).toBe(euros(273))
    expect(amountOfStep(next, 'prepaid-spread')).toBe(euros(-273))
  })

  it('moves an asset to the books and writes small inventory off when put in use', () => {
    expect(step(year, 'capital-purchases')?.figure.steps.map((entry) => entry.amount)).toEqual([euros(2400), euros(200)])
    expect(step(year, 'asset-write-offs')?.figure.amount).toBe(euros(-200))
    expect(lineAmount(year, 'balance', 'tangible-assets')).toBe(euros(1600))
  })

  it('releases the grant with the funded assets and defers the rest', () => {
    // The fixed 4,000.00 on receipt, then the laptop's 800.00 and the desk's 200.00.
    expect(step(year, 'grant-release')?.figure.amount).toBe(euros(5000))
    expect(lineAmount(year, 'grant', 'deferred-at-year-end')).toBe(euros(5000))
    expect(lineAmount(year, 'balance', 'accruals-deferred-income')).toBe(euros(5000))
  })

  it('takes deductible VAT out of costs, the owner’s advances included, into the VAT position', () => {
    // Equipment 650.00, software 25.00, the advance 10.00 and half the car VAT, 6.25.
    expect(amountOfStep(year, 'input-vat')).toBe(euros(691.25))
    // Less the 500.00 refunded.
    expect(lineAmount(year, 'balance', 'receivables-state')).toBe(euros(191.25))
  })

  it('builds the PD return and closes the balance sheet on the share capital paid in', () => {
    // Representation 40.00, personal transport 28.12 and fines 50.00.
    expect(lineAmount(year, 'tax', 'increases')).toBe(euros(118.12))
    expect(lineAmount(year, 'tax', 'tax-base')).toBe(euros(8999.82))
    expect(lineAmount(year, 'tax', 'liability')).toBe(euros(899.98))
    expect(lineAmount(year, 'tax', 'advances-paid')).toBe(euros(0))
    // Ten months from March.
    expect(lineAmount(year, 'tax', 'monthly-advance')).toBe(euros(90))
    expect(year.bridge.profitAfterTax.amount).toBe(euros(7981.72))
    expect(lineAmount(year, 'balance', 'payables-taxes')).toBe(euros(1000.03))
    expect(lineAmount(year, 'balance', 'share-capital')).toBe(euros(2500))
  })

  it('keeps owner loans out of profit whatever their bucket', () => {
    const financing = STUDIO_CATEGORIES.map((category) => (category.roles.includes('owner-loan-out') ? { ...category, bucket: 'financing' as const } : category))
    const result = accrual(2025, exampleStudio({ categories: financing }))

    expect(step(result, 'owner-loans')).toBeUndefined()
    expect(result.bridge.cashNet.amount).toBe(euros(9917.5))
    expect(result.bridge.profitBeforeTax.amount).toBe(euros(8881.7))
    expect(lineAmount(result, 'balance', 'receivables-members-employees')).toBe(euros(950))
  })

  it('takes dividends and corporate tax paid out of the next year’s profit', () => {
    const next = accrual(2026)

    expect(amountOfStep(next, 'profit-distributions')).toBe(euros(1000))
    expect(amountOfStep(next, 'corporate-tax-paid')).toBe(euros(899.98))
  })
})

describe('accrualYear against the accountant', () => {
  const closed = (lines: readonly YearEndLine[]) => accrual(2025, exampleStudio({ yearEndLines: lines }))

  it('marks an adjustment matched when the accountant has the same figure', () => {
    const result = closed([yearEndLine(2025, 'pl', 'depreciation', 800)])

    expect(step(result, 'depreciation')?.kind).toBe('matched')
  })

  it('takes the accountant’s grant release as a judgement and carries it into the deferred balance', () => {
    const result = closed([yearEndLine(2025, 'grant', 'released-in-year', 4900)])

    expect(step(result, 'grant-release')?.kind).toBe('explained')
    expect(step(result, 'grant-schedule')).toMatchObject({ kind: 'judgement', effect: 'profit' })
    expect(amountOfStep(result, 'grant-schedule')).toBe(euros(-100))
    expect(lineAmount(result, 'grant', 'deferred-at-year-end')).toBe(euros(5100))
    expect(accrualLine(result, 'pl', 'profit-before-tax')?.judgements).toEqual(['grant-schedule'])
  })

  it('keeps the arrears bookings in the next year that the accountant’s konto lines leave out', () => {
    const result = closed([yearEndLine(2025, 'konto', '42100', 100, ['payroll-tax'])])

    expect(step(result, 'arrears-cut-off')?.figure.steps.map((entry) => entry.amount)).toEqual([euros(0.05)])
    expect(lineAmount(result, 'pl', 'profit-before-tax')).toBe(euros(8881.75))
    // The tax on 8,999.87 rounds to 899.99, beside the 100.00 of December payroll tax.
    expect(lineAmount(result, 'balance', 'payables-taxes')).toBe(euros(999.99))
    // The next year keeps the same booking, as the accountant closed 2025.
    const next = accrual(2026, exampleStudio({ yearEndLines: [yearEndLine(2025, 'konto', '42100', 100, ['payroll-tax'])] }))
    expect(amountOfStep(next, 'arrears-cut-off')).toBe(euros(-0.05))
  })

  it('adds back representation as the accountant booked it', () => {
    const result = closed([yearEndLine(2025, 'konto', '41800', 78, ['representation'])])

    expect(step(result, 'representation-as-booked')).toMatchObject({ kind: 'judgement', effect: 'tax-base' })
    // 78.00 halved is 39.00 added back, against 40.00 on the bank amount.
    expect(lineAmount(result, 'tax', 'increases')).toBe(euros(117.12))
    expect(lineAmount(result, 'pl', 'profit-before-tax')).toBe(euros(8881.7))
  })

  it('places costs on the lines the accountant uses when the totals agree, and leaves profit alone', () => {
    const result = closed([
      yearEndLine(2025, 'pl', 'material-costs', 618.25 - 50),
      yearEndLine(2025, 'pl', 'personnel-costs', 2800.05),
      yearEndLine(2025, 'pl', 'other-costs', 50),
      yearEndLine(2025, 'pl', 'impairment-provisions-other', 0),
      yearEndLine(2025, 'pl', 'financial-expenses', 0),
    ])

    expect(step(result, 'cost-placement')).toMatchObject({ kind: 'judgement', effect: 'placement' })
    expect(lineAmount(result, 'pl', 'other-costs')).toBe(euros(50))
    expect(accrualLine(result, 'pl', 'other-costs')?.judgements).toEqual(['cost-placement'])
    expect(lineAmount(result, 'pl', 'profit-before-tax')).toBe(euros(8881.7))
  })

  it('adds its bridge steps up to its own profit before tax, judgements included', () => {
    const cutOff = [yearEndLine(2025, 'konto', '42100', 100, ['payroll-tax']), yearEndLine(2025, 'grant', 'released-in-year', 4900)]
    const results = [accrual(2026), closed(cutOff), accrual(2026, exampleStudio({ yearEndLines: cutOff }))]

    for (const result of results) {
      expect(bridgeTotal(result)).toBe(result.bridge.profitBeforeTax.amount)
    }
  })

  it('leaves what nothing explains open, as the gap to the accountant’s profit', () => {
    const result = closed([yearEndLine(2025, 'pl', 'profit-before-tax', 9000)])

    expect(result.bridge.unexplainedBeforeTax).toMatchObject({ id: 'unexplained-before-tax', kind: 'open' })
    expect(result.bridge.unexplainedBeforeTax?.figure.amount).toBe(euros(118.3))
  })
})
