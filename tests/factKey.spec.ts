import { describe, expect, it } from 'vitest'

import { factKey, occurrenceKeys } from '../src/shared/text/factKey'

describe('factKey', () => {
  it('gives the keys bank rows have been imported under, so a file read again matches its rows', () => {
    expect(factKey(['Main account', '2026-03-02', '-3990', '120000', 'netflix', 'netflix int', ''])).toBe('4cf86edc1312262a')
    expect(factKey(['workbook', 'Račun', '', 'ž'])).toBe('250459e0ade14d5e')
  })
})

describe('occurrenceKeys', () => {
  const coffee = ['Main account', '2026-03-02', '-300', 'coffee']
  const rent = ['Main account', '2026-03-02', '-50000', 'rent']

  it('counts each row among the equal rows before it', () => {
    expect(occurrenceKeys([coffee, rent, coffee])).toEqual([`${factKey(coffee)}-1`, `${factKey(rent)}-1`, `${factKey(coffee)}-2`])
  })

  it('gives an empty list no keys', () => {
    expect(occurrenceKeys([])).toEqual([])
  })
})
