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
  it('compares a rolling window with the same days one window earlier, up to the newest row’s day', () => {
    const onTheTwentyNinth = windowOf('2025-05-14', '2026-10-29')

    expect(priorEqualPeriod({ preset: 'l12' }, onTheTwentyNinth)).toEqual({ preset: 'custom', range: { from: '2024-11-01', to: '2025-10-29' } })
    expect(priorEqualPeriod({ preset: 'l3' }, onTheTwentyNinth)).toEqual({ preset: 'custom', range: { from: '2026-05-01', to: '2026-07-29' } })
  })

  it('ends the earlier window on its month’s last day when that month is shorter', () => {
    expect(priorEqualPeriod({ preset: 'l3' }, windowOf('2025-05-14', '2026-05-31'))).toEqual({ preset: 'custom', range: { from: '2025-12-01', to: '2026-02-28' } })
    expect(priorEqualPeriod({ preset: 'l12' }, windowOf('2025-05-14', '2028-02-29'))).toEqual({ preset: 'custom', range: { from: '2026-03-01', to: '2027-02-28' } })
  })

  it('compares a calendar period with the one before it, and all time with nothing', () => {
    expect(priorEqualPeriod({ preset: 'year', year: 2026 }, window)).toEqual({ preset: 'year', year: 2025 })
    expect(priorEqualPeriod({ preset: 'all' }, window)).toBeNull()
  })
})
