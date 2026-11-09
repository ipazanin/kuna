import { describe, expect, it } from 'vitest'

import { maskIdentifiers } from '../src/shared/privacy/domain/maskIdentifiers'

describe('masking the identifiers in a row Kuna builds', () => {
  it('cuts a Croatian IBAN to its country and last four digits, with or without spaces', () => {
    expect(maskIdentifiers('Paid from HR1210010051863000160 today', 'books')).toBe('Paid from HR•• ••••0160 today')
    expect(maskIdentifiers('Paid from HR12 1001 0051 8630 0016 0 today', 'books')).toBe('Paid from HR•• ••••0160 today')
  })

  it('cuts a German IBAN the same way, and leaves a number after it alone', () => {
    expect(maskIdentifiers('DE89 3704 0044 0532 0130 00 2026', 'books')).toBe('DE•• ••••3000 2026')
    expect(maskIdentifiers('DE89370400440532013000', 'books')).toBe('DE•• ••••3000')
  })

  it('replaces an OIB standing alone and one inside a reference', () => {
    expect(maskIdentifiers('OIB 12345678903, invoice 7', 'books')).toBe('OIB [OIB], invoice 7')
    expect(maskIdentifiers('HR01 12345678903-2026', 'books')).toBe('HR01 [OIB]-2026')
  })

  it('leaves amounts with separators, dates and longer numbers alone', () => {
    const text = 'Paid 1.234.567,89 EUR and 1,234,567.89 USD on 2026-10-30, reference 4111111111111112'
    expect(maskIdentifiers(text, 'books')).toBe(text)
  })

  it.each([
    ['card 4111111111111111', 'card [card ••••1111]'],
    ['card 4111 1111 1111 1111 paid', 'card [card ••••1111] paid'],
    ['MAESTRO 6759-6498-2643-8453', 'MAESTRO [card ••••8453]'],
    ['to 2360000-1101234567 on 3.11.', 'to [account ••••4567] on 3.11.'],
  ])('masks a card or a domestic account number in written text such as %s', (text, masked) => {
    expect(maskIdentifiers(text, 'written')).toBe(masked)
  })

  it('leaves a reference in the books that passes the card check readable', () => {
    expect(maskIdentifiers('poziv na broj 4111111111111111', 'books')).toBe('poziv na broj 4111111111111111')
    expect(maskIdentifiers('to 2360000-1101234567', 'books')).toBe('to 2360000-1101234567')
  })

  it.each([
    'hr1210010051863000160',
    'hr12 1001 0051 8630 0016 0',
    'HR12 10010051863000160',
    'HR 12 1001 0051 8630 0016 0',
    'HR12-1001-0051-8630-0016-0',
    'HR12 1001 0051 8630 0016 0',
    'IBANHR1210010051863000160',
  ])('cuts the form %s', (form) => {
    expect(maskIdentifiers(`Paid from ${form} today`, 'books')).toBe('Paid from HR•• ••••0160 today')
  })

  it('cuts an IBAN with letters, and one that follows words that only look like the start of one', () => {
    expect(maskIdentifiers('NL91 ABNA 0417 1643 00', 'books')).toBe('NL•• ••••4300')
    expect(maskIdentifiers('to 12 months, ab12 HR1210010051863000160 and DE89370400440532013000', 'books')).toBe('to 12 months, ab12 HR•• ••••0160 and DE•• ••••3000')
  })

  it('cuts an unbroken account with a wrong check digit', () => {
    expect(maskIdentifiers('uplata HR0023400091110000001 hvala', 'books')).toBe('uplata HR•• ••••0001 hvala')
  })

  it('leaves an invoice number readable, since it fails the IBAN check', () => {
    for (const text of ['Invoice AB12 3456 7890 1234 5678', 'INV12-3456-7890-1234', 'HR99 0000 1111 2222 3333 4']) {
      expect(maskIdentifiers(text, 'books')).toBe(text)
    }
  })

  it('replaces an OIB written in groups', () => {
    expect(maskIdentifiers('OIB 123 456 789 01, invoice 7', 'books')).toBe('OIB [OIB], invoice 7')
    expect(maskIdentifiers('OIB 123 456 789 01', 'books')).toBe('OIB [OIB]')
  })
})
