import { describe, expect, it, vi } from 'vitest'

import { civilDate } from '../src/shared/calendar/civilDate'
import { dateFormat } from '../src/shared/calendar/dateFormat'
import { dayLabel, shortDayLabel } from '../src/shared/calendar/dayLabel'
import { monthKey } from '../src/shared/calendar/monthKey'
import { monthAxisLabel, monthInYear, monthLabel, monthName, shortMonthLabel, shortMonthName } from '../src/shared/calendar/monthLabel'
import { syncAge } from '../src/shared/calendar/syncAge'

const september = monthKey(2026, 9)
const twentieth = civilDate(2026, 9, 20)

describe('short months in English', () => {
  it('writes September as Sep in every day and month label', () => {
    expect(dayLabel(twentieth)).toBe('20 Sep 2026')
    expect(shortDayLabel(twentieth)).toBe('20 Sep')
    expect(monthLabel(september)).toBe('Sep 2026')
    expect(shortMonthLabel(september)).toBe('Sep 26')
    expect(shortMonthName(september)).toBe('Sep')
  })

  it('writes Sep on a chart axis and in its tooltip', () => {
    expect(monthAxisLabel('short')('2026-09')).toBe('Sep 26')
    expect(monthAxisLabel('long')('2026-09')).toBe('Sep 2026')
  })

  it('writes Sep in a sync age and a date with a time', () => {
    expect(syncAge(new Date(2026, 8, 20, 9, 0), new Date(2026, 9, 17, 14, 30))).toBe('on 20 Sep')
    expect(dateFormat({ dateStyle: 'medium', timeZone: 'UTC' })(Date.UTC(2026, 8, 20))).toBe('20 Sep 2026')
  })

  it('leaves the long name and the other months as they were', () => {
    expect(monthName(september)).toBe('September')
    expect(monthInYear(september, 2025)).toBe('September 2026')
    expect(monthLabel(monthKey(2026, 10))).toBe('Oct 2026')
  })
})

describe('short months in Croatian', () => {
  it('keeps Croatian short months', async () => {
    vi.resetModules()
    vi.doMock('../src/shared/text/language', () => ({ intlLocale: 'hr-HR' }))
    const croatian = await import('../src/shared/calendar/monthLabel')
    const croatianDays = await import('../src/shared/calendar/dayLabel')
    expect(croatian.shortMonthName(september)).toBe('ruj')
    expect(croatian.monthLabel(september)).toBe('ruj 2026.')
    expect(croatianDays.dayLabel(twentieth)).toBe('20. ruj 2026.')
    vi.doUnmock('../src/shared/text/language')
  })
})
