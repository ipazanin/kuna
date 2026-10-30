import { describe, expect, it } from 'vitest'

import { periodInWords } from '../src/apps/company/filters/domain/periodInWords'
import { civil, windowOf } from './fixtures/ledger'

// The ledger starts on 14 Jun 2025 and its newest row is 16 Oct 2026.
const window = windowOf('2025-06-14', '2026-10-16')

describe('periodInWords', () => {
  it('names the months of a rolling period and notes the month so far', () => {
    expect(periodInWords({ preset: 'l12' }, window)).toBe('Nov 2025 – Oct 2026, Oct so far')
    expect(periodInWords({ preset: 'l3' }, window)).toBe('Aug 2026 – Oct 2026, Oct so far')
  })

  it('names the days of the window a rolling period is compared with', () => {
    expect(periodInWords({ preset: 'custom', range: { from: civil('2024-11-01'), to: civil('2025-10-16') } }, window)).toBe('1 Nov 2024 – 16 Oct 2025')
  })

  it('notes the month so far when the period reaches it', () => {
    expect(periodInWords({ preset: 'year', year: 2026 }, window)).toBe('Jan 2026 – Dec 2026, Oct so far')
    expect(periodInWords({ preset: 'quarter', year: 2026, quarter: 4 }, window)).toBe('Oct 2026 – Dec 2026, Oct so far')
  })

  it('notes both part-months for all time', () => {
    expect(periodInWords({ preset: 'all' }, window)).toBe('Jun 2025 – Oct 2026, Jun in part and Oct so far')
  })

  it('names whole months when a custom range starts and ends on their edges', () => {
    expect(periodInWords({ preset: 'custom', range: { from: civil('2024-10-01'), to: civil('2025-09-30') } }, window)).toBe('Oct 2024 – Sep 2025, Jun in part')
  })

  it('names the days of any other custom range', () => {
    expect(periodInWords({ preset: 'custom', range: { from: civil('2026-03-04'), to: civil('2026-05-20') } }, window)).toBe('4 Mar 2026 – 20 May 2026')
  })
})
