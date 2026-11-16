import { afterEach, describe, expect, it, vi } from 'vitest'

import { dayRangeLabel } from '../src/shared/calendar/dayLabel'
import { civil } from './fixtures/ledger'

const range = (from: string, to: string) => ({ from: civil(from), to: civil(to) })

afterEach(() => {
  vi.doUnmock('../src/shared/text/language')
})

describe('a run of days in words', () => {
  it('writes the month and year once within a month, the year once within a year, and both days whole across years', () => {
    expect(dayRangeLabel(range('2026-11-13', '2026-11-17'))).toBe('13–17 Nov 2026')
    expect(dayRangeLabel(range('2026-10-28', '2026-11-03'))).toBe('28 Oct – 3 Nov 2026')
    expect(dayRangeLabel(range('2026-12-30', '2027-01-02'))).toBe('30 Dec 2026 – 2 Jan 2027')
    expect(dayRangeLabel(range('2026-11-13', '2026-11-13'))).toBe('13 Nov 2026')
  })

  it('writes Croatian days with their own full stops and no break inside a day', async () => {
    vi.resetModules()
    vi.doMock('../src/shared/text/language', () => ({ language: 'hr', intlLocale: 'hr-HR' }))
    const { dayRangeLabel: inCroatian } = await import('../src/shared/calendar/dayLabel')

    expect(inCroatian(range('2026-11-13', '2026-11-17'))).toBe('13.–17. 11. 2026.')
    expect(inCroatian(range('2026-10-28', '2026-11-03'))).toBe('28. 10. – 3. 11. 2026.')
    expect(inCroatian(range('2026-12-30', '2027-01-02'))).toBe('30. 12. 2026. – 2. 1. 2027.')
    expect(inCroatian(range('2026-11-13', '2026-11-13'))).toBe('13. 11. 2026.')
  })
})
