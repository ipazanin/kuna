import { describe, expect, it } from 'vitest'

import { countedRows } from '../src/apps/spending/analytics/domain/countedRow'
import { spanBreakdown } from '../src/apps/spending/analytics/domain/spanBreakdown'
import { payeeNamed } from '../src/apps/spending/payees/domain/payeeDirectory'
import { payeeKey } from '../src/apps/spending/payees/domain/payeeKey'
import { countsUnderPayee, payeeTotals } from '../src/apps/spending/payees/domain/payeeTotals'
import { usualCategories } from '../src/apps/spending/payees/domain/usualCategory'
import { BY_DAYS } from '../src/apps/spending/workbook/domain/event'
import type { Payee } from '../src/apps/spending/workbook/domain/payee'
import type { SharedCost } from '../src/apps/spending/workbook/domain/sharedCost'
import { ITEM_RECORDS, PAYEE_RECORDS, SHARED_COST_RECORDS } from '../src/apps/spending/workbook/domain/spendingKinds'
import { accountMoneyFromAmount } from '../src/shared/money/accountMoney'
import { monthRange } from '../src/shared/calendar/dateRange'
import { monthKey } from '../src/shared/calendar/monthKey'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { civil, euros } from './fixtures/ledger'
import { CATEGORIES, OTP, RATES, category, row, spendingBook, wholeItems } from './fixtures/spending'

const MARKET_IBAN = 'HR6212345670000000001'
const ROW_IBAN = 'HR3512345670000000002'
const MARKET: Payee = {
  id: recordIdOf(PAYEE_RECORDS, 'market'),
  names: ['Corner market', 'CORNER MARKET D.O.O.'],
  ibans: [MARKET_IBAN],
  party: 'business',
  taxId: '',
  website: '',
  note: '',
}

// All made up: three rows in November that the one payee you keep details of gathers by its two spellings and its IBAN.
const typed = row(OTP, '2026-11-03', -20, 'Food/Groceries', { payee: 'Corner market' })
const fromBank = row(OTP, '2026-11-10', -30, 'Food/Groceries', { payee: 'CORNER MARKET D.O.O.', counterpartyIban: ROW_IBAN })
const byIban = row(OTP, '2026-11-12', -5, 'Food/Groceries', { payee: 'CM ZAGREB 12', counterpartyIban: MARKET_IBAN })
const nameless = row(OTP, '2026-11-14', -18.4, 'Food/Groceries', { payee: '', counterpartyIban: MARKET_IBAN })
const bakery = row(OTP, '2026-11-15', -4, 'Food/Groceries', { payee: 'Bakery' })
const ROWS = [typed, fromBank, byIban, nameless, bakery]
const NOVEMBER = monthRange(monthKey(2026, 11))

describe('payee figures for a payee you keep details of', () => {
  const book = spendingBook(ROWS, { payees: [MARKET] })
  const rows = countedRows(book, RATES)
  const totals = payeeTotals(rows, CATEGORIES, book)

  it('count both spellings, a row found by the IBAN and a row with no name and the IBAN as one payee, under its first name and its IBANs first', () => {
    const market = totals.find((payee) => payee.key === payeeKey('Corner market'))

    // 20 + 30 + 5 + 18.40 on four entries.
    expect(market).toMatchObject({ name: 'Corner market', spent: euros(73.4), rows: 4, latest: civil('2026-11-14'), ibans: [MARKET_IBAN, ROW_IBAN] })
    expect(totals.map((payee) => payee.name)).toEqual(['Bakery', 'Corner market'])
  })

  it('count the same on Analysis by payee', () => {
    const lines = spanBreakdown(rows, book, NOVEMBER, 'payee').lines

    expect(lines.map((line) => [line.name, line.spent])).toEqual([
      ['Corner market', euros(73.4)],
      ['Bakery', euros(4)],
    ])
  })

  it("list on Entries' payee filter the entries the Payees line counts", () => {
    const listed = rows.filter((counted) => countsUnderPayee(counted, payeeKey('Corner market'), book))

    expect(listed.map((counted) => counted.day)).toEqual([typed.date, fromBank.date, byIban.date, nameless.date])
  })

  it("leave a part under a payee of its own out of the record the entry's IBAN finds", () => {
    const split = row(OTP, '2026-11-20', -40, 'Food/Groceries', { payee: 'Corner market', counterpartyIban: MARKET_IBAN })
    const [whole] = wholeItems([split])
    const items = [
      { ...whole!, amount: accountMoneyFromAmount(-30) },
      { ...whole!, id: recordIdOf(ITEM_RECORDS, 'split-ana'), amount: accountMoneyFromAmount(-10), category: category('Family and gifts/Gifts').id, payee: 'Ana' },
    ]
    const splitBook = spendingBook([split], { payees: [MARKET], items })
    const splitTotals = payeeTotals(countedRows(splitBook, RATES), CATEGORIES, splitBook)

    expect(splitTotals.map((payee) => [payee.name, payee.spent])).toEqual([
      ['Ana', euros(10)],
      ['Corner market', euros(30)],
    ])
  })

  it("count a shared cost under the record that holds its payee's second spelling", () => {
    const lunch: SharedCost = {
      id: recordIdOf(SHARED_COST_RECORDS, 'shared-lunch'),
      day: civil('2026-11-21'),
      payee: 'corner market d.o.o.',
      category: category('Food/Groceries').id,
      labels: [],
      event: BY_DAYS,
      note: '',
      settled: false,
    }
    const member = row(OTP, '2026-11-21', -12, 'In a shared cost', { payee: 'Till 3' })
    const sharedBook = spendingBook([member], { payees: [MARKET], items: wholeItems([member]).map((item) => ({ ...item, sharedCost: lunch.id })), sharedCosts: [lunch] })

    expect(payeeTotals(countedRows(sharedBook, RATES), CATEGORIES, sharedBook).map((payee) => [payee.name, payee.spent])).toEqual([['Corner market', euros(12)]])
  })
})

describe("the payee a page's key names", () => {
  it('opens the record by any of its names, so a link from before a rename still finds it', () => {
    const renamed = { ...MARKET, names: ['Corner shop', ...MARKET.names] }
    const book = spendingBook(ROWS, { payees: [renamed] })

    expect(payeeNamed(book, payeeKey('Corner market'))).toEqual({ key: payeeKey('Corner shop'), name: 'Corner shop' })
    expect(payeeNamed(book, payeeKey('Bakery'))).toEqual({ key: payeeKey('Bakery'), name: 'Bakery' })
  })

  it("does not name a payee by a row the record's IBAN gathers", () => {
    expect(payeeNamed(spendingBook(ROWS, { payees: [MARKET] }), payeeKey('CM ZAGREB 12'))).toBeNull()
  })
})

describe("a payee's usual category across spellings", () => {
  it('reads the entries of every name and the IBAN of the record', () => {
    const groceries = category('Food/Groceries').id
    const usual = usualCategories(spendingBook(ROWS, { payees: [MARKET] }), 'out')

    expect(usual.get(payeeKey('Corner market'))).toBe(groceries)
    expect([usual.has(payeeKey('CORNER MARKET D.O.O.')), usual.has(payeeKey('CM ZAGREB 12'))]).toEqual([false, false])
  })
})
