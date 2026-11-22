import { describe, expect, it } from 'vitest'

import type { BankLink } from '../src/shared/bank-sync/domain/bankLink'
import { hasDueLink, hasLiveLink } from '../src/apps/spending/bankSync/domain/bankLinks'
import { endingLinks, heldLinks } from '../src/shared/bank-sync/domain/bankLinkDays'
import type { LinkedBook } from '../src/apps/spending/bankSync/domain/bankLinks'
import { bankLinkLines } from '../src/apps/spending/bankSync/presentation/bankLinkLines'
import { bankLinkId } from '../src/apps/spending/workbook/domain/bankLinkReading'
import { addDays } from '../src/shared/calendar/civilDate'
import { civil } from './fixtures/ledger'

const DAY = civil('2026-10-30')

function link(bank: string, days: number, fetchedAt: number | null = null): BankLink {
  return { id: bankLinkId({ bank, usage: 'personal' }), bank, usage: 'personal', endsOn: addDays(DAY, days), fetchedAt }
}

function book(links: readonly BankLink[], application = 'made-up-application'): LinkedBook {
  return { settings: { bankSyncApplication: application }, bankLinks: links }
}

describe('the end of a link', () => {
  it('says nothing 15 days before and says so from 14', () => {
    expect(endingLinks([link('OTP banka', 15)], DAY)).toEqual([])
    expect(endingLinks([link('OTP banka', 14)], DAY)).toEqual([{ link: link('OTP banka', 14), ended: false }])
  })

  it('counts its last day as live, and marks the day after as ended', () => {
    expect(hasLiveLink(book([link('OTP banka', 0)]), DAY)).toBe(true)
    expect(hasLiveLink(book([link('OTP banka', -1)]), DAY)).toBe(false)
    expect(endingLinks([link('OTP banka', -1)], DAY)).toEqual([{ link: link('OTP banka', -1), ended: true }])
  })

  it('names each bank whose link runs out on the home card by its name at Enable Banking', () => {
    expect(bankLinkLines(book([link('OTP banka', 13), link('Revolut', 2)]), DAY)).toEqual([
      'The link to OTP banka ends on 12 Nov 2026. Link it again.',
      'The link to Revolut ends on 1 Nov 2026. Link it again.',
    ])
    expect(bankLinkLines(book([link('OTP banka', -3)]), DAY)).toEqual(['The link to OTP banka ended on 27 Oct 2026. Link it again.'])
  })

  it('is silent and has nothing live with no application kept, whatever the file holds', () => {
    expect(bankLinkLines(book([link('OTP banka', 2)], ''), DAY)).toEqual([])
    expect(hasLiveLink(book([link('OTP banka', 30)], ''), DAY)).toBe(false)
  })
})

describe('the six hours a bank is left alone', () => {
  const NOW = Date.parse('2026-10-30T12:00:00.000Z')
  const HOUR = 3_600_000

  it('holds a link any device asked within six hours, and frees it at six', () => {
    expect(heldLinks([link('OTP banka', 30, NOW - HOUR), link('Revolut', 30, NOW - 6 * HOUR)], NOW).map(({ bank }) => bank)).toEqual(['OTP banka'])
  })

  it('has a bank to ask while one live link is free, and none while every live one is held', () => {
    expect(hasDueLink(book([link('OTP banka', 30, NOW - HOUR), link('Revolut', 30)]), DAY, NOW)).toBe(true)
    expect(hasDueLink(book([link('OTP banka', 30, NOW - HOUR)]), DAY, NOW)).toBe(false)
    expect(hasDueLink(book([link('OTP banka', 30, NOW - HOUR), link('Revolut', -1)]), DAY, NOW)).toBe(false)
  })
})
