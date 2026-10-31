import { describe, expect, it } from 'vitest'

import { ENGLISH_ALLOWED, englishIn } from '../scripts/support/englishLeft.mjs'
import { FAKE_SEARCH_FAILURE } from '../src/apps/company/mail/infrastructure/fake/fakeMailbox'

describe('the scan for English left on a Croatian screen', () => {
  it('flags the short labels a Croatian sentence also quotes as stored keys', () => {
    for (const label of ['Settings', 'Paid', 'Save', 'Taxes', 'Assets', 'Employees', 'Scenarios', 'Gross', 'Company', 'Kuna settings']) {
      expect(englishIn(label), label).not.toEqual([])
    }
  })

  it('lets an English label that is also a one-word typed value through only in quotes', () => {
    expect(englishIn('Split')).toEqual(['split'])
    expect(englishIn('Books')).toEqual(['books'])
    expect(englishIn('Datoteka je u mapi „Moj disk › Books” na Google Driveu')).toEqual([])
  })

  it('flags English prose that is only part of an allowed text', () => {
    expect(englishIn(FAKE_SEARCH_FAILURE)).toEqual([])
    expect(englishIn('Sync again later')).toEqual(['sync', 'again', 'later'])
    expect(englishIn('Gmail did not answer')).toEqual(['did', 'not', 'answer'])
  })

  it('lets through a stored key in quotes, a field after polje and a placeholder', () => {
    expect(englishIn('Nema retka na listu „employees”')).toEqual([])
    expect(englishIn('polje amount je prazno')).toEqual([])
    expect(englishIn('Unutar mape računa, s {client} i {number}.')).toEqual([])
  })

  it('lets a one-word typed value through as a whole line or in quotes, never inside a sentence', () => {
    expect(englishIn('Subscription')).toEqual([])
    expect(englishIn('Stavka „Subscription” je fakturirana')).toEqual([])
    expect(englishIn('Add a subscription')).toContain('subscription')
  })

  it('names why each entry may stay English', () => {
    for (const entry of ENGLISH_ALLOWED) {
      expect(entry.reason, entry.name).toMatch(/\S/)
      expect(
        [entry.selector, entry.pattern, entry.texts].filter((way) => way !== undefined),
        entry.name,
      ).toHaveLength(1)
    }
  })
})
