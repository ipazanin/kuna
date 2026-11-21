import { describe, expect, it } from 'vitest'

import type { Period } from '../src/shared/calendar/period'
import { periodOfText, periodText } from '../src/shared/calendar/periodText'
import { civil, month } from './fixtures/ledger'

describe('a period in an address', () => {
  it.each<[string, Period]>([
    ['l12', { preset: 'l12' }],
    ['all', { preset: 'all' }],
    ['2026', { preset: 'year', year: 2026 }],
    ['2026q3', { preset: 'quarter', year: 2026, quarter: 3 }],
    ['2026-03', { preset: 'month', month: month('2026-03') }],
    ['2026-01-05..2026-02-10', { preset: 'custom', range: { from: civil('2026-01-05'), to: civil('2026-02-10') } }],
  ])('reads %s back as the period it writes', (text, period) => {
    expect(periodOfText(text)).toEqual(period)
    expect(periodText(period)).toBe(text)
  })

  it('names no period for a span that runs backwards, a month that is none or other text', () => {
    expect(periodOfText('2026-02-10..2026-01-05')).toBeNull()
    expect(periodOfText('2026-13')).toBeNull()
    expect(periodOfText('next-year')).toBeNull()
    expect(periodOfText(null)).toBeNull()
  })
})
