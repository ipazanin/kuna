import { describe, expect, it } from 'vitest'

import { priorEqualPeriod, priorPeriod } from '../src/apps/company/filters/domain/periodComparison'
import { civil, windowOf } from './fixtures/ledger'

const window = windowOf('2025-05-14', '2026-10-08')

describe('priorPeriod', () => {
  it('steps back a year, a quarter across the year end, or an equal run of days', () => {
    expect(priorPeriod({ preset: 'year', year: 2026 })).toEqual({ preset: 'year', year: 2025 })
    expect(priorPeriod({ preset: 'quarter', year: 2026, quarter: 1 })).toEqual({ preset: 'quarter', year: 2025, quarter: 4 })
    expect(priorPeriod({ preset: 'custom', range: { from: civil('2026-03-01'), to: civil('2026-03-10') } })).toEqual({
      preset: 'custom',
      range: { from: '2026-02-19', to: '2026-02-28' },
    })
  })
})

describe('priorEqualPeriod', () => {
  it('compares a rolling window with as many complete months just before it', () => {
    expect(priorEqualPeriod({ preset: 'l3' }, window)).toEqual({ preset: 'custom', range: { from: '2026-04-01', to: '2026-06-30' } })
    expect(priorEqualPeriod({ preset: 'l12' }, window)).toEqual({ preset: 'custom', range: { from: '2024-10-01', to: '2025-09-30' } })
  })

  it('compares a calendar period with the one before it, and all time with nothing', () => {
    expect(priorEqualPeriod({ preset: 'year', year: 2026 }, window)).toEqual({ preset: 'year', year: 2025 })
    expect(priorEqualPeriod({ preset: 'all' }, window)).toBeNull()
  })
})
