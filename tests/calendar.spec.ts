import { describe, expect, it } from 'vitest'

import { addDays, civilDate, civilDateFromSerial, daysBetween, parseCivilDate } from '../src/shared/calendar/civilDate'
import { monthRange, monthsOfRange, overlapOf, rangeContains } from '../src/shared/calendar/dateRange'
import { allTime, anchorWindow, completeRange, isCompleteMonth, lastMonths, spanRange } from '../src/shared/calendar/ledgerWindow'
import { addMonths, dayMonthsLater, firstDayOf, lastDayOf, monthCountBetween, monthKey, monthOf, monthsFrom, parseMonthKey, wholeMonthsBetween } from '../src/shared/calendar/monthKey'
import { civil } from './fixtures/ledger'

describe('civil dates', () => {
  it('reads Sheets serial numbers as calendar days, with no time zone', () => {
    expect(civilDateFromSerial(46310)).toBe('2026-10-15')
    expect(civilDateFromSerial(45820)).toBe('2025-06-12')
    expect(civilDateFromSerial(46310.99)).toBe('2026-10-15')
    expect(civilDateFromSerial(60)).toBe('1900-02-28')
  })

  it('refuses a day the calendar does not have', () => {
    expect(() => civilDate(2026, 2, 29)).toThrow(RangeError)
    expect(civilDate(2028, 2, 29)).toBe('2028-02-29')
    expect(parseCivilDate('2026-13-01')).toBeNull()
    expect(parseCivilDate('16.10.2026')).toBeNull()
  })

  it('moves and measures by whole days', () => {
    expect(addDays(civil('2026-02-27'), 2)).toBe('2026-03-01')
    expect(addDays(civil('2026-01-01'), -1)).toBe('2025-12-31')
    expect(daysBetween(civil('2025-12-31'), civil('2026-01-02'))).toBe(2)
  })
})

describe('month keys', () => {
  it('steps across year ends both ways', () => {
    expect(addMonths(monthKey(2025, 12), 1)).toBe('2026-01')
    expect(addMonths(monthKey(2026, 1), -13)).toBe('2024-12')
  })

  it('counts and lists months with both ends included', () => {
    expect(monthCountBetween(monthKey(2025, 6), monthKey(2026, 9))).toBe(16)
    expect(monthCountBetween(monthKey(2026, 9), monthKey(2026, 8))).toBe(0)
    expect(monthsFrom(monthKey(2025, 11), monthKey(2026, 2))).toEqual(['2025-11', '2025-12', '2026-01', '2026-02'])
  })

  it('knows each month’s first and last day', () => {
    expect(firstDayOf(monthKey(2026, 2))).toBe('2026-02-01')
    expect(lastDayOf(monthKey(2026, 2))).toBe('2026-02-28')
    expect(lastDayOf(monthKey(2028, 2))).toBe('2028-02-29')
    expect(monthOf(civil('2026-10-16'))).toBe('2026-10')
    expect(parseMonthKey('2026-00')).toBeNull()
  })

  it('treats a range by the days it covers and the months it touches', () => {
    const range = { from: civil('2026-01-15'), to: civil('2026-03-02') }

    expect(rangeContains(range, civil('2026-03-02'))).toBe(true)
    expect(rangeContains(range, civil('2026-03-03'))).toBe(false)
    expect(monthsOfRange(range)).toEqual(['2026-01', '2026-02', '2026-03'])
    expect(monthRange(monthKey(2026, 4))).toEqual({ from: '2026-04-01', to: '2026-04-30' })
  })

  it('finds the days two ranges share', () => {
    const range = { from: civil('2026-01-15'), to: civil('2026-03-02') }

    expect(overlapOf(range, monthRange(monthKey(2026, 3)))).toEqual({ from: '2026-03-01', to: '2026-03-02' })
    expect(overlapOf(range, { from: civil('2026-03-02'), to: civil('2026-03-02') })).toEqual({ from: '2026-03-02', to: '2026-03-02' })
    expect(overlapOf(range, monthRange(monthKey(2026, 4)))).toBeNull()
  })

  it('steps a day by whole months, held to the end of a shorter month', () => {
    expect(dayMonthsLater(civil('2026-01-31'), 1)).toBe('2026-02-28')
    expect(dayMonthsLater(civil('2028-01-31'), 1)).toBe('2028-02-29')
    expect(dayMonthsLater(civil('2026-01-31'), 2)).toBe('2026-03-31')
    expect(dayMonthsLater(civil('2026-01-30'), 3)).toBe('2026-04-30')
    expect(dayMonthsLater(civil('2023-09-20'), 239)).toBe('2043-08-20')
    expect(dayMonthsLater(civil('2026-03-31'), -1)).toBe('2026-02-28')
    expect(dayMonthsLater(civil('2026-10-20'), 0)).toBe('2026-10-20')
  })

  it('counts the whole months between two days as dayMonthsLater steps them', () => {
    expect(wholeMonthsBetween(civil('2025-01-01'), civil('2025-02-01'))).toBe(1)
    expect(wholeMonthsBetween(civil('2025-01-01'), civil('2025-01-31'))).toBe(0)
    expect(wholeMonthsBetween(civil('2026-01-20'), civil('2026-03-19'))).toBe(1)
    expect(wholeMonthsBetween(civil('2026-01-31'), civil('2026-02-28'))).toBe(1)
    expect(wholeMonthsBetween(civil('2025-01-01'), civil('2055-01-01'))).toBe(360)
    expect(wholeMonthsBetween(civil('2026-05-01'), civil('2026-04-01'))).toBe(0)
  })
})

describe('ledger window', () => {
  it('ends with the month before the newest transaction, whatever the clock says', () => {
    const window = anchorWindow(civil('2025-06-12'), civil('2026-10-16'))

    expect(window.partMonth).toBe('2026-10')
    expect(window.newestDay).toBe('2026-10-16')
    expect(window.lastCompleteMonth).toBe('2026-09')
    expect(spanRange(lastMonths(window, 3))).toEqual({ from: '2026-07-01', to: '2026-09-30' })
    expect(spanRange(lastMonths(window, 12))).toEqual({ from: '2025-10-01', to: '2026-09-30' })
  })

  it('starts all time at the first complete month when the ledger opens mid-month', () => {
    const window = anchorWindow(civil('2025-06-12'), civil('2026-10-16'))

    expect(window.firstMonth).toBe('2025-06')
    expect(window.firstCompleteMonth).toBe('2025-07')
    expect(allTime(window)).toEqual({ from: '2025-07', to: '2026-09', monthCount: 15 })
    expect(completeRange(window)).toEqual({ from: '2025-07-01', to: '2026-09-30' })
    expect(isCompleteMonth(window, monthKey(2025, 6))).toBe(false)
    expect(isCompleteMonth(window, monthKey(2026, 10))).toBe(false)
  })

  it('counts the opening month as complete when the ledger opens on its first day', () => {
    expect(anchorWindow(civil('2025-06-01'), civil('2026-10-16')).firstCompleteMonth).toBe('2025-06')
  })

  it('divides a window by its length even where the ledger is younger', () => {
    const window = anchorWindow(civil('2026-08-01'), civil('2026-10-02'))

    expect(lastMonths(window, 12)).toEqual({ from: '2025-10', to: '2026-09', monthCount: 12 })
  })

  it('has no all-time span before the first complete month closes', () => {
    expect(allTime(anchorWindow(civil('2026-09-10'), civil('2026-10-02')))).toBeNull()
  })
})
