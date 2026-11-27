import { describe, expect, it } from 'vitest'

import { bankOfIban } from '../src/shared/text/ibanBank'

describe('the bank an IBAN names', () => {
  it('is the Croatian bank its bank code names, however the IBAN is spaced or cased', () => {
    expect(bankOfIban('HR1210010051863000160')).toBe('Hrvatska narodna banka')
    expect(bankOfIban('hr12 1001 0051 8630 0016 0')).toBe('Hrvatska narodna banka')
  })

  it('is none for a bank code no Croatian bank has', () => {
    expect(bankOfIban('HR6212345670000000001')).toBeNull()
  })

  it("is none for another country's IBAN, even with a Croatian bank's code in its place", () => {
    expect(bankOfIban('SI5610010051863000160')).toBeNull()
  })

  it('is none until the IBAN holds the whole bank code', () => {
    expect(bankOfIban('HR121001005')).toBe('Hrvatska narodna banka')
    expect(bankOfIban('HR12100100')).toBeNull()
    expect(bankOfIban('')).toBeNull()
  })
})
