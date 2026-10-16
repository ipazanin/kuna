import { describe, expect, it } from 'vitest'

import { periodRange, transactionsInPeriod } from '../src/features/filters/domain/filterState'
import { civil, ledger, windowOf } from './fixtures/ledger'

const window = windowOf('2025-06-12', '2026-10-16')

describe('periodRange', () => {
  it('ends the rolling periods with the last complete month', () => {
    expect(periodRange({ preset: 'l3' }, window)).toEqual({ from: '2026-07-01', to: '2026-09-30' })
    expect(periodRange({ preset: 'l12' }, window)).toEqual({ from: '2025-10-01', to: '2026-09-30' })
  })

  it('covers calendar years, quarters and custom ranges as given', () => {
    expect(periodRange({ preset: 'year', year: 2025 }, window)).toEqual({ from: '2025-01-01', to: '2025-12-31' })
    expect(periodRange({ preset: 'quarter', year: 2026, quarter: 1 }, window)).toEqual({ from: '2026-01-01', to: '2026-03-31' })
    expect(periodRange({ preset: 'quarter', year: 2026, quarter: 4 }, window)).toEqual({ from: '2026-10-01', to: '2026-12-31' })
    const range = { from: civil('2026-02-10'), to: civil('2026-03-05') }
    expect(periodRange({ preset: 'custom', range }, window)).toBe(range)
  })

  it('puts no date bound on all', () => {
    expect(periodRange({ preset: 'all' }, window)).toBeNull()
  })

  it('selects the rows of a period, part-months included only where the period reaches them', () => {
    const rows = ledger([
      { date: '2025-06-12', amount: 1 },
      { date: '2026-09-30', amount: 2 },
      { date: '2026-10-16', amount: 3 },
    ])

    expect(transactionsInPeriod(rows, { preset: 'l3' }, window).map((row) => row.amount)).toEqual([200])
    expect(transactionsInPeriod(rows, { preset: 'all' }, window)).toHaveLength(3)
    expect(transactionsInPeriod(rows, { preset: 'year', year: 2026 }, window)).toHaveLength(2)
  })
})
