import { describe, expect, it } from 'vitest'

import { euroSplit } from '../src/features/overview/domain/euroSplit'
import { runway } from '../src/features/overview/domain/runway'
import { recentChange, windowAverages } from '../src/features/overview/domain/windowAverages'
import { ZERO } from '../src/shared/money/money'
import { euros, ledger, windowOf } from './fixtures/ledger'

// Opens mid-June 2026, so June is a part-month. October is the month still filling up.
const rows = ledger([
  { date: '2026-06-15', amount: 9000, category: 'revenue' },
  { date: '2026-07-04', amount: 6000, category: 'revenue' },
  { date: '2026-07-12', amount: -1000, category: 'salary-net' },
  { date: '2026-07-12', amount: -300, category: 'payroll-tax' },
  { date: '2026-07-20', amount: -200, category: 'accounting' },
  // August has no rows at all.
  { date: '2026-09-04', amount: 3000, category: 'revenue' },
  { date: '2026-09-12', amount: -1000, category: 'salary-net' },
  { date: '2026-09-30', amount: -500, category: 'reimbursement-to-owner' },
  { date: '2026-10-02', amount: 50000, category: 'revenue' },
])
const window = windowOf('2026-06-15', '2026-10-02')

describe('windowAverages', () => {
  const averages = windowAverages(rows, window)

  it('averages the last three complete months, a dry month counting as zero', () => {
    // July to September: income 9000, cost 2500, over 3 months
    expect(averages.last3.span).toEqual({ from: '2026-07', to: '2026-09', monthCount: 3 })
    expect(averages.last3.lines.income).toMatchObject({ total: euros(9000), perMonth: euros(3000) })
    expect(averages.last3.lines.cost.perMonth).toBe(euros(833.33))
    expect(averages.last3.lines.net.perMonth).toBe(euros(2166.67))
    expect(averages.last3.lines.ownerEarns.perMonth).toBe(euros(2833.33))
  })

  it('never counts the part-month, and divides last 12 by twelve even for a young ledger', () => {
    expect(averages.last12.lines.income.total).toBe(euros(18000))
    expect(averages.last12.lines.income.perMonth).toBe(euros(1500))
  })

  it('starts all time at the first complete month, so the opening part-month is left out', () => {
    expect(averages.allTime?.span).toEqual({ from: '2026-07', to: '2026-09', monthCount: 3 })
    expect(averages.allTime?.lines.income.total).toBe(euros(9000))
  })

  it('links every figure to the rows that make it up', () => {
    expect(averages.last3.lines.taxes.drill).toEqual({ route: 'transactions', filters: { period: { preset: 'l3' }, buckets: ['taxes'] } })
    expect(averages.allTime?.lines.net.drill.filters).toEqual({
      period: { preset: 'custom', range: { from: '2026-07-01', to: '2026-09-30' } },
      buckets: ['income', 'operating', 'taxes', 'owner-pay'],
    })
  })

  it('has no all-time column before a month completes', () => {
    expect(windowAverages(rows, windowOf('2026-09-12', '2026-10-02')).allTime).toBeNull()
  })
})

describe('euroSplit', () => {
  it('splits income into the three costs and what is kept while there is a profit', () => {
    const split = euroSplit(windowAverages(rows, window).last3.totals, { preset: 'l3' })

    expect(split.basis).toBe('income')
    expect(split.slices.map((slice) => [slice.part, slice.total])).toEqual([
      ['operating', euros(200)],
      ['taxes', euros(300)],
      ['ownerPay', euros(2000)],
      ['kept', euros(6500)],
    ])
    expect(split.slices.reduce((total, slice) => total + slice.share, 0)).toBeCloseTo(1, 12)
    expect(split.shortfall).toBeNull()
  })

  it('switches to cost as the whole in a loss, so no slice goes negative', () => {
    const loss = ledger([
      { date: '2026-07-04', amount: 1000, category: 'revenue' },
      { date: '2026-07-12', amount: -1500, category: 'salary-net' },
      { date: '2026-07-21', amount: -3500, category: 'equipment' },
    ])
    const split = euroSplit(windowAverages(loss, windowOf('2026-07-01', '2026-08-03')).last3.totals, { preset: 'l3' })

    expect(split.basis).toBe('cost')
    expect(split.whole).toBe(euros(5000))
    expect(split.slices.map((slice) => [slice.part, slice.share])).toEqual([
      ['operating', 0.7],
      ['taxes', 0],
      ['ownerPay', 0.3],
    ])
    expect(split.shortfall).toBe(euros(4000))
  })

  it('has nothing to split without income', () => {
    const empty = windowAverages([], window).last3.totals

    expect(euroSplit(empty, { preset: 'l3' })).toMatchObject({ basis: 'income', whole: ZERO, shortfall: null })
  })
})

describe('runway', () => {
  const averages = windowAverages(rows, window)
  const cashOnHand = { amount: euros(10000), drill: { route: 'transactions' as const, filters: {} } }

  it('divides cash on hand by the last three months’ cost per month', () => {
    // 2500 of cost over three months
    expect(runway(cashOnHand, averages.last3).months).toBeCloseTo(12, 12)
    expect(runway(cashOnHand, averages.last3).monthlyCost.amount).toBe(euros(833.33))
  })

  it('has no runway when nothing is being spent', () => {
    expect(runway(cashOnHand, windowAverages([], window).last3).months).toBeNull()
  })
})

describe('recentChange', () => {
  it('measures the recent figure against the size of the longer one, so a smaller loss reads as a rise', () => {
    expect(recentChange(euros(1100), euros(1000))).toBeCloseTo(0.1)
    expect(recentChange(euros(-500), euros(-1000))).toBeCloseTo(0.5)
  })

  it('has no change against zero', () => {
    expect(recentChange(euros(100), euros(0))).toBeNull()
  })
})
