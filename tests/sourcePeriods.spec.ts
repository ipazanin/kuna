import { describe, expect, it } from 'vitest'

import { derivedSources } from '../src/apps/spending/accounts/domain/derivedSources'
import {
  handedDays,
  periodsChangeRefusal,
  periodsFrom,
  periodsOfText,
  periodsOver,
  periodsRefusal,
  periodsSince,
  periodsText,
  periodTallies,
  sourceOn,
  takesRowOn,
} from '../src/shared/app/accountSource'
import type { SourcePeriod } from '../src/shared/app/accountSource'
import { parseCivilDate } from '../src/shared/calendar/civilDate'
import { civil } from './fixtures/ledger'
import { OTP, row } from './fixtures/spending'

const FILE_THEN_LINK: readonly SourcePeriod[] = [
  { source: 'provider-file', from: null },
  { source: 'bank-link', from: civil('2026-06-01') },
]

describe("an account's source periods", () => {
  it('give each day the source of the period it falls in, the first from the start', () => {
    expect([sourceOn(FILE_THEN_LINK, civil('2020-01-01')), sourceOn(FILE_THEN_LINK, civil('2026-05-31')), sourceOn(FILE_THEN_LINK, civil('2026-06-01'))]).toEqual([
      'provider-file',
      'provider-file',
      'bank-link',
    ])
  })

  it.each([
    ['bank-link', 'automation', true],
    ['bank-link', 'provider-file', false],
    ['bank-link', 'by-hand', false],
    ['provider-file', 'provider-file', true],
    ['provider-file', 'by-hand', false],
    ['provider-file', 'automation', false],
    ['by-hand', 'by-hand', true],
    ['by-hand', 'provider-file', true],
    ['by-hand', 'automation', false],
  ] as const)('on a day of %s take a row of %s: %s', (source, origin, takes) => {
    expect(takesRowOn([{ source, from: null }], civil('2026-06-10'), origin)).toBe(takes)
  })

  it('hand the days from a day on to one source, and join two periods of one source in a row', () => {
    expect(periodsFrom(FILE_THEN_LINK, 'by-hand', civil('2026-07-01'))).toEqual([...FILE_THEN_LINK, { source: 'by-hand', from: civil('2026-07-01') }])
    expect(periodsFrom(FILE_THEN_LINK, 'provider-file', civil('2026-07-01'))).toEqual([...FILE_THEN_LINK, { source: 'provider-file', from: civil('2026-07-01') }])
    expect(periodsFrom(FILE_THEN_LINK, 'provider-file', civil('2026-06-01'))).toEqual([{ source: 'provider-file', from: null }])
    expect(periodsFrom(FILE_THEN_LINK, 'bank-link', null)).toEqual([{ source: 'bank-link', from: null }])
  })

  it('give a run of days a lapsed link missed to the statement file, and the link takes over again after it', () => {
    expect(periodsOver([{ source: 'bank-link', from: null }], 'provider-file', civil('2026-03-10'), civil('2026-03-20'))).toEqual([
      { source: 'bank-link', from: null },
      { source: 'provider-file', from: civil('2026-03-10') },
      { source: 'bank-link', from: civil('2026-03-21') },
    ])
    expect(periodsOver(FILE_THEN_LINK, 'provider-file', civil('2026-06-01'), civil('2026-06-05'))).toEqual([
      { source: 'provider-file', from: null },
      { source: 'bank-link', from: civil('2026-06-06') },
    ])
  })

  it('start from a later start day with the source that day falls in', () => {
    expect(periodsSince(FILE_THEN_LINK, civil('2026-06-15'))).toEqual([{ source: 'bank-link', from: null }])
    expect(periodsSince(FILE_THEN_LINK, civil('2026-01-01'))).toEqual(FILE_THEN_LINK)
  })

  it('read and write the sources cell, and refuse a list that cannot be kept', () => {
    expect(periodsText(FILE_THEN_LINK)).toBe('provider-file, bank-link 2026-06-01')
    expect(periodsOfText('provider-file, bank-link 2026-06-01', ['provider-file', 'bank-link', 'by-hand'], parseCivilDate)).toEqual(FILE_THEN_LINK)
    for (const text of ['mail', 'by-hand 2026-01-01', 'by-hand, bank-link', 'by-hand, by-hand 2026-01-01', 'by-hand, bank-link 2026-06-01, by-hand 2026-05-01', 'by-hand, bank-link 2026-13-01'])
      expect(periodsOfText(text, ['provider-file', 'bank-link', 'by-hand'], parseCivilDate)).toBeNull()
    expect(periodsRefusal([])).toBe('none')
  })

  it('name the days a change gives to another source, with the source before and after', () => {
    expect(
      handedDays(FILE_THEN_LINK, [
        { source: 'provider-file', from: null },
        { source: 'bank-link', from: civil('2026-05-01') },
      ]),
    ).toEqual([{ from: civil('2026-05-01'), to: civil('2026-05-31'), before: 'provider-file', after: 'bank-link' }])
    expect(handedDays(FILE_THEN_LINK, FILE_THEN_LINK)).toEqual([])
    expect(handedDays([{ source: 'by-hand', from: null }], [{ source: 'bank-link', from: null }])).toEqual([{ from: null, to: null, before: 'by-hand', after: 'bank-link' }])
  })

  it('refuse a change that leaves rows on the handed days their new source would not take, and one that reaches a filed day', () => {
    const after = [
      { source: 'provider-file' as const, from: null },
      { source: 'bank-link' as const, from: civil('2026-05-01') },
    ]
    const rows = [
      { date: civil('2026-05-10'), origin: 'provider-file' as const },
      { date: civil('2026-05-11'), origin: 'automation' as const },
      { date: civil('2026-04-10'), origin: 'provider-file' as const },
    ]
    expect(periodsChangeRefusal(FILE_THEN_LINK, after, rows, null)).toMatchObject({ kind: 'rows-of-another-source', count: 1 })
    expect(periodsChangeRefusal(FILE_THEN_LINK, after, rows.slice(1), null)).toBeNull()
    expect(periodsChangeRefusal(FILE_THEN_LINK, after, [], civil('2026-06-01'))).toMatchObject({ kind: 'filed', firstOpen: civil('2026-06-01') })
  })

  it('count the rows each origin brought in each period', () => {
    const rows = [
      { date: civil('2026-05-10'), origin: 'provider-file' as const },
      { date: civil('2026-05-11'), origin: 'by-hand' as const },
      { date: civil('2026-06-02'), origin: 'automation' as const },
    ]
    expect(periodTallies(FILE_THEN_LINK, rows)).toEqual([
      { period: FILE_THEN_LINK[0], to: civil('2026-05-31'), counts: { automation: 0, 'provider-file': 1, 'by-hand': 1 } },
      { period: FILE_THEN_LINK[1], to: null, counts: { automation: 1, 'provider-file': 0, 'by-hand': 0 } },
    ])
  })
})

describe('the periods of a file from before periods', () => {
  const linked = { ...OTP, sources: [{ source: 'bank-link' as const, from: null }] }
  const fileRow = (date: string, key = date) => row(OTP, date, -5, null, { source: 'statement', importKey: `0123456789abcdef-${key}` })
  const syncRow = (date: string, pending = false) => row(OTP, date, -5, null, { source: 'statement', importKey: `bank-${date}`, pending })

  it('keep an account kept by hand by hand, which takes files too', () => {
    expect(derivedSources({ ...OTP, sources: [{ source: 'by-hand', from: null }] }, [fileRow('2026-10-01')])).toEqual([{ source: 'by-hand', from: null }])
  })

  it('keep a bank-linked account with no file row on the bank link', () => {
    expect(derivedSources(linked, [syncRow('2026-10-01'), row(OTP, '2026-10-02', -1, null)])).toEqual([{ source: 'bank-link', from: null }])
  })

  it('give the files their days and the bank link the days from its first row on', () => {
    expect(derivedSources(linked, [fileRow('2026-09-01'), fileRow('2026-09-20'), syncRow('2026-09-25'), syncRow('2026-09-10', true)])).toEqual([
      { source: 'provider-file', from: null },
      { source: 'bank-link', from: civil('2026-09-25') },
    ])
  })

  it('give the bank link the day after the last file row while it brought none', () => {
    expect(derivedSources(linked, [fileRow('2026-09-01'), fileRow('2026-09-20')])).toEqual([
      { source: 'provider-file', from: null },
      { source: 'bank-link', from: civil('2026-09-21') },
    ])
  })

  it("give a lapsed link's days the file filled to the file, and the link its days again after them", () => {
    expect(derivedSources(linked, [syncRow('2026-09-01'), fileRow('2026-09-10'), fileRow('2026-09-15'), syncRow('2026-09-20')])).toEqual([
      { source: 'bank-link', from: null },
      { source: 'provider-file', from: civil('2026-09-10') },
      { source: 'bank-link', from: civil('2026-09-20') },
    ])
  })

  it('leave a day both sources brought with the source before it', () => {
    expect(derivedSources(linked, [fileRow('2026-09-10'), syncRow('2026-09-10'), syncRow('2026-09-11')])).toEqual([
      { source: 'provider-file', from: null },
      { source: 'bank-link', from: civil('2026-09-11') },
    ])
  })
})
