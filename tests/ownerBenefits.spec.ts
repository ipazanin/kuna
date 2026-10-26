import { describe, expect, it } from 'vitest'

import type { ChartTokens } from '../src/shared/charts/chartTokens'
import type { DrillTarget } from '../src/features/filters/domain/drillTarget'
import { DEFAULT_FILTERS } from '../src/features/filters/domain/filterState'
import { withOwnerParts } from '../src/features/owner-share/domain/ownerParts'
import { filterTransactions } from '../src/features/transactions/domain/filterTransactions'
import type { Booking, Transaction } from '../src/features/workbook/domain/workbook'
import type { TracedRate } from '../src/packs/hr-doo/domain/cit/citLiability'
import { ownerCost } from '../src/packs/hr-doo/domain/ownerCost'
import { dividendComparison, ownerBenefits } from '../src/packs/hr-doo/domain/ownerBenefits'
import { paidOut } from '../src/packs/hr-doo/domain/paidOut'
import { benefitsRing, categorySeries } from '../src/packs/hr-doo/presentation/packCharts'
import type { Rate } from '../src/packs/hr-doo/ruleset/schema'
import type { TracedFigure } from '../src/packs/hr-doo/ruleset/tracedFigure'
import { civil, euros, windowOf } from './fixtures/ledger'
import { BENEFIT, CATEGORIES, EXAMPLE, WINDOW, YEAR, rows, workbookOf } from './fixtures/ownerShareExample'

const rateOf = (percent: number): TracedRate => ({ label: 'PD line 43', basisPoints: (percent * 100) as Rate, rules: [] })
const cashOf = (transactions: typeof EXAMPLE) => withOwnerParts(workbookOf(transactions)).transactions as readonly Booking[]
const steps = (figure: TracedFigure) => figure.steps.map((step) => [step.label, step.amount, step.steps.map((inner) => [inner.label, inner.amount])])

describe('ownerBenefits on the worked example', () => {
  const shared = cashOf(EXAMPLE)
  const benefits = ownerBenefits(shared, CATEGORIES, YEAR, WINDOW)!

  it('sums the owner parts by the category they come from, with the share each was counted at', () => {
    expect(benefits.category).toBe(BENEFIT.slug)
    expect(benefits.total.amount).toBe(euros(1200))
    expect(benefits.total.drill.filters).toMatchObject({ period: YEAR, categories: ['benefits'] })
    expect(benefits.payments).toBe(13)
    expect(benefits.bySource.map((source) => [source.category, source.share, source.amount.amount])).toEqual([
      ['equipment', 30, euros(600)],
      ['ai-services', 50, euros(600)],
    ])
    expect(benefits.byYear).toEqual([{ year: 2026, amount: euros(1200) }])
  })

  it('works out the tax a dividend of the same money would have paid, and what it would have netted', () => {
    // Corporate tax at 10% of 1,200 is 120.00. Dividend tax at 12% of the 1,080.00 left is 129.60.
    const comparison = dividendComparison(benefits.byYear, 'Perks', () => rateOf(10))

    expect(comparison.taxAvoided.amount).toBe(euros(249.6))
    expect(comparison.asDividend.amount).toBe(euros(950.4))
    expect(comparison.taxAvoided.label).toBe('Tax avoided against a dividend')
    expect(steps(comparison.taxAvoided)).toEqual([
      ['Corporate tax at 10%', euros(120), [['Perks in 2026', euros(1200)]]],
      ['Dividend tax at 12%', euros(129.6), [['Profit after corporate tax', euros(1080)]]],
    ])
    expect(comparison.taxAvoided.rules.map((citation) => citation.ruleId)).toEqual(['hr.pit.dividend'])
  })

  it('opens each source on the benefit category, whose rows hold its owner parts and none of its business parts', () => {
    const listedBy = (drill: DrillTarget) => filterTransactions(shared as readonly Transaction[], { ...DEFAULT_FILTERS, ...drill.filters }, WINDOW)

    for (const source of benefits.bySource) {
      const parts = listedBy(source.amount.drill).filter((row) => row.ownerPart?.sourceCategory === source.category)
      expect(paidOut(parts)).toBe(source.amount.amount)
    }
  })

  it('raises the owner’s net share of the gross cost, since the benefits carry no tax', () => {
    expect(ownerCost(shared, CATEGORIES, YEAR, WINDOW).netShare?.toFixed(2)).toBe('0.81')
  })
})

describe('ownerBenefits', () => {
  it('reads mixed when the rows of a category were counted at different shares, and counts a refund back', () => {
    const shared = cashOf(
      rows([
        { date: '2026-02-01', amount: -100, category: 'equipment', share: 30 },
        { date: '2026-02-02', amount: -100, category: 'equipment', share: 20 },
        { date: '2026-02-03', amount: -100, category: 'ai-services' },
        { date: '2026-02-04', amount: 100, category: 'ai-services' },
      ]),
    )
    const benefits = ownerBenefits(shared, CATEGORIES, YEAR, WINDOW)!

    expect(benefits.bySource.map((source) => [source.category, source.share, source.amount.amount])).toEqual([
      ['equipment', 'mixed', euros(50)],
      ['ai-services', 50, euros(0)],
    ])
    expect(benefits.total.amount).toBe(euros(50))
  })

  it('is null without one owner-pay category carrying the owner-benefit role', () => {
    expect(ownerBenefits(cashOf(EXAMPLE), CATEGORIES.filter((candidate) => candidate !== BENEFIT), YEAR, WINDOW)).toBeNull()
  })
})

describe('dividendComparison', () => {
  it('sums a period across two years, each at its own corporate rate', () => {
    const shared = cashOf(
      rows([
        { date: '2025-12-20', amount: -1000, category: 'ai-services' },
        { date: '2026-01-20', amount: -1000, category: 'ai-services' },
      ]),
    )
    const span = { preset: 'custom', range: { from: civil('2025-12-01'), to: civil('2026-01-31') } } as const
    const benefits = ownerBenefits(shared, CATEGORIES, span, windowOf('2025-12-20', '2026-01-20'))!
    const comparison = dividendComparison(benefits.byYear, 'Perks', (year) => rateOf(year === 2025 ? 10 : 18))

    // 2025: 500 at 10% is 50.00, then 12% of 450.00 is 54.00, so 104.00 avoided and 396.00 net.
    // 2026: 500 at 18% is 90.00, then 12% of 410.00 is 49.20, so 139.20 avoided and 360.80 net.
    expect(benefits.byYear).toEqual([
      { year: 2025, amount: euros(500) },
      { year: 2026, amount: euros(500) },
    ])
    expect(comparison.taxAvoided.amount).toBe(euros(243.2))
    expect(comparison.asDividend.amount).toBe(euros(756.8))
    expect(comparison.taxAvoided.steps.map((step) => [step.label, step.amount])).toEqual([
      ['Tax avoided in 2025', euros(104)],
      ['Tax avoided in 2026', euros(139.2)],
    ])
    expect(comparison.asDividend.steps.map((step) => [step.label, step.amount])).toEqual([
      ['As a dividend in 2025', euros(396)],
      ['As a dividend in 2026', euros(360.8)],
    ])
  })
})

describe('benefitsRing', () => {
  it('draws each source in the colour its category has on a chart of its bucket, noting the share its rows were counted at', () => {
    const tokens = { series: ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'], deemphasis: 'grey' } as unknown as ChartTokens
    const shared = cashOf(
      rows([
        { date: '2026-02-01', amount: -100, category: 'equipment', share: 30 },
        { date: '2026-02-02', amount: -100, category: 'equipment', share: 20 },
        { date: '2026-02-03', amount: -100, category: 'ai-services' },
      ]),
    )
    const benefits = ownerBenefits(shared, CATEGORIES, YEAR, WINDOW)!
    const operating = CATEGORIES.filter((category) => category.bucket === 'operating')
    const series = categorySeries(operating, ['equipment', 'ai-services'], tokens, (slug) => slug)

    expect(benefitsRing(benefits, series, (slug) => slug).map((part) => [part.label, part.value, part.colour, part.note])).toEqual([
      ['equipment', euros(50), '--series-2', 'mixed'],
      ['ai-services', euros(50), '--series-3', '50%'],
    ])
  })
})
