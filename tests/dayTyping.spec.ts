import { describe, expect, it } from 'vitest'
import { CalendarDate } from '@internationalized/date'

import { isOutsideLimits, typedDayText } from '../src/shared/ui/dayTyping'

/** The day a field holds after each digit of a year typed one by one over 20 Nov. */
function yearTyped(digits: string): CalendarDate[] {
  return [...digits].map((_, typed) => new CalendarDate(Number(digits.slice(0, typed + 1)), 11, 20))
}

describe('typedDayText', () => {
  it('is blank until the year has four digits', () => {
    expect(yearTyped('2027').map(typedDayText)).toEqual(['', '', '', '2027-11-20'])
    expect(typedDayText(undefined)).toBe('')
  })
})

describe('isOutsideLimits', () => {
  const limits = { min: '2026-11-11', max: '2027-12-31' }

  it('takes each digit of a year typed one by one on its way to a day inside', () => {
    expect(yearTyped('2027').map((day) => isOutsideLimits(day, limits))).toEqual([false, false, false, false])
  })

  it('marks a whole day before the earliest or after the latest', () => {
    expect(isOutsideLimits(new CalendarDate(2025, 11, 20), limits)).toBe(true)
    expect(isOutsideLimits(new CalendarDate(2028, 1, 1), limits)).toBe(true)
  })

  it('takes the earliest and the latest day themselves', () => {
    expect(isOutsideLimits(new CalendarDate(2026, 11, 11), limits)).toBe(false)
    expect(isOutsideLimits(new CalendarDate(2027, 12, 31), limits)).toBe(false)
  })

  it('takes any day when no limit is given', () => {
    expect(isOutsideLimits(new CalendarDate(1999, 1, 1), {})).toBe(false)
    expect(isOutsideLimits(new CalendarDate(2099, 1, 1), { min: '2026-11-11' })).toBe(false)
  })
})
