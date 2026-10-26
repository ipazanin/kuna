import { describe, expect, it } from 'vitest'

import {
  afterPhrase,
  countsLine,
  mailAddressesOf,
  mailAddressesProblem,
  mailQuery,
  mailSubjectProblem,
  mailWindow,
  strippedSubject,
  yearFolderName,
} from '../src/features/mail/domain/mailSource'
import { civilDateIn, parseCivilDate, startOfDayIn } from '../src/shared/calendar/civilDate'

const SINCE = Date.parse('2024-12-31T23:00:00Z')

describe('a mail source', () => {
  it('searches from its senders and subject phrase for mail with attachments after the window, in epoch seconds', () => {
    const window = mailWindow(null, SINCE)

    expect(mailQuery({ senders: ['statements@bank.example.com', 'notices@bank.example.com'], subject: 'Izvadak' }, window)).toBe(
      'from:(statements@bank.example.com OR notices@bank.example.com) subject:"Izvadak" has:attachment after:1735686000',
    )
    expect(mailQuery({ senders: ['office@accountant.example.com'], subject: 'Plaća za' }, window)).toBe('from:(office@accountant.example.com) subject:"Plaća za" has:attachment after:1735686000')
  })

  it('starts from the mail-since day while the app filed nothing for it, and a week before the newest mail it filed once it did', () => {
    const filed = Date.parse('2026-10-20T08:30:00Z')

    expect(mailWindow(null, SINCE)).toEqual({ from: SINCE, after: 'since' })
    expect(mailWindow(filed, SINCE)).toEqual({ from: Date.parse('2026-10-13T08:30:00Z'), after: 'filed' })
  })

  it('names the folder of a year by the year and the source folder’s own name', () => {
    expect(yearFolderName(2026, ['work', 'dss', 'erste', 'statements'])).toBe('2026-statements')
    expect(yearFolderName('2026', ['finance', 'vat-returns'])).toBe('2026-vat-returns')
    expect(yearFolderName(2025, ['incoming-invoices'])).toBe('2025-incoming-invoices')
  })

  it('reads what follows the subject phrase once the replies’ prefixes are off, whatever the case and the Croatian characters', () => {
    expect(strippedSubject('RE: FW: Re:Plaća za 9/2026')).toBe('Plaća za 9/2026')
    expect(strippedSubject('Fwd: PDV za 8/25')).toBe('PDV za 8/25')
    expect(afterPhrase('RE: FW: Plaća za 9/2026', 'Plaća za')).toBe(' 9/2026')
    expect(afterPhrase('PLACA ZA 9/2026', 'Plaća za')).toBe(' 9/2026')
    expect(afterPhrase('Račun za 6/2026', 'Racun za')).toBe(' 6/2026')
    expect(afterPhrase('Informacija: Plaća za 9/2026', 'Plaća za')).toBeNull()
    expect(afterPhrase('Plaća za 9/2026', '')).toBeNull()
  })

  it('counts what it found in one line, with nothing new said when nothing would be filed', () => {
    expect(countsLine({ file: 3, already: 50, corrections: 0, unchecked: 0, unmatched: 1 })).toBe('Would file 3, already there 50, 1 unmatched')
    expect(countsLine({ file: 0, already: 50, corrections: 0, unchecked: 0, unmatched: 0 })).toBe('Nothing new, already there 50')
    expect(countsLine({ file: 0, already: 0, corrections: 2, unchecked: 1, unmatched: 0 })).toBe('Nothing new, 2 corrections, 1 not compared')
  })

  it('reads its senders as a comma-separated list in lower case, and refuses what is not a mail address', () => {
    expect(mailAddressesOf(' Statements@Bank.example.com,, notices@bank.example.com , statements@bank.example.com')).toEqual(['statements@bank.example.com', 'notices@bank.example.com'])
    expect(mailAddressesProblem(['statements@bank.example.com'])).toBeNull()
    expect(mailAddressesProblem(['bank.example.com', 'a@b'])).toBe('"bank.example.com", "a@b" are not mail addresses')
  })

  it('refuses a subject with a double quote, which would end the phrase Gmail searches for', () => {
    expect(mailSubjectProblem('Plaća za')).toBeNull()
    expect(mailSubjectProblem('Izvod "dnevni"')).toBe('a subject cannot hold a double quote, which would end the phrase Gmail searches for')
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
