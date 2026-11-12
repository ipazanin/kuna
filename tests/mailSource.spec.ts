import { describe, expect, it } from 'vitest'

import {
  filedMailProperties,
  mailAddressesOf,
  mailAddressesFault,
  mailQuery,
  mailSinceDefault,
  mailPhraseFault,
  mailWindow,
  missingTerms,
  sourceTerms,
  strippedSubject,
  windowReaches,
  yearFolderName,
  yearsSince,
} from '../src/shared/mail-filing/domain/mailSource'
import { en as filingEnglish } from '../src/shared/mail-filing/application/words'
import { en } from '../src/shared/mail-filing/domain/words'
import { civilDate, civilDateIn, parseCivilDate, startOfDayIn } from '../src/shared/calendar/civilDate'

const SINCE = Date.parse('2024-12-31T23:00:00Z')

describe('a mail source', () => {
  it('searches from its senders and subject phrase for mail with attachments after the window, in epoch seconds', () => {
    const window = mailWindow(null, SINCE)

    expect(mailQuery({ senders: ['statements@bank.example.com', 'notices@bank.example.com'], subject: 'Izvadak' }, window)).toBe(
      'from:(statements@bank.example.com OR notices@bank.example.com) subject:"Izvadak" has:attachment after:1735686000',
    )
    expect(mailQuery({ senders: ['reports@broker.example.com'], subject: 'Račun za' }, window)).toBe('from:(reports@broker.example.com) subject:"Račun za" has:attachment after:1735686000')
  })

  it('starts from the mail-since day while its folder holds nothing, and a week before the newest file once that is later', () => {
    const newest = Date.parse('2026-10-20T08:30:00Z')

    expect(mailWindow(null, SINCE)).toEqual({ from: SINCE, after: 'since' })
    expect(mailWindow(newest, SINCE)).toEqual({ from: Date.parse('2026-10-13T08:30:00Z'), after: 'newest' })
    expect(mailWindow(SINCE + 86_400_000, SINCE)).toEqual({ from: SINCE, after: 'since' })
  })

  it('starts a blank mail-since day on 1 January of last year', () => {
    expect(mailSinceDefault(civilDate(2026, 10, 27))).toBe('2025-01-01')
    expect(mailSinceDefault(civilDate(2027, 1, 3))).toBe('2026-01-01')
  })

  it('lists the years from the mail-since day’s to today’s', () => {
    expect(yearsSince(civilDate(2026, 1, 1), civilDate(2026, 10, 27))).toEqual([2026])
    expect(yearsSince(civilDate(2024, 6, 1), civilDate(2026, 1, 2))).toEqual([2024, 2025, 2026])
    expect(yearsSince(civilDate(2027, 1, 1), civilDate(2026, 12, 31))).toEqual([2027])
  })

  it('is off while the books turn it off, and on without all it needs names what it lacks', () => {
    const terms = { senders: ['reports@broker.example.com'], subject: 'Activity statement', folder: ['finance', 'broker-reports'] }

    expect(sourceTerms(false, { senders: [], subject: '', folder: [] })).toEqual({ kind: 'off' })
    expect(sourceTerms(true, terms)).toEqual({ kind: 'on', terms })
    expect(sourceTerms(true, { ...terms, senders: [] })).toEqual({ kind: 'incomplete', missing: ['sender'] })
    expect(missingTerms({ senders: [], subject: '', folder: [] })).toEqual(['sender', 'subject', 'folder'])
    expect(filingEnglish.incompleteOnSettings(['sender'])).toBe('It is on, but has no sender on Settings, General')
    expect(filingEnglish.incompleteOnSettings(['sender', 'folder'])).toBe('It is on, but has no sender and no folder on Settings, General')
    expect(filingEnglish.incompleteOnSettings(['sender', 'subject', 'folder'])).toBe('It is on, but has no sender, no subject and no folder on Settings, General')
  })

  it('reaches back to a mail less than a week older than the newest it files, and no further', () => {
    const filed = Date.parse('2026-10-20T08:30:00Z')

    expect(windowReaches(Date.parse('2026-10-13T08:30:01Z'), filed)).toBe(true)
    expect(windowReaches(Date.parse('2026-10-13T08:30:00Z'), filed)).toBe(false)
  })

  it('names the folder of a year by the year and the source folder’s own name', () => {
    expect(yearFolderName(2026, ['work', 'dss', 'erste', 'statements'])).toBe('2026-statements')
    expect(yearFolderName('2026', ['finance', 'broker-reports'])).toBe('2026-broker-reports')
    expect(yearFolderName(2025, ['incoming-invoices'])).toBe('2025-incoming-invoices')
  })

  it('takes the replies’ prefixes off a subject', () => {
    expect(strippedSubject('RE: FW: Re:Izvadak 9/2026')).toBe('Izvadak 9/2026')
    expect(strippedSubject('Fwd: Račun za 8/25')).toBe('Račun za 8/25')
  })

  it('counts what it found in one line, with nothing new said when nothing was filed', () => {
    const none = { filed: 0, notFiled: 0, already: 0, unmatched: 0 }

    expect(filingEnglish.counts({ ...none, filed: 2, already: 50 })).toBe('Filed 2, already there 50')
    expect(filingEnglish.counts({ ...none, filed: 2, already: 50, unmatched: 1 })).toBe('Filed 2, already there 50, 1 unmatched')
    expect(filingEnglish.counts({ ...none, already: 50 })).toBe('Nothing new, already there 50')
    expect(filingEnglish.counts({ ...none, notFiled: 1, already: 50 })).toBe('Nothing filed, already there 50')
    expect(filingEnglish.counts({ ...none, filed: 1, notFiled: 1 })).toBe('Filed 1')
  })

  it('names the files that were not filed, two at most before it counts the rest', () => {
    expect(filingEnglish.notFiled(['a.pdf'])).toBe('a.pdf was not filed.')
    expect(filingEnglish.notFiled(['a.pdf', 'b.xml'])).toBe('a.pdf and b.xml were not filed.')
    expect(filingEnglish.notFiled(['a.pdf', 'b.xml', 'c.pdf', 'd.xml'])).toBe('a.pdf, b.xml and 2 more were not filed.')
  })

  it('marks a filed file with its source, the mail’s Gmail id and the mail’s date, each property within the 124 bytes Drive keeps with its key', () => {
    const properties = { 'kuna-mail': 'broker.flex-report', 'kuna-mail-id': '19a3f2c4b5d6e7f8', 'kuna-mail-date': '2026-10-14T12:00:00.000Z' }

    expect(filedMailProperties('broker.flex-report', { id: '19a3f2c4b5d6e7f8', date: Date.parse('2026-10-14T12:00:00Z') })).toEqual({ kind: 'kept', properties })
    expect(Object.entries(properties).map(([key, value]) => new TextEncoder().encode(`${key}${value}`).length)).toEqual([27, 28, 38])
    expect(filedMailProperties('statements', { id: 'x'.repeat(113), date: 0 })).toEqual({ kind: 'too-long', key: 'kuna-mail-id', most: 124 })
    expect(filingEnglish.propertyTooLong('kuna-mail-id', 124)).toBe('Its kuna-mail-id property would be longer than the 124 bytes Drive keeps')
    expect(filedMailProperties('statements', { id: 'x'.repeat(112), date: 0 })).toMatchObject({ kind: 'kept', properties: { 'kuna-mail-id': 'x'.repeat(112) } })
  })

  it('reads its senders as a comma-separated list in lower case, and refuses what is not a mail address', () => {
    expect(mailAddressesOf(' Statements@Bank.example.com,, notices@bank.example.com , statements@bank.example.com')).toEqual(['statements@bank.example.com', 'notices@bank.example.com'])
    expect(mailAddressesFault(['statements@bank.example.com'])).toBeNull()
    expect(mailAddressesFault(['bank.example.com', 'a@b'])).toEqual({ kind: 'not-addresses', addresses: ['bank.example.com', 'a@b'] })
    expect(en.searchFault({ kind: 'not-addresses', addresses: ['bank.example.com', 'a@b'] })).toBe('"bank.example.com", "a@b" are not mail addresses')
  })

  it('refuses a phrase with a double quote, which would end the phrase Gmail searches for, and one longer than 80 characters', () => {
    expect(mailPhraseFault('subject', 'Račun za')).toBeNull()
    expect(mailPhraseFault('subject', 'Izvod "dnevni"')).toEqual({ kind: 'quote', phrase: 'subject' })
    expect(en.searchFault({ kind: 'quote', phrase: 'subject' })).toBe('a subject cannot hold a double quote, which would end the phrase Gmail searches for')
    expect(mailPhraseFault('contents', 'x'.repeat(80))).toBeNull()
    expect(mailPhraseFault('contents', 'x'.repeat(81))).toEqual({ kind: 'too-long', phrase: 'contents', most: 80 })
    expect(en.searchFault({ kind: 'too-long', phrase: 'contents', most: 80 })).toBe('the contents can be at most 80 characters')
  })
})

describe('a day in a time zone', () => {
  it('is the day an instant falls on there, across midnight and the clock change', () => {
    expect(civilDateIn(Date.parse('2026-09-30T22:30:00Z'), 'Europe/Zagreb')).toBe('2026-10-01')
    expect(civilDateIn(Date.parse('2026-09-30T21:30:00Z'), 'Europe/Zagreb')).toBe('2026-09-30')
    expect(civilDateIn(Date.parse('2026-12-31T23:30:00Z'), 'Europe/Zagreb')).toBe('2027-01-01')
  })

  it('starts at that zone’s midnight, in winter and in summer time', () => {
    expect(startOfDayIn(parseCivilDate('2025-01-01')!, 'Europe/Zagreb')).toBe(Date.parse('2024-12-31T23:00:00Z'))
    expect(startOfDayIn(parseCivilDate('2026-07-01')!, 'Europe/Zagreb')).toBe(Date.parse('2026-06-30T22:00:00Z'))
    expect(startOfDayIn(parseCivilDate('2026-07-01')!, 'UTC')).toBe(Date.parse('2026-07-01T00:00:00Z'))
  })
})
