import { describe, expect, it } from 'vitest'

import { mailAddressesFault, mailAddressesOf, mailPhraseFault, mailQuery, mailWindow } from '../src/shared/mail/domain/mailSource'
import { en } from '../src/shared/mail/domain/words'
import { civilDateIn, parseCivilDate, startOfDayIn } from '../src/shared/calendar/civilDate'

const SINCE = Date.parse('2024-12-31T23:00:00Z')

describe('a mail search', () => {
  it('searches from its senders and subject phrase for mail with attachments after the window, in epoch seconds', () => {
    const window = mailWindow(null, SINCE)

    expect(mailQuery({ senders: ['statements@bank.example.com', 'notices@bank.example.com'], subject: 'Izvadak' }, window)).toBe(
      'from:(statements@bank.example.com OR notices@bank.example.com) subject:"Izvadak" has:attachment after:1735686000',
    )
    expect(mailQuery({ senders: ['reports@broker.example.com'], subject: 'Račun za' }, window)).toBe('from:(reports@broker.example.com) subject:"Račun za" has:attachment after:1735686000')
  })

  it('starts from the start day while the books hold nothing of its mail, and a week before the newest day they hold once that is later', () => {
    const newest = Date.parse('2026-10-20T08:30:00Z')

    expect(mailWindow(null, SINCE)).toEqual({ from: SINCE, after: 'since' })
    expect(mailWindow(newest, SINCE)).toEqual({ from: Date.parse('2026-10-13T08:30:00Z'), after: 'newest' })
    expect(mailWindow(SINCE + 86_400_000, SINCE)).toEqual({ from: SINCE, after: 'since' })
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
