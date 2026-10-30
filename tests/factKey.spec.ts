import { describe, expect, it } from 'vitest'

import { factKey } from '../src/shared/text/factKey'

describe('factKey', () => {
  it('gives the keys bank rows have been imported under, so a file read again matches its rows', () => {
    expect(factKey(['Main account', '2026-03-02', '-3990', '120000', 'netflix', 'netflix int', ''])).toBe('4cf86edc1312262a')
    expect(factKey(['workbook', 'Račun', '', 'ž'])).toBe('250459e0ade14d5e')
  })
})
