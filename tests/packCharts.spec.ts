import { describe, expect, it } from 'vitest'

import { readDocument } from '../src/apps/company/workbook/infrastructure/companyDocument'
import type { ChartTokens } from '../src/shared/charts/chartTokens'
import { formatMoney } from '../src/shared/money/moneyFormat'
import type { Period } from '../src/apps/company/filters/domain/filterState'
import { categoryColourOf } from '../src/apps/company/workbook/domain/categoryColour'
import { ledgerWindowOf } from '../src/apps/company/workbook/domain/workbook'
import type { Category } from '../src/apps/company/workbook/domain/workbook'
import { fakeWorkbookDocument } from '../src/apps/company/workbook/infrastructure/fake/fakeWorkbook'
import { presentedWorkbook } from '../src/apps/company/transactions/application/presentedWorkbook'
import { loanMonths } from '../src/apps/company/packs/hr-doo/domain/ownerLoans'
import { ownerTake, ownerTakeByMonth } from '../src/apps/company/packs/hr-doo/domain/ownerTake'
import { PACK_ROLES, categoriesWithRole } from '../src/apps/company/packs/hr-doo/domain/packRoles'
import { RENT_TAX_LABEL, categorySeries, loanBalanceChart, ownerDrawsChart, ownerPaySeries } from '../src/apps/company/packs/hr-doo/presentation/packCharts'
import { periodMonths } from '../src/apps/company/filters/domain/periodPresets'
import { PACK_CATEGORIES, withPackBuckets } from './fixtures/hrDooCategories'
import { civil, euros, ledger, windowOf } from './fixtures/ledger'

const TOKENS = { series: ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'], deemphasis: 'grey' } as unknown as ChartTokens
const TAXES = PACK_CATEGORIES.filter((category) => category.bucket === 'taxes')
const name = (slug: string) => slug

function paints(listed: readonly Category[], moved: readonly string[]): [string, string, string][] {
  return categorySeries(listed, moved, TOKENS, name).map((entry) => [entry.name, entry.token, entry.colour])
}

function taxed(slug: string, colour: string): Category {
  return { ...TAXES.find((category) => category.slug === slug)!, colour: categoryColourOf(colour) }
}

describe('categorySeries', () => {
  it('keeps each tax category in its colour when another one paid nothing in the period', () => {
    const everyTax = paints(
      TAXES,
      TAXES.map((category) => category.slug),
    )
    const withoutPayrollTax = paints(
      TAXES,
      TAXES.map((category) => category.slug).filter((slug) => slug !== 'payroll-tax'),
    )

    expect(everyTax.map(([slug, token]) => [slug, token])).toEqual([
      ['payroll-contributions', '--series-1'],
      ['payroll-tax', '--series-2'],
      ['corporate-income-tax', '--series-3'],
      ['dividend-tax', '--series-4'],
      ['tax-refund', '--series-5'],
    ])
    expect(withoutPayrollTax).toEqual(everyTax.filter(([slug]) => slug !== 'payroll-tax'))
  })

  it('paints a category in the swatch it was given, and the rest by their place', () => {
    const listed = TAXES.map((category) => (category.slug === 'corporate-income-tax' ? taxed(category.slug, '#6250D6') : category.slug === 'tax-refund' ? taxed(category.slug, '#a3adb9') : category))

    expect(paints(listed, ['payroll-contributions', 'corporate-income-tax', 'tax-refund'])).toEqual([
      ['payroll-contributions', '--series-1', 's1'],
      ['corporate-income-tax', '--series-7', 's7'],
      ['tax-refund', '--chart-deemphasis', 'grey'],
    ])
  })

  it('gives the categories without a colour the slots no listed category was given', () => {
    const listed = TAXES.map((category) => (category.slug === 'dividend-tax' ? taxed(category.slug, '#1baf7a') : category))

    expect(paints(listed, ['payroll-contributions', 'dividend-tax', 'tax-refund'])).toEqual([
      ['payroll-contributions', '--series-2', 's2'],
      ['dividend-tax', '--series-1', 's1'],
      ['tax-refund', '--series-5', 's5'],
    ])
  })

  it('takes a colour outside the palette as none, so the category keeps the slot of its place', () => {
    expect(paints([taxed('payroll-contributions', '#f9dcdc')], ['payroll-contributions'])).toEqual([['payroll-contributions', '--series-1', 's1']])
  })

  it('folds the categories past the eight free slots into one grey series of those that moved', () => {
    const listed = Array.from({ length: 10 }, (_, index) => ({ ...TAXES[0]!, slug: `tax-${index + 1}` }))

    expect(paints(listed, ['tax-2', 'tax-9'])).toEqual([
      ['tax-2', '--series-2', 's2'],
      ['Other categories', '--chart-deemphasis', 'grey'],
    ])
    expect(categorySeries(listed, ['tax-2', 'tax-9'], TOKENS, name).at(-1)?.categories).toEqual(['tax-9'])
    expect(paints(listed, ['tax-2']).map(([slug]) => slug)).toEqual(['tax-2'])
  })
})

describe('loanBalanceChart', () => {
  const transactions = withPackBuckets(
    ledger([
      { date: '2026-01-10', amount: -1000, category: 'owner-loan-out' },
      { date: '2026-03-05', amount: -400, category: 'owner-loan-out' },
      { date: '2026-04-20', amount: 600, category: 'owner-loan-repaid' },
      { date: '2026-05-08', amount: 200, category: 'reimbursement-from-owner' },
      { date: '2026-06-03', amount: -50, category: 'office-supplies' },
    ]),
  )
  const window = windowOf('2026-01-10', '2026-06-03')
  const months = loanMonths(transactions, PACK_CATEGORIES, periodMonths({ preset: 'l3' }, window), window)
  const chart = loanBalanceChart(months, 'owner-pay', TOKENS)

  it('draws what the owner owed at each month end of the period, counting the loans lent before it', () => {
    const [bars] = chart.option.series as { data: (number | { value: number })[] }[]
    const values = bars!.data.map((point) => (typeof point === 'number' ? point : point.value))

    // April: 1,400 lent in January and March less 600 repaid, May: 200 paid back on a reimbursement, June so far: nothing new.
    expect(months.map((month) => month.month)).toEqual(['2026-04', '2026-05', '2026-06'])
    expect(values).toEqual([euros(800), euros(600), euros(600)])
    expect(typeof bars!.data[2]).toBe('object')
    expect(chart.description).toContain('So far in Jun 2026 the owner owed €600.')
  })

  it('opens every loan row from the ledger’s first month to the end of the month clicked', () => {
    const drill = chart.drillAt({ seriesName: '', category: '2026-04', dataIndex: 0 })

    expect(drill?.filters.period).toEqual({ preset: 'custom', range: { from: civil('2026-01-01'), to: civil('2026-04-30') } })
    expect(drill?.filters.categories).toEqual(expect.arrayContaining(['owner-loan-out', 'owner-loan-repaid', 'reimbursement-from-owner']))
  })
})

describe('ownerDrawsChart', () => {
  const PAY = PACK_CATEGORIES.filter((category) => category.bucket === 'owner-pay')
  const LOANS = ['owner-loan-out', 'owner-loan-repaid']
  const valuesOf = (chart: ReturnType<typeof ownerDrawsChart>, seriesName: string) =>
    (chart.option.series as { name: string; data: (number | { value: number })[] }[]).find((entry) => entry.name === seriesName)?.data.map((point) => (typeof point === 'number' ? point : point.value))

  function drawn(rows: Parameters<typeof ledger>[0], from: string, to: string) {
    const window = windowOf(from, to)
    const months = ownerTakeByMonth(withPackBuckets(ledger(rows)), PACK_CATEGORIES, periodMonths({ preset: 'all' }, window), window)
    const moved = PAY.map((category) => category.slug).filter((slug) => months.some((month) => month.byCategory[slug]?.amount !== 0))
    const series = ownerPaySeries(
      PAY,
      moved,
      LOANS,
      months.some((month) => month.rentTax.amount !== 0),
      TOKENS,
      name,
    )
    return ownerDrawsChart(months, series, TOKENS)
  }

  it('draws the rent tax below zero in the month each rent row was paid, and opens that month’s rent rows', () => {
    const chart = drawn(
      [
        { date: '2026-07-12', amount: -1100, category: 'salary-net' },
        { date: '2026-07-12', amount: -300, category: 'rent-owner' },
        { date: '2026-08-12', amount: -1100, category: 'salary-net' },
        { date: '2026-09-12', amount: -300, category: 'rent-owner' },
      ],
      '2026-07-12',
      '2026-09-30',
    )

    expect(valuesOf(chart, 'rent-owner')).toEqual([euros(300), euros(0), euros(300)])
    expect(valuesOf(chart, RENT_TAX_LABEL)).toEqual([euros(-25.2), euros(0), euros(-25.2)])
    expect(chart.drillAt({ seriesName: RENT_TAX_LABEL, category: '2026-09', dataIndex: 2 })?.filters).toEqual({
      period: { preset: 'custom', range: { from: civil('2026-09-01'), to: civil('2026-09-30') } },
      categories: ['rent-owner'],
    })
    // 2,200.00 of salary and 600.00 of rent less 50.40 of rent tax.
    expect(chart.description).toContain('€2,749.60 in all.')
  })

  it('draws no rent tax band without rent', () => {
    const chart = drawn([{ date: '2026-07-12', amount: -1100, category: 'salary-net' }], '2026-07-12', '2026-07-31')

    expect(valuesOf(chart, RENT_TAX_LABEL)).toBeUndefined()
    expect(chart.description).not.toContain(RENT_TAX_LABEL)
  })

  describe('on the fake workbook', () => {
    const SYNCED = '2026-10-16T08:00:00.000Z'
    const workbook = presentedWorkbook(readDocument({ id: 'fake', source: 'drive', title: 'Fake workbook', syncedAt: SYNCED }, fakeWorkbookDocument(SYNCED, 'drive')).workbook)
    const window = ledgerWindowOf(workbook.transactions)!
    const pay = workbook.categories.filter((category) => category.bucket === 'owner-pay')
    const loanSlugs = [...categoriesWithRole(workbook.categories, PACK_ROLES.ownerLoanOut), ...categoriesWithRole(workbook.categories, PACK_ROLES.ownerLoanRepaid)].filter((slug) =>
      pay.some((category) => category.slug === slug),
    )

    it.each<[string, Period]>([
      ['the last 12 months', { preset: 'l12' }],
      ['2025', { preset: 'year', year: 2025 }],
      ['2026', { preset: 'year', year: 2026 }],
      ['all time', { preset: 'all' }],
    ])('adds up to the owner take in %s', (_, period) => {
      const take = ownerTake(workbook.transactions, workbook.categories, period, window)
      const months = ownerTakeByMonth(workbook.transactions, workbook.categories, periodMonths(period, window), window)
      const moved = pay.map((category) => category.slug).filter((slug) => months.some((month) => month.byCategory[slug]?.amount !== 0))
      const chart = ownerDrawsChart(months, ownerPaySeries(pay, moved, loanSlugs, true, TOKENS, name), TOKENS)

      expect(take.rentTax.amount).toBeGreaterThan(0)
      expect(months.reduce((sum, month) => sum + month.rentTax.amount, 0)).toBe(take.rentTax.amount)
      expect(months.reduce((sum, month) => sum + month.total.amount, 0)).toBe(take.total.amount)
      expect(chart.description).toContain(`${formatMoney(take.total.amount)} in all.`)
    })
  })
})
