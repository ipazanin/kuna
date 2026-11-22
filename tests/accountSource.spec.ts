import { describe, expect, it } from 'vitest'

import { datedPeriodsRefusal, earliestFrom, givenDays, periodsChangeRefusal, periodsOfIntake, proposedStartDay, runsOf, takesRowOn } from '../src/shared/app/accountSource'
import type { SourcePeriod } from '../src/shared/app/accountSource'
import { parseCivilDate } from '../src/shared/calendar/civilDate'
import type { CivilDate } from '../src/shared/calendar/civilDate'

function day(text: string): CivilDate {
  return parseCivilDate(text)!
}

const BY_HAND: readonly SourcePeriod[] = [{ source: 'by-hand', from: null }]
const MAILED: readonly SourcePeriod[] = [{ source: 'mail', from: day('2026-06-01') }]

describe('an account whose first period starts on a day of its own', () => {
  it('takes no row before that day, and the mail rows from it', () => {
    expect(takesRowOn(MAILED, day('2026-05-31'), 'automation')).toBe(false)
    expect(takesRowOn(MAILED, day('2026-06-01'), 'automation')).toBe(true)
    expect(takesRowOn(MAILED, day('2026-06-01'), 'provider-file')).toBe(false)
  })

  it('needs the day on a first period of an automation, and keeps the other rules of periods', () => {
    expect(datedPeriodsRefusal(MAILED, ['mail'])).toBeNull()
    expect(datedPeriodsRefusal([{ source: 'mail', from: null }], ['mail'])).toBe('first-without-day')
    expect(datedPeriodsRefusal(BY_HAND, ['mail'])).toBeNull()
    expect(datedPeriodsRefusal([...MAILED, { source: 'by-hand', from: day('2026-05-01') }], ['mail'])).toBe('out-of-order')
  })

  it('gives the days a start moved earlier to its source, and only those days', () => {
    const earlier: readonly SourcePeriod[] = [{ source: 'mail', from: day('2026-03-01') }]
    expect(givenDays(MAILED, earlier)).toEqual([{ from: '2026-03-01', to: '2026-05-31', after: 'mail' }])
    expect(givenDays(earlier, MAILED)).toEqual([])
    expect(givenDays(BY_HAND, MAILED)).toEqual([])
  })
})

describe('a change of periods over days that took no row', () => {
  const firstOpen = day('2026-10-01')

  it('is refused when a start moved earlier reaches a filed day, and taken from the first day not filed', () => {
    expect(periodsChangeRefusal([{ source: 'mail', from: day('2026-11-01') }], [{ source: 'mail', from: day('2026-09-30') }], [], firstOpen)).toEqual({
      kind: 'filed',
      firstOpen: '2026-10-01',
      day: '2026-09-30',
    })
    expect(periodsChangeRefusal([{ source: 'mail', from: day('2026-11-01') }], [{ source: 'mail', from: firstOpen }], [], firstOpen)).toBeNull()
  })

  it('counts the rows on the days given that the new source would not take', () => {
    const rows = [
      { date: day('2026-05-15'), origin: 'by-hand' as const },
      { date: day('2026-06-15'), origin: 'automation' as const },
    ]
    expect(periodsChangeRefusal(MAILED, [{ source: 'mail', from: day('2026-05-01') }], rows, null)).toEqual({ kind: 'rows-of-another-source', count: 1 })
  })
})

describe('a file from before periods', () => {
  it('reads one way its rows came in as periods, an automation from its start day after the provider file it also took', () => {
    expect(periodsOfIntake(null)).toEqual([{ source: 'by-hand', from: null }])
    expect(periodsOfIntake({ source: 'mail', startsOn: day('2026-06-01'), takesFile: false })).toEqual([{ source: 'mail', from: '2026-06-01' }])
    expect(periodsOfIntake({ source: 'mail', startsOn: day('2026-06-01'), takesFile: true })).toEqual([
      { source: 'provider-file', from: null },
      { source: 'mail', from: '2026-06-01' },
    ])
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
  it('is the earliest day a period of it starts on among the accounts, or null while it fills none', () => {
    expect(
      earliestFrom(
        [
          BY_HAND,
          MAILED,
          [
            { source: 'by-hand', from: null },
            { source: 'mail', from: day('2026-03-01') },
          ],
        ],
        'mail',
      ),
    ).toBe('2026-03-01')
    expect(earliestFrom([BY_HAND], 'mail')).toBeNull()
  })

  it('reads each run of its days, to the day before the next period', () => {
    const periods: readonly SourcePeriod[] = [...MAILED, { source: 'provider-file', from: day('2026-08-01') }, { source: 'mail', from: day('2026-08-11') }]
    expect(runsOf(periods, 'mail')).toEqual([
      { from: '2026-06-01', to: '2026-07-31' },
      { from: '2026-08-11', to: null },
    ])
  })
})
