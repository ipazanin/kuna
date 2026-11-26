import { afterEach, describe, expect, it, vi } from 'vitest'

import { monthKey } from '../src/shared/calendar/monthKey'
import { periodInWords } from '../src/shared/calendar/periodInWords'
import { civil, windowOf } from './fixtures/ledger'

// The ledger starts on 14 Jun 2025 and its newest row is 16 Oct 2026.
const window = windowOf('2025-06-14', '2026-10-16')

async function inCroatian(): Promise<typeof periodInWords> {
  vi.resetModules()
  vi.doMock('../src/shared/text/language', () => ({ language: 'hr', intlLocale: 'hr-HR' }))
  return (await import('../src/shared/calendar/periodInWords')).periodInWords
}

afterEach(() => {
  vi.doUnmock('../src/shared/text/language')
})

describe('periodInWords', () => {
  it('names the months of a rolling period and notes the month so far', () => {
    expect(periodInWords({ preset: 'l12' }, window)).toBe('Nov 2025 – Oct 2026, Oct so far')
    expect(periodInWords({ preset: 'l3' }, window)).toBe('Aug – Oct 2026, Oct so far')
  })

  it('names the days of the window a rolling period is compared with', () => {
    expect(periodInWords({ preset: 'custom', range: { from: civil('2024-11-01'), to: civil('2025-10-16') } }, window)).toBe('1 Nov 2024 – 16 Oct 2025')
  })

  it('notes the month so far when the period reaches it', () => {
    expect(periodInWords({ preset: 'year', year: 2026 }, window)).toBe('Jan – Dec 2026, Oct so far')
    expect(periodInWords({ preset: 'quarter', year: 2026, quarter: 4 }, window)).toBe('Oct – Dec 2026, Oct so far')
  })

  it('notes both part-months for all time', () => {
    expect(periodInWords({ preset: 'all' }, window)).toBe('Jun 2025 – Oct 2026, Jun in part and Oct so far')
  })

  it('notes only the month so far when the ledger starts in it', () => {
    expect(periodInWords({ preset: 'all' }, windowOf('2026-10-05', '2026-10-16'))).toBe('Oct 2026, Oct so far')
  })

  it('names whole months when a custom range starts and ends on their edges', () => {
    expect(periodInWords({ preset: 'custom', range: { from: civil('2024-10-01'), to: civil('2025-09-30') } }, window)).toBe('Oct 2024 – Sep 2025, Jun in part')
    expect(periodInWords({ preset: 'custom', range: { from: civil('2025-09-01'), to: civil('2025-10-31') } }, window)).toBe('Sep – Oct 2025')
    expect(periodInWords({ preset: 'month', month: monthKey(2025, 9) }, window)).toBe('Sep 2025')
  })

  it('names the days of any other custom range, its year once within a year', () => {
    expect(periodInWords({ preset: 'custom', range: { from: civil('2026-03-04'), to: civil('2026-05-20') } }, window)).toBe('4 Mar – 20 May 2026')
    expect(periodInWords({ preset: 'custom', range: { from: civil('2026-03-04'), to: civil('2026-03-20') } }, window)).toBe('4–20 Mar 2026')
  })

  it('names the year once in Croatian when both ends share it, and on both sides when they do not', async () => {
    const croatian = await inCroatian()

    expect(croatian({ preset: 'custom', range: { from: civil('2025-09-01'), to: civil('2025-10-31') } }, window)).toBe('rujan – listopad\u00a02025.')
    expect(croatian({ preset: 'custom', range: { from: civil('2024-10-01'), to: civil('2025-09-30') } }, window)).toBe('listopad\u00a02024. – rujan\u00a02025., lipanj djelomično')
    expect(croatian({ preset: 'custom', range: { from: civil('2025-09-01'), to: civil('2025-09-30') } }, window)).toBe('rujan\u00a02025.')
    expect(croatian({ preset: 'custom', range: { from: civil('2026-03-04'), to: civil('2026-05-20') } }, window)).toBe('4.\u00a03. – 20.\u00a05.\u00a02026.')
  })
})
