import { describe, expect, it } from 'vitest'

import type { YearEndLine } from '../src/apps/company/packs/hr-doo/domain/yearEnd/yearEnd'
import type { AccrualAdjustment, AdjustmentId } from '../src/apps/company/packs/hr-doo/domain/accrual/accrualAdjustment'
import { accrualLine, accrualYear } from '../src/apps/company/packs/hr-doo/domain/accrual/accrualYear'
import { costLineOf } from '../src/apps/company/packs/hr-doo/domain/accrual/categoryLines'
import { STARTING_CATEGORIES } from '../src/apps/company/packs/hr-doo/preset/domain/startingCategories'
import type { AccrualYear } from '../src/apps/company/packs/hr-doo/domain/accrual/accrualYear'
import type { HrDooWorkbook } from '../src/apps/company/packs/hr-doo/domain/hrDooPart'
import { addMoney, sumMoney } from '../src/shared/money/money'
import { ownerShareOf } from '../src/apps/company/owner-share/domain/ownerShare'
import type { Money } from '../src/shared/money/money'
import type { VatTreatment } from '../src/apps/company/workbook/domain/vatTreatment'
import type { Category } from '../src/apps/company/workbook/domain/workbook'
import { STUDIO_CATEGORIES, STUDIO_ROWS, exampleStudio, yearEndLine } from './fixtures/exampleStudio'
import { withPackBuckets } from './fixtures/hrDooCategories'
import { euros, ledger } from './fixtures/ledger'

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
    // Software 140.00, representation 80.00, insurance 92.00, car 56.25 and the desk 200.00.
    expect(lineAmount(year, 'pl', 'material-costs')).toBe(euros(568.25))
    // The fines, by their class.
    expect(lineAmount(year, 'pl', 'impairment-provisions-other')).toBe(euros(50))
    expect(lineAmount(year, 'pl', 'financial-income')).toBe(euros(0))
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

describe('accrualYear with donations and listed sponsorships', () => {
  const software = STUDIO_CATEGORIES.find((category) => category.slug === 'software')!
  const categories: readonly Category[] = [
    ...STUDIO_CATEGORIES,
    { ...software, slug: 'donations', roles: ['donation'], vat: 'none' },
    { ...software, slug: 'sponsorships', roles: ['listed-sponsorship'], vat: 'none' },
  ]
  const rows = [...STUDIO_ROWS, { date: '2026-03-01', amount: -300, category: 'donations' }, { date: '2026-03-02', amount: -200, category: 'sponsorships' }]
  const giving = (lines: readonly YearEndLine[] = []) => exampleStudio({ categories, transactions: withPackBuckets(ledger(rows), categories), yearEndLines: lines })
  const increaseOf = (result: AccrualYear, label: string) => result.taxBase.increases.steps.find((entry) => entry.label.startsWith(label))?.amount

  it('caps the donations at 2% of the year before when it had more revenue, and takes the listed sponsorship off the base', () => {
    const result = accrual(2026, giving())

    // 2026 has 4,300.00 of revenue and 2025 had 13,100.00, so the cap is 262.00 and 38.00 of the 300.00 is added back.
    expect(increaseOf(result, 'PD line 14')).toBe(euros(38))
    expect(result.taxBase.decreases.amount).toBe(euros(200))
    expect(lineAmount(result, 'tax', 'decreases')).toBe(euros(200))
  })

  it('reads the year before from the accountant’s PD line 1 when the year-end tab has it', () => {
    // 2% of the accountant’s 20,000.00 is 400.00, above the 300.00 given.
    expect(increaseOf(accrual(2026, giving([yearEndLine(2025, 'tax', 'revenue', 20000)])), 'PD line 14')).toBe(euros(0))
  })

  it('counts the donations on other operating expenses, and shows the lines at zero in a year with none', () => {
    expect(lineAmount(accrual(2026, giving()), 'pl', 'impairment-provisions-other')).toBe(euros(300))
    const before = accrual(2025, giving())
    expect(increaseOf(before, 'PD line 14')).toBe(euros(0))
    expect(before.taxBase.decreases.steps.map((entry) => entry.label)).toEqual(['PD line 33.a, sponsorships to recipients on a ministry list: no decrease in 2025'])
  })
})

describe('accrualYear, the line each category counts on', () => {
  const income = (slug: string, roles: readonly string[]): Category => ({ ...STUDIO_CATEGORIES.find((category) => category.slug === 'grant-income')!, slug, roles })
  const categories: readonly Category[] = [
    ...STUDIO_CATEGORIES.map((category) => (category.slug === 'rent-owner' ? { ...category, roles: ['owner-rent', 'arrears'] } : category)),
    income('interest', ['interest-income']),
    income('insurance-payout', ['other-income']),
  ]
  const rows = [...STUDIO_ROWS, { date: '2025-12-31', amount: 12.34, category: 'interest' }, { date: '2025-11-20', amount: 400, category: 'insurance-payout' }]
  const placed = (lines: readonly YearEndLine[] = []) => accrual(2025, exampleStudio({ categories, transactions: withPackBuckets(ledger(rows), categories), yearEndLines: lines }))

  it('counts interest the company earns on financial income, and other income on other operating income', () => {
    const result = placed()

    expect(lineAmount(result, 'pl', 'financial-income')).toBe(euros(12.34))
    // The grant's 5,000.00 released, and the insurance payout.
    expect(lineAmount(result, 'pl', 'other-operating-income')).toBe(euros(5400))
    // 8,881.70 with the interest and the payout.
    expect(lineAmount(result, 'pl', 'profit-before-tax')).toBe(euros(9294.04))
  })

  it('puts an income category where the accountant’s konto line names it', () => {
    const result = placed([yearEndLine(2025, 'konto', '77130', 400, ['insurance-payout'])])

    expect(lineAmount(result, 'pl', 'financial-income')).toBe(euros(412.34))
    expect(lineAmount(result, 'pl', 'other-operating-income')).toBe(euros(5000))
  })

  it('counts a cost the chart keeps in group 46 on other costs, whatever its class names, unless a konto line names it', () => {
    const travel: Category = { ...STUDIO_CATEGORIES.find((category) => category.slug === 'software')!, slug: 'travel', roles: ['deductible-cost', 'other-costs-line'] }

    expect(costLineOf(travel, 2025, [])).toBe('other-costs')
    expect(costLineOf({ ...travel, roles: ['deductible-cost'] }, 2025, [])).toBe('material-costs')
    expect(costLineOf(travel, 2025, [yearEndLine(2025, 'konto', '41020', 100, ['travel'])])).toBe('material-costs')
  })

  it.each([
    // RRiF 460 travel, 464 insurance, 465 bank services and 4690 training sit in group 46.
    ['travel', 'other-costs'],
    ['insurance', 'other-costs'],
    ['bank-fees', 'other-costs'],
    ['training', 'other-costs'],
    // 4100 telephone, 4140 rent and 4164 bookkeeping sit in group 41.
    ['telecom', 'material-costs'],
    ['office-rent', 'material-costs'],
    ['accounting-and-legal', 'material-costs'],
    ['representation', 'material-costs'],
  ])('starts new books with %s on %s', (slug, line) => {
    const starting = STARTING_CATEGORIES.find((category) => category.slug === slug)!
    const category: Category = { slug, family: starting.family, bucket: starting.bucket, colour: STUDIO_CATEGORIES[0]!.colour, roles: starting.roles, vat: starting.vat, ownerShare: null }

    expect(costLineOf(category, 2026, [])).toBe(line)
  })

  it('counts rent paid to the owner on material costs by its class, not on personnel costs by its bucket', () => {
    const result = placed()

    // Pay and payroll tax, without the December rent of 300.00.
    expect(lineAmount(result, 'pl', 'personnel-costs')).toBe(euros(2500.05))
    expect(lineAmount(result, 'pl', 'material-costs')).toBe(euros(868.25))
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

describe('accrualYear, a representation category its VAT or its roles contradict', () => {
  const representationWith = (changes: { readonly vat?: VatTreatment; readonly roles?: readonly string[] }): readonly Category[] =>
    STUDIO_CATEGORIES.map((category) => (category.slug === 'representation' ? { ...category, ...changes } : category))

  it.fails('takes no input VAT out of representation stored with a deductible rate', () => {
    const result = accrual(2025, exampleStudio({ categories: representationWith({ vat: 'deductible-25' }) }))

    expect(amountOfStep(result, 'input-vat')).toBe(euros(691.25))
    expect(result.bridge.profitBeforeTax.amount).toBe(euros(8881.7))
  })

  it.fails('adds representation that also carries non-deductible back once', () => {
    const result = accrual(2025, exampleStudio({ categories: representationWith({ roles: ['representation', 'non-deductible'] }) }))

    expect(lineAmount(result, 'tax', 'increases')).toBe(lineAmount(accrual(2025), 'tax', 'increases'))
  })
})

describe('accrualYear with an owner share', () => {
  const BENEFIT = { ...STUDIO_CATEGORIES.find((category) => category.slug === 'salary-net')!, slug: 'benefits', roles: ['owner-benefit'] }
  const AI = { ...STUDIO_CATEGORIES.find((category) => category.slug === 'software')!, slug: 'ai-services', vat: 'reverse-charge' as const }
  const categories = [...STUDIO_CATEGORIES, BENEFIT, AI]
  const shares: Readonly<Record<string, number>> = { 'Order 1001': 30, 'Order 1002': 30 }
  const transactions = withPackBuckets(ledger(STUDIO_ROWS.flatMap((row) => (row.category === 'fines' ? [row, { date: '2025-06-16', amount: -100, category: 'ai-services' }] : [row]))), categories).map(
    (row) => ({
      ...row,
      ownerShare: ownerShareOf(shares[row.description] ?? (row.category === 'software' || row.category === 'ai-services' ? 50 : 0)),
    }),
  )
  const shared = exampleStudio({ categories, transactions })
  const year = accrual(2025, shared)

  it('puts the VAT on the private share of an asset and of small inventory into their cost, so capital purchases, assets and write-offs add up', () => {
    // The laptop's 600.00 of VAT keeps 180.00 at 30%, so it costs 2,580.00. The desk keeps 15.00 of its 50.00 and costs 215.00.
    expect(step(year, 'capital-purchases')?.figure.steps.map((entry) => entry.amount)).toEqual([euros(2580), euros(215)])
    expect(step(year, 'asset-write-offs')?.figure.amount).toBe(euros(-215))
    // 50% a year from May: 2,580.00 × 50% × 8 / 12 = 860.00.
    expect(amountOfStep(year, 'depreciation')).toBe(euros(-860))
    expect(lineAmount(year, 'balance', 'tangible-assets')).toBe(euros(2580 - 860))
    expect(lineAmount(year, 'balance', 'share-capital')).toBe(euros(2500))
  })

  it('deducts only the business share, and owes the reverse charge on the private share', () => {
    // 691.25 less the private shares: 180.00 and 15.00 of equipment, 12.50 of software, and the 12.50 the reverse charge owes on the AI service.
    expect(amountOfStep(year, 'input-vat')).toBe(euros(691.25 - 180 - 15 - 12.5 - 12.5))
    expect(bridgeTotal(year)).toBe(year.bridge.profitBeforeTax.amount)
  })

  it('shows on a closed year the VAT the accountant deducted on the private share as one judgement, and the lines match again', () => {
    const ours = (line: string) => lineAmount(year, 'pl', line) ?? 0
    // The accountant deducted all of it: 12.50 of software, 12.50 of the AI service and the desk's 15.00 off material costs, and the laptop's 180.00 kept out of its cost,
    // so 2,400.00 depreciates 800.00 against our 860.00. It also put the 50.00 of fines on other costs.
    const closed = accrual(
      2025,
      exampleStudio({
        categories,
        transactions,
        yearEndLines: [
          yearEndLine(2025, 'pl', 'material-costs', (ours('material-costs') - 1250 - 1250 - 1500) / 100),
          yearEndLine(2025, 'pl', 'personnel-costs', ours('personnel-costs') / 100),
          yearEndLine(2025, 'pl', 'other-costs', 50),
          yearEndLine(2025, 'pl', 'depreciation', 800),
          yearEndLine(2025, 'pl', 'impairment-provisions-other', (ours('impairment-provisions-other') - 5000) / 100),
          yearEndLine(2025, 'pl', 'financial-expenses', 0),
        ],
      }),
    )

    expect(step(closed, 'private-vat-as-booked')).toMatchObject({ kind: 'judgement', effect: 'profit' })
    // 12.50 + 12.50 + 15.00 on material costs and 60.00 of depreciation.
    expect(amountOfStep(closed, 'private-vat-as-booked')).toBe(euros(100))
    expect(step(closed, 'cost-placement')).toMatchObject({ kind: 'judgement', effect: 'placement' })
    expect(lineAmount(closed, 'pl', 'other-costs')).toBe(euros(50))
    expect(lineAmount(closed, 'pl', 'depreciation')).toBe(euros(800))
    expect(accrualLine(closed, 'pl', 'material-costs')?.judgements).toEqual(['private-vat-as-booked'])
    expect(accrualLine(closed, 'pl', 'other-costs')?.judgements).toEqual(['cost-placement'])
    expect(lineAmount(closed, 'pl', 'profit-before-tax')).toBe(addMoney(year.bridge.profitBeforeTax.amount, euros(100)))
    expect(bridgeTotal(closed)).toBe(closed.bridge.profitBeforeTax.amount)
    // The laptop at the accountant's 2,400.00 less 800.00, and the share capital still closes the balance sheet.
    expect(lineAmount(closed, 'balance', 'tangible-assets')).toBe(euros(1600))
    expect(lineAmount(closed, 'balance', 'share-capital')).toBe(euros(2500))
  })
})
