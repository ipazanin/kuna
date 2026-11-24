import { describe, expect, it } from 'vitest'

import { countedRows } from '../src/apps/spending/analytics/domain/countedRow'
import { payeeSpellings } from '../src/apps/spending/payees/domain/payeeSpellings'
import type { Payee } from '../src/apps/spending/workbook/domain/payee'
import { PAYEE_RECORDS } from '../src/apps/spending/workbook/domain/spendingKinds'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { OTP, RATES, row, spendingBook } from './fixtures/spending'

const MARKET_IBAN = 'HR6212345670000000001'
const MARKET: Payee = {
  id: recordIdOf(PAYEE_RECORDS, 'market'),
  names: ['Corner market', 'CORNER MARKET D.O.O.', 'CM ZAGREB 12'],
  ibans: [MARKET_IBAN],
  party: 'business',
  taxId: '',
  website: '',
  note: '',
}

// All made up: two rows spelt the bank's way, one of them from the market's IBAN, and one row of the short card spelling.
const ROWS = [
  row(OTP, '2026-11-03', -20, 'Food/Groceries', { payee: 'Corner market' }),
  row(OTP, '2026-11-10', -30, 'Food/Groceries', { payee: 'corner market d.o.o.' }),
  row(OTP, '2026-11-11', -12, 'Food/Groceries', { payee: 'CORNER MARKET D.O.O.', counterpartyIban: MARKET_IBAN }),
  row(OTP, '2026-11-12', -5, 'Food/Groceries', { payee: 'CM ZAGREB 12' }),
  row(OTP, '2026-11-15', -4, 'Food/Groceries', { payee: 'Bakery' }),
]

describe("a payee's other spellings", () => {
  const book = spendingBook(ROWS, { payees: [MARKET] })
  const rows = countedRows(book, RATES)

  it('count the entries that leave the payee with each spelling, keeping one the IBAN still finds', () => {
    expect(payeeSpellings(rows, book.payees, MARKET)).toEqual([
      { name: 'CORNER MARKET D.O.O.', leaving: 1 },
      { name: 'CM ZAGREB 12', leaving: 1 },
    ])
  })

  it('count none for a spelling no entry has', () => {
    const unused = { ...MARKET, names: ['Corner market', 'Corner shop'] }

    expect(payeeSpellings(rows, [unused], unused)).toEqual([{ name: 'Corner shop', leaving: 0 }])
  })
})
