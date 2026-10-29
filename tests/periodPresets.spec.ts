import { describe, expect, it } from 'vitest'

import { averagedPeriod, ledgerYears, periodMonths, periodWithPreset } from '../src/apps/company/filters/domain/periodPresets'
import { civil, windowOf } from './fixtures/ledger'

// Complete months run from 2025-06 to 2026-09. October 2026 is the part-month.
const window = windowOf('2025-05-14', '2026-10-08')

describe('periodWithPreset', () => {
  it('names the last complete month’s year and quarter when the current period names none', () => {
    expect(periodWithPreset({ preset: 'l12' }, 'year', window)).toEqual({ preset: 'year', year: 2026 })
    expect(periodWithPreset({ preset: 'l3' }, 'quarter', window)).toEqual({ preset: 'quarter', year: 2026, quarter: 3 })
  })

  it('keeps the year when moving between a year and a quarter', () => {
    expect(periodWithPreset({ preset: 'year', year: 2025 }, 'quarter', window)).toEqual({ preset: 'quarter', year: 2025, quarter: 3 })
    expect(periodWithPreset({ preset: 'quarter', year: 2025, quarter: 4 }, 'year', window)).toEqual({ preset: 'year', year: 2025 })
  })

  it('opens a custom range on the days the current period covers', () => {
    expect(periodWithPreset({ preset: 'l3' }, 'custom', window)).toEqual({
      preset: 'custom',
      range: { from: civil('2026-08-01'), to: civil('2026-10-31') },
    })
    expect(periodWithPreset({ preset: 'all' }, 'custom', window)).toEqual({
      preset: 'custom',
      range: { from: civil('2025-05-01'), to: civil('2026-10-31') },
    })
  })
})

describe('ledgerYears', () => {
  it('lists every year the ledger touches, newest first', () => {
    expect(ledgerYears(window)).toEqual([2026, 2025])
  })
})

describe('periodMonths', () => {
  it('ends a rolling window with the part month, once', () => {
    expect(periodMonths({ preset: 'l3' }, window)).toEqual(['2026-08', '2026-09', '2026-10'])
  })

  it('clips a calendar period to the months the ledger holds', () => {
    expect(periodMonths({ preset: 'year', year: 2025 }, window)).toEqual(['2025-05', '2025-06', '2025-07', '2025-08', '2025-09', '2025-10', '2025-11', '2025-12'])
    expect(periodMonths({ preset: 'year', year: 2024 }, window)).toEqual([])
  })
})

describe('averagedPeriod', () => {
  it('leaves the part month out of a rolling window', () => {
    expect(averagedPeriod({ preset: 'l12' }, window)).toEqual({ preset: 'custom', range: { from: '2025-11-01', to: '2026-09-30' } })
    expect(periodMonths(averagedPeriod({ preset: 'l3' }, window), window)).toEqual(['2026-08', '2026-09'])
  })

  it('keeps any other period as it is, the month so far included', () => {
    const year = { preset: 'year', year: 2026 } as const
    expect(averagedPeriod(year, window)).toBe(year)
    expect(averagedPeriod({ preset: 'all' }, window)).toEqual({ preset: 'all' })
  })
})
