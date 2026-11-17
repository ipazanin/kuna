import { describe, expect, it } from 'vitest'

import { BY_HAND, earliestStartDay, proposedStartDay, startDayRefusal, takesRowFrom } from '../src/shared/app/accountSource'
import type { AccountIntake } from '../src/shared/app/accountSource'
import { parseCivilDate } from '../src/shared/calendar/civilDate'
import type { CivilDate } from '../src/shared/calendar/civilDate'

function day(text: string): CivilDate {
  return parseCivilDate(text)!
}

const MAILED: AccountIntake<'mail'> = { rowsFrom: 'mail', startsOn: day('2026-06-01'), alsoFrom: [] }

describe('a new row on an account', () => {
  it.each([
    ['by-hand', [], 'by-hand', true],
    ['by-hand', [], 'provider-file', true],
    ['mail', [], 'automation', true],
    ['mail', [], 'provider-file', false],
    ['mail', ['provider-file'], 'provider-file', true],
    ['mail', ['provider-file'], 'by-hand', false],
    ['bank-link', [], 'by-hand', false],
    ['bank-link', [], 'automation', true],
  ] as const)('%s, also from %o, takes a row %s: %s', (rowsFrom, alsoFrom, origin, takes) => {
    expect(takesRowFrom(rowsFrom, alsoFrom, origin)).toBe(takes)
  })
})

describe('a start day that gives the automation more days', () => {
  const firstOpen = day('2026-10-01')

  it('is refused before the first day not filed, and taken on it', () => {
    expect(startDayRefusal(null, { ...MAILED, startsOn: day('2026-09-30') }, [], firstOpen)).toEqual({ kind: 'filed', startsOn: '2026-09-30', firstOpen: '2026-10-01' })
    expect(startDayRefusal(null, { ...MAILED, startsOn: firstOpen }, [], firstOpen)).toBeNull()
  })

  it('refuses no day when nothing is filed', () => {
    expect(startDayRefusal(null, { ...MAILED, startsOn: day('2020-01-01') }, [], null)).toBeNull()
  })

  it('is refused over rows by hand on the days it gives, and keeps rows by hand before it', () => {
    const handDays = [day('2026-05-31'), day('2026-07-01')]
    expect(startDayRefusal(BY_HAND, MAILED, handDays, null)).toEqual({ kind: 'rows-by-hand', count: 1, startsOn: '2026-06-01' })
    expect(startDayRefusal(BY_HAND, { ...MAILED, startsOn: day('2026-07-02') }, handDays, null)).toBeNull()
  })

  it('checks nothing for a later start day or a switch to by hand', () => {
    const handDays = [day('2026-07-01')]
    expect(startDayRefusal(MAILED, { ...MAILED, startsOn: day('2026-06-15') }, handDays, firstOpen)).toBeNull()
    expect(startDayRefusal(MAILED, BY_HAND, handDays, firstOpen)).toBeNull()
  })
})

describe('the start day proposed', () => {
  it.each([
    ['today with no row by hand', [], null, '2026-11-17'],
    ['the day after the last row by hand', ['2026-07-01', '2026-08-31'], null, '2026-09-01'],
    ['the first day not filed after a row in a filed time', ['2026-03-01'], '2026-10-01', '2026-10-01'],
  ])('is %s', (_label, handDays, firstOpen, proposed) => {
    expect(proposedStartDay(handDays.map(day), day('2026-11-17'), firstOpen === null ? null : day(firstOpen))).toBe(proposed)
  })
})

describe('where an automation starts', () => {
  it('is the earliest start day of the accounts it fills, or null while it fills none', () => {
    expect(earliestStartDay([BY_HAND, MAILED, { ...MAILED, startsOn: day('2026-03-01') }])).toBe('2026-03-01')
    expect(earliestStartDay([BY_HAND])).toBeNull()
  })
})
