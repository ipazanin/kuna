import { describe, expect, it } from 'vitest'

import { periodReview, reviewPeriodOf } from '../src/apps/company/period-review/domain/periodReview'
import { euros, ledger, windowOf } from './fixtures/ledger'

const rows = ledger([
  { date: '2025-06-16', amount: 2500, category: 'share-capital' },
  { date: '2025-07-04', amount: 6000, category: 'revenue' },
  { date: '2025-11-12', amount: -1000, category: 'salary-net' },
  { date: '2026-01-04', amount: 7000, category: 'revenue' },
  { date: '2026-02-12', amount: -1500, category: 'salary-net' },
  { date: '2026-04-04', amount: 5000, category: 'revenue' },
  { date: '2026-05-20', amount: -200, category: 'accounting' },
  { date: '2026-07-04', amount: 4000, category: 'revenue' },
  { date: '2026-10-02', amount: 9000, category: 'revenue' },
])
const window = windowOf('2025-06-16', '2026-10-02')

describe('periodReview', () => {
  it('compares only the complete months of a year the ledger covers in part, and shows no prior when the ledger holds none', () => {
    const review = periodReview(rows, { preset: 'year', year: 2025 }, window)

    expect(review.partOfPeriod).toBe(true)
    expect(review.current).toMatchObject({ partial: false, range: { from: '2025-07-01', to: '2025-12-31' }, coveredMonths: { from: '2025-07', to: '2025-12' } })
    expect(review.prior).toBeNull()
    expect(review.lines.find((line) => line.line === 'income')).toMatchObject({ current: { amount: euros(6000) }, prior: null, change: null })
    expect(review.months.map((month) => month.month)).toHaveLength(12)
  })

  it('sets a partial year against the same months a year earlier, with no change when the ledger lacks some of them', () => {
    const review = periodReview(rows, { preset: 'year', year: 2026 }, window)
    const net = review.lines.find((line) => line.line === 'net')

    // January to September 2026 are complete. The same months of 2025 hold only July onwards.
    expect(review.current).toMatchObject({ range: { from: '2026-01-01', to: '2026-09-30' }, partial: false })
    expect(review.prior).toMatchObject({ range: { from: '2025-01-01', to: '2025-09-30' }, partial: true, coveredMonths: { from: '2025-07', to: '2025-09' } })
    expect(net).toMatchObject({ current: { amount: euros(14300) }, prior: { amount: euros(6000) }, change: null })
    expect(net?.current.drill.filters.period).toEqual({ preset: 'custom', range: { from: '2026-01-01', to: '2026-09-30' } })
  })

  it('compares a quarter with the one before when both are complete', () => {
    const review = periodReview(rows, { preset: 'quarter', year: 2026, quarter: 2 }, window)
    const income = review.lines.find((line) => line.line === 'income')

    expect(review.prior?.period).toEqual({ preset: 'quarter', year: 2026, quarter: 1 })
    expect([review.partOfPeriod, review.current.partial, review.prior?.partial]).toEqual([false, false, false])
    expect(income).toMatchObject({ current: { amount: euros(5000) }, prior: { amount: euros(7000) }, change: euros(-2000) })
    expect(income?.current.drill).toEqual({
      filters: { period: { preset: 'quarter', year: 2026, quarter: 2 }, buckets: ['income'] },
    })
  })

  it('splits the period by month, each month linked to its rows', () => {
    const review = periodReview(rows, { preset: 'quarter', year: 2026, quarter: 2 }, window)

    expect(review.months.map((month) => [month.month, month.income.amount, month.cost.amount, month.net.amount])).toEqual([
      ['2026-04', euros(5000), euros(0), euros(5000)],
      ['2026-05', euros(0), euros(200), euros(-200)],
      ['2026-06', euros(0), euros(0), euros(0)],
    ])
  })
})

describe('reviewPeriodOf', () => {
  const window = windowOf('2025-06-16', '2026-10-05')

  it('keeps a year, quarter or custom range as it is', () => {
    expect(reviewPeriodOf({ preset: 'quarter', year: 2026, quarter: 2 }, window)).toEqual({ preset: 'quarter', year: 2026, quarter: 2 })
  })

  it('opens on the last complete quarter when the shared period is a rolling window', () => {
    expect(reviewPeriodOf({ preset: 'l12' }, window)).toEqual({ preset: 'quarter', year: 2026, quarter: 3 })
    expect(reviewPeriodOf({ preset: 'all' }, windowOf('2025-06-16', '2026-01-05'))).toEqual({ preset: 'quarter', year: 2025, quarter: 4 })
    expect(reviewPeriodOf({ preset: 'l3' }, windowOf('2025-06-16', '2026-05-05'))).toEqual({ preset: 'quarter', year: 2026, quarter: 1 })
  })
})
