import { describe, expect, it } from 'vitest'

import { listInWords } from '../src/shared/text/listInWords'

describe('a list in words', () => {
  it('joins with and, or with or when any one will do', () => {
    expect(listInWords(['Loans', 'Investments', 'Assets'])).toBe('Loans, Investments and Assets')
    expect(listInWords(['Loans', 'Investments', 'Assets'], 'or')).toBe('Loans, Investments or Assets')
  })
})
