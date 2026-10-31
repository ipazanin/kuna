import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { INSTRUMENT_WRITES, INVESTMENT_ACCOUNT_WRITES } from '../src/apps/investments/holdings/application/holdingWrites'
import { SPIN_OFF_WRITES, SPLIT_WRITES, TRADE_WRITES, TRANSFER_WRITES } from '../src/apps/investments/transactions/application/transactionWrites'
import { codecOfInvestmentsKind } from '../src/apps/investments/workbook/application/investmentsCodecs'
import {
  CASH_MOVEMENT_RECORDS,
  EXCHANGE_RECORDS,
  INCOME_RECORDS,
  INSTRUMENT_RECORDS,
  INVESTMENT_ACCOUNT_RECORDS,
  PRICE_RECORDS,
  SPIN_OFF_RECORDS,
  SPLIT_RECORDS,
  TRADE_RECORDS,
  TRANSFER_RECORDS,
} from '../src/apps/investments/workbook/domain/investmentKinds'
import { fakeInvestmentsDocument } from '../src/apps/investments/workbook/infrastructure/fake/fakeInvestments'
import { INVESTMENTS_APP, INVESTMENTS_DOCUMENT } from '../src/apps/investments/workbook/infrastructure/investmentsDocument'
import { investmentLots } from '../src/apps/investments/holdings/domain/lots'
import { decimalOfText } from '../src/shared/money/decimal'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import type { RecordKind } from '../src/shared/storage/domain/recordKind'
import type { RecordFields } from '../src/shared/storage/domain/recordFields'
import { storedFieldsOfValues } from '../src/shared/storage/domain/storedFields'
import { WorkbookWriteRefused } from '../src/shared/storage/application/workbookWriteRefused'
import type { DocumentRecord } from '../src/shared/storage/infrastructure/documentFormat'
import { newDocument } from '../src/shared/storage/infrastructure/documentRecordStorage'
import { recordOnScreen } from './fixtures/records'
import { INVESTMENTS, driveHarness, forgetCaches } from './fixtures/writeBack'

const ONE = '3a1f0c2e-4b5d-4e6f-8a7b-9c0d1e2f3a41'
const TWO = '3a1f0c2e-4b5d-4e6f-8a7b-9c0d1e2f3a42'
const SHARE = '3a1f0c2e-4b5d-4e6f-8a7b-9c0d1e2f3a51'
const FUND = '3a1f0c2e-4b5d-4e6f-8a7b-9c0d1e2f3a52'
const BOND = '3a1f0c2e-4b5d-4e6f-8a7b-9c0d1e2f3a53'
const SPINCO = '3a1f0c2e-4b5d-4e6f-8a7b-9c0d1e2f3a54'

const ACCOUNTS = [
  { id: ONE, name: 'Broker One' },
  { id: TWO, name: 'Broker Two' },
]
const DOLLAR_SHARE = { id: SHARE, name: 'Example Tech', class: 'stocks', symbol: 'ABC', currency: 'USD', quoted: 'unit', prices: 'twelvedata', source_symbol: 'ABC' }
const EURO_FUND = { id: FUND, name: 'Example Fund', class: 'money-market', symbol: 'EMF', currency: 'EUR', quoted: 'unit', prices: 'manual' }
const EURO_BOND = { id: BOND, name: 'Example Bond', class: 'bonds', symbol: 'EXB', currency: 'EUR', quoted: 'percent', coupon: '3', maturity: '2030-09-15', prices: 'manual' }
const SPUN_OFF = { id: SPINCO, name: 'Example Spinco', class: 'stocks', symbol: 'GHI', currency: 'USD', quoted: 'unit', prices: 'manual' }
const BUY = { id: 't1', account: ONE, instrument: SHARE, side: 'buy', date: '2026-01-10', quantity: '10', price: '140', fees: '1', rate: '1.08' }

type Records = Readonly<Record<string, readonly DocumentRecord[]>>

function documentOf(records: Records) {
  return newDocument(INVESTMENTS_APP, { investments: 1 }, records, '2026-10-30T09:00:00.000Z')
}

function booksOf(records: Records) {
  return INVESTMENTS_DOCUMENT.read({
    meta: { id: 'local', source: 'browser', title: 'kuna-investments.json', syncedAt: '2026-10-30T09:00:00.000Z', lastExportedAt: null, unexportedSince: null },
    revision: '1',
    document: documentOf(records),
  }).workbook
}

/** Each problem as its kind, the record's label and the reason. */
function problemsOf(records: Records): [string, string, string][] {
  return booksOf(records).problems.map((problem) => [problem.kind, problem.label, problem.reason])
}

function roundTrip<R>(kind: RecordKind<R>, fields: RecordFields): RecordFields {
  const codec = codecOfInvestmentsKind(kind)
  return codec.fieldsOf(codec.make(storedFieldsOfValues(fields), recordIdOf(kind, String(fields.id))))
}

function decimal(text: string) {
  return decimalOfText(text)!
}

describe('the Investments file', () => {
  it('writes every kind back field for field as it read it', () => {
    const kinds: [RecordKind<unknown>, RecordFields][] = [
      [INVESTMENT_ACCOUNT_RECORDS, { id: ONE, name: 'Broker One', note: 'Main account' }],
      [INSTRUMENT_RECORDS, { ...DOLLAR_SHARE, isin: 'XX000000ABC1', exchange: 'XNAS', note: 'A US share' }],
      [INSTRUMENT_RECORDS, EURO_BOND],
      [INSTRUMENT_RECORDS, { ...DOLLAR_SHARE, id: FUND, benchmark: true }],
      [TRADE_RECORDS, { ...BUY, note: 'First buy', import_key: 'workbook-1' }],
      [TRADE_RECORDS, { id: 't2', account: ONE, instrument: BOND, side: 'sell', date: '2026-02-10', quantity: '1000', price: '98.5', accrued: '15.12' }],
      [INCOME_RECORDS, { id: 'i1', account: ONE, kind: 'dividend', instrument: SHARE, date: '2026-06-15', currency: 'USD', gross: '12', withheld: '1.8', rate: '1.09', note: 'Second quarter' }],
      [INCOME_RECORDS, { id: 'i2', account: ONE, kind: 'interest', date: '2026-06-30', currency: 'EUR', gross: '3.15' }],
      [INCOME_RECORDS, { id: 'i3', account: ONE, kind: 'dividend', instrument: SHARE, date: '2026-06-22', currency: 'USD', gross: '-12', withheld: '-1.8', rate: '1.1', note: 'Reverses a dividend' }],
      [CASH_MOVEMENT_RECORDS, { id: 'c1', account: ONE, kind: 'fee-refund', date: '2026-01-05', currency: 'USD', amount: '5', rate: '1.0861', import_key: 'workbook-2' }],
      [EXCHANGE_RECORDS, { id: 'e1', account: ONE, date: '2026-01-06', sold: '1000', sold_currency: 'EUR', bought: '1085', bought_currency: 'USD', fees: '2', fee_currency: 'EUR' }],
      [TRANSFER_RECORDS, { id: 'm1', from: ONE, to: TWO, date: '2026-02-01', instrument: SHARE, quantity: '0.00841' }],
      [TRANSFER_RECORDS, { id: 'm2', from: ONE, to: TWO, date: '2026-02-02', currency: 'EUR', amount: '200', note: 'Moved' }],
      [SPLIT_RECORDS, { id: 's1', instrument: SHARE, date: '2026-02-01', new: '1', old: '3' }],
      [SPIN_OFF_RECORDS, { id: 'o1', instrument: SHARE, received: SPINCO, date: '2026-02-01', quantity: '2', cost_share: '0.0825' }],
      [PRICE_RECORDS, { id: 'p1', instrument: FUND, date: '2026-09-30', price: '10.51', note: 'Statement of 30 Sep' }],
    ]

    for (const [kind, fields] of kinds) {
      expect(roundTrip(kind, fields)).toEqual(fields)
    }
  })

  it('reads decimals exactly from their text, so no figure passes through a JavaScript number', () => {
    const books = booksOf({
      'investment-account': ACCOUNTS,
      instrument: [DOLLAR_SHARE],
      trade: [{ ...BUY, quantity: '0.123456789012', price: '190.000000000001' }],
    })

    expect(books.problems).toEqual([])
    expect(books.book.trades[0]).toMatchObject({ quantity: decimal('0.123456789012'), price: decimal('190.000000000001'), fees: decimal('1'), rate: decimal('1.08') })
  })

  it('reads every kind into the book, each in the file order', () => {
    const books = booksOf({
      'investment-account': ACCOUNTS,
      instrument: [DOLLAR_SHARE, EURO_FUND, SPUN_OFF],
      trade: [BUY],
      income: [{ id: 'i1', account: ONE, kind: 'dividend', instrument: SHARE, date: '2026-06-15', currency: 'USD', gross: '12', withheld: '1.8', rate: '1.09' }],
      'cash-movement': [{ id: 'c1', account: ONE, kind: 'deposit', date: '2026-01-05', currency: 'EUR', amount: '2000' }],
      exchange: [{ id: 'e1', account: ONE, date: '2026-01-06', sold: '1000', sold_currency: 'EUR', bought: '1085', bought_currency: 'USD' }],
      transfer: [{ id: 'm1', from: ONE, to: TWO, date: '2026-02-01', instrument: SHARE, quantity: '4' }],
      split: [{ id: 's1', instrument: SHARE, date: '2026-03-01', new: '2', old: '1' }],
      'spin-off': [{ id: 'o1', instrument: SHARE, received: SPINCO, date: '2026-04-01', quantity: '1', cost_share: '0.1' }],
      price: [{ id: 'p1', instrument: FUND, date: '2026-09-30', price: '10.51' }],
    })

    expect(books.problems).toEqual([])
    const { book } = books
    expect(book.accounts.map((account) => account.name)).toEqual(['Broker One', 'Broker Two'])
    expect(book.instruments.map((instrument) => [instrument.symbol, instrument.currency, instrument.prices])).toEqual([
      ['ABC', 'USD', 'twelvedata'],
      ['EMF', 'EUR', 'manual'],
      ['GHI', 'USD', 'manual'],
    ])
    expect(book.income[0]).toMatchObject({ kind: 'dividend', instrument: recordIdOf(INSTRUMENT_RECORDS, SHARE), gross: decimal('12'), withheld: decimal('1.8') })
    expect(book.cashMovements[0]).toMatchObject({ kind: 'deposit', rate: null })
    expect(book.exchanges[0]).toMatchObject({ soldCurrency: 'EUR', boughtCurrency: 'USD', fees: null })
    expect(book.transfers[0]!.moved).toEqual({ kind: 'units', instrument: recordIdOf(INSTRUMENT_RECORDS, SHARE), quantity: decimal('4') })
    expect(book.splits[0]).toMatchObject({ newUnits: 2, oldUnits: 1 })
    expect(book.spinOffs[0]).toMatchObject({ received: recordIdOf(INSTRUMENT_RECORDS, SPINCO), costShare: decimal('0.1') })
    expect(book.prices[0]).toMatchObject({ instrument: recordIdOf(INSTRUMENT_RECORDS, FUND), price: decimal('10.51') })
  })

  it('refuses an account or an instrument whose fields do not make one, and says why', () => {
    expect(
      problemsOf({
        'investment-account': [{ id: 'a1', note: 'No name' }],
        instrument: [
          { ...DOLLAR_SHARE, id: 'n1', class: 'shares' },
          { ...DOLLAR_SHARE, id: 'n2', currency: 'XAU' },
          { ...DOLLAR_SHARE, id: 'n3', isin: 'ABC' },
          { ...DOLLAR_SHARE, id: 'n4', exchange: 'Xetra' },
          { ...DOLLAR_SHARE, id: 'n5', source_symbol: '' },
          { ...EURO_FUND, id: 'n6', source_symbol: 'EMF' },
          { ...EURO_BOND, id: 'n7', maturity: '' },
          { ...EURO_FUND, id: 'n8', coupon: '3' },
          { ...DOLLAR_SHARE, id: 'n9', prices: 'yahoo' },
          { ...DOLLAR_SHARE, id: 'n10', benchmark: 'maybe' },
        ],
      }),
    ).toEqual([
      ['investment-account', 'unnamed', 'no name'],
      ['instrument', 'Example Tech, ABC', '"shares" is not a class. Use stocks, bonds, money-market, crypto, gold'],
      ['instrument', 'Example Tech, ABC', 'currency "XAU" is not a currency code such as USD'],
      ['instrument', 'Example Tech, ABC', 'isin "ABC" is not an ISIN such as US0378331005'],
      ['instrument', 'Example Tech, ABC', 'exchange "Xetra" is not a market identifier code such as XETR'],
      ['instrument', 'Example Tech, ABC', 'no source_symbol'],
      ['instrument', 'Example Fund, EMF', 'source_symbol is filled, but the prices are entered by hand'],
      ['instrument', 'Example Bond, EXB', 'no maturity date'],
      ['instrument', 'Example Fund, EMF', 'coupon and maturity belong to a bond quoted in percent only'],
      ['instrument', 'Example Tech, ABC', '"yahoo" is not a price source. Use twelvedata, alphavantage, manual'],
      ['instrument', 'Example Tech, ABC', 'benchmark "maybe" is not true or false'],
    ])
  })

  it('marks the benchmark only on the instrument that carries the field, and writes no field for the rest', () => {
    const books = booksOf({ instrument: [DOLLAR_SHARE, { ...EURO_FUND, benchmark: true }, { ...SPUN_OFF, benchmark: false }] })

    expect(books.problems).toEqual([])
    expect(books.book.instruments.map((instrument) => [instrument.symbol, instrument.benchmark])).toEqual([
      ['ABC', false],
      ['EMF', true],
      ['GHI', false],
    ])
    expect(roundTrip(INSTRUMENT_RECORDS, { ...SPUN_OFF, benchmark: false })).toEqual(SPUN_OFF)
  })

  it('refuses money records whose amounts, currencies or rates do not make one', () => {
    const income = { account: ONE, kind: 'dividend', instrument: SHARE, date: '2026-06-15', currency: 'USD', gross: '12', rate: '1.09' }
    const movement = { account: ONE, kind: 'deposit', date: '2026-01-05', currency: 'EUR', amount: '100' }
    expect(
      problemsOf({
        'investment-account': ACCOUNTS,
        instrument: [DOLLAR_SHARE],
        trade: [
          { ...BUY, id: 't1', quantity: '0' },
          { ...BUY, id: 't2', price: '-1' },
          { ...BUY, id: 't3', fees: '1,5' },
          { ...BUY, id: 't4', side: 'short' },
        ],
        income: [
          { ...income, id: 'i1', instrument: '' },
          { ...income, id: 'i2', withheld: '13' },
          { ...income, id: 'i3', rate: '' },
          { ...income, id: 'i4', currency: 'EUR' },
          { ...income, id: 'i5', gross: '-12' },
          { ...income, id: 'i6', gross: '-12', withheld: '1.8', note: 'Reverses a dividend' },
          { ...income, id: 'i7', gross: '-12', withheld: '-13', note: 'Reverses a dividend' },
          { ...income, id: 'i8', withheld: '-1.8' },
          { ...income, id: 'i9', gross: '0' },
        ],
        'cash-movement': [
          { ...movement, id: 'c1', kind: 'gift' },
          { ...movement, id: 'c2', amount: '-100' },
        ],
        exchange: [
          { id: 'e1', account: ONE, date: '2026-01-06', sold: '10', sold_currency: 'EUR', bought: '10', bought_currency: 'EUR' },
          { id: 'e2', account: ONE, date: '2026-01-06', sold: '10', sold_currency: 'EUR', bought: '11', bought_currency: 'USD', fees: '1' },
        ],
        transfer: [
          { id: 'm1', from: ONE, to: ONE, date: '2026-02-01', currency: 'EUR', amount: '10' },
          { id: 'm2', from: ONE, to: TWO, date: '2026-02-01', instrument: SHARE, quantity: '1', currency: 'EUR', amount: '10' },
        ],
        split: [
          { id: 's1', instrument: SHARE, date: '2026-03-01', new: '2.5', old: '1' },
          { id: 's2', instrument: SHARE, date: '2026-03-01', new: '2', old: '2' },
        ],
        'spin-off': [
          { id: 'o1', instrument: SHARE, received: SHARE, date: '2026-04-01', quantity: '1', cost_share: '0.1' },
          { id: 'o2', instrument: SHARE, received: SPINCO, date: '2026-04-01', quantity: '1', cost_share: '1.5' },
        ],
      }),
    ).toEqual([
      ['trade', '2026-01-10, buy, 0', 'quantity must be more than zero'],
      ['trade', '2026-01-10, buy, 10', 'price is below zero'],
      ['trade', '2026-01-10, buy, 10', 'fees "1,5" is not a decimal number with at most twelve decimals, such as 12.5'],
      ['trade', '2026-01-10, short, 10', '"short" is not a side. Use buy, sell'],
      ['income', '2026-06-15, dividend, 12 USD', 'a dividend names its instrument'],
      ['income', '2026-06-15, dividend, 12 USD', 'withheld is more than gross'],
      ['income', '2026-06-15, dividend, 12 USD', 'no rate, which an amount in USD needs, in USD per EUR'],
      ['income', '2026-06-15, dividend, 12 EUR', 'rate is filled, but the amount is in EUR'],
      ['income', '2026-06-15, dividend, -12 USD', 'gross is below zero, which only a reversal with a note saying so may be'],
      ['income', '2026-06-15, dividend, -12 USD', 'withheld is above zero while gross is below'],
      ['income', '2026-06-15, dividend, -12 USD', 'withheld is more than gross'],
      ['income', '2026-06-15, dividend, 12 USD', 'withheld is below zero'],
      ['income', '2026-06-15, dividend, 0 USD', 'gross must be more than zero'],
      ['cash-movement', '2026-01-05, gift, 100 EUR', '"gift" is not a kind of cash movement. Use deposit, withdrawal, fee, fee-refund'],
      ['cash-movement', '2026-01-05, deposit, -100 EUR', 'amount must be more than zero'],
      ['exchange', '2026-01-06, 10 EUR, into 10 EUR', 'sold_currency and bought_currency are the same'],
      ['exchange', '2026-01-06, 10 EUR, into 11 USD', 'fees and fee_currency go together, and only one is filled'],
      ['transfer', '2026-02-01, 10 EUR', 'from and to are the same account'],
      ['transfer', '2026-02-01, 1, 10 EUR', 'a transfer moves either instrument and quantity, or currency and amount'],
      ['split', '2026-03-01, 2.5 for 1', 'new "2.5" is not a whole number above zero'],
      ['split', '2026-03-01, 2 for 2', 'new and old are the same, so nothing splits'],
      ['spin-off', '2026-04-01, 1', 'instrument and received are the same instrument'],
      ['spin-off', '2026-04-01, 1', 'cost_share "1.5" is not from 0 to 1'],
    ])
  })

  it('leaves out a record that names no account or instrument that counts, and every instrument of a shared ISIN', () => {
    const missing = '3a1f0c2e-4b5d-4e6f-8a7b-9c0d1e2f3a99'
    expect(
      problemsOf({
        'investment-account': ACCOUNTS,
        instrument: [DOLLAR_SHARE, { ...EURO_FUND, isin: 'XX000000EMF1' }, { ...SPUN_OFF, isin: 'XX000000EMF1' }],
        trade: [{ ...BUY, account: missing }],
        income: [{ id: 'i1', account: ONE, kind: 'dividend', instrument: missing, date: '2026-06-15', currency: 'EUR', gross: '12' }],
        'cash-movement': [{ id: 'c1', account: missing, kind: 'deposit', date: '2026-01-05', currency: 'EUR', amount: '100' }],
        exchange: [{ id: 'e1', account: missing, date: '2026-01-06', sold: '10', sold_currency: 'EUR', bought: '11', bought_currency: 'USD' }],
        transfer: [{ id: 'm1', from: ONE, to: missing, date: '2026-02-01', instrument: missing, quantity: '1' }],
        split: [{ id: 's1', instrument: FUND, date: '2026-03-01', new: '2', old: '1' }],
        'spin-off': [{ id: 'o1', instrument: SHARE, received: SPINCO, date: '2026-04-01', quantity: '1', cost_share: '0.1' }],
        price: [{ id: 'p1', instrument: missing, date: '2026-09-30', price: '10' }],
      }),
    ).toEqual([
      ['instrument', 'Example Fund, EMF', 'another instrument has the ISIN XX000000EMF1 too'],
      ['instrument', 'Example Spinco, GHI', 'another instrument has the ISIN XX000000EMF1 too'],
      ['trade', '2026-01-10, buy, 10', 'account names no investment account in the file'],
      ['income', '2026-06-15, dividend, 12 EUR', 'instrument names no instrument in the file'],
      ['cash-movement', '2026-01-05, deposit, 100 EUR', 'account names no investment account in the file'],
      ['exchange', '2026-01-06, 10 EUR, into 11 USD', 'account names no investment account in the file'],
      ['transfer', '2026-02-01, 1', 'to names no investment account in the file'],
      ['transfer', '2026-02-01, 1', 'instrument names no instrument in the file'],
      ['split', '2026-03-01, 2 for 1', 'instrument names no instrument in the file'],
      ['spin-off', '2026-04-01, 1', 'received names no instrument in the file'],
      ['price', '2026-09-30, 10', 'instrument names no instrument in the file'],
    ])
  })

  it("keeps a trade in its instrument's currency, accrued interest to bonds, a spin-off in its parent's currency and one hand price a day", () => {
    expect(
      problemsOf({
        'investment-account': ACCOUNTS,
        instrument: [DOLLAR_SHARE, EURO_FUND, EURO_BOND, SPUN_OFF],
        trade: [
          { ...BUY, id: 't1', rate: '' },
          { ...BUY, id: 't2', instrument: FUND },
          { ...BUY, id: 't3', accrued: '1.5' },
          { ...BUY, id: 't4', instrument: BOND, rate: '', quantity: '1000', price: '98.5', accrued: '15.12' },
        ],
        'spin-off': [{ id: 'o1', instrument: SHARE, received: FUND, date: '2026-04-01', quantity: '1', cost_share: '0.1' }],
        price: [
          { id: 'p1', instrument: FUND, date: '2026-09-30', price: '10.51' },
          { id: 'p2', instrument: FUND, date: '2026-09-30', price: '10.52' },
        ],
      }),
    ).toEqual([
      ['trade', '2026-01-10, buy, 10', 'no rate, which a trade of "Example Tech" in USD needs, in USD per EUR'],
      ['trade', '2026-01-10, buy, 10', 'rate is filled, but "Example Fund" is quoted in EUR'],
      ['trade', '2026-01-10, buy, 10', 'accrued is filled, but "Example Tech" is not a bond quoted in percent'],
      ['spin-off', '2026-04-01, 1', '"Example Fund" is quoted in EUR, and its parent in USD'],
      ['price', '2026-09-30, 10.51', 'another price of "Example Fund" is for 30 Sep 2026 too'],
      ['price', '2026-09-30, 10.52', 'another price of "Example Fund" is for 30 Sep 2026 too'],
    ])
  })

  it("reads the fake build's made-up portfolio whole, with no sale or transfer beyond what its account holds", () => {
    const books = booksOf(fakeInvestmentsDocument('2026-10-30T09:00:00.000Z').records)

    expect(books.problems).toEqual([])
    expect(Object.fromEntries(Object.entries(books.book).map(([part, records]) => [part, records.length]))).toEqual({
      accounts: 2,
      instruments: 6,
      trades: 7,
      income: 4,
      cashMovements: 5,
      exchanges: 1,
      transfers: 2,
      splits: 1,
      spinOffs: 1,
      prices: 8,
    })
    expect([...investmentLots(books.book).values()].flatMap((lots) => [...lots.refused, ...lots.emptied])).toEqual([])
  })

  it('leaves out every record of an id another record holds too', () => {
    expect(problemsOf({ 'investment-account': [ACCOUNTS[0]!, { ...ACCOUNTS[0]!, name: 'Copy' }] }).map(([kind, label]) => [kind, label])).toEqual([
      ['investment-account', 'Broker One'],
      ['investment-account', 'Copy'],
    ])
  })
})

describe('the Investments write rules', () => {
  const used = new Set<string>()

  afterEach(async () => {
    await forgetCaches(used)
  })

  async function storeWith(records: Records) {
    const { store } = await driveHarness(used, documentOf(records), INVESTMENTS)
    return store
  }

  function onScreen<R>(store: Awaited<ReturnType<typeof storeWith>>, kind: RecordKind<R>, key: string): R {
    return recordOnScreen(store, kind, recordIdOf(kind, key), INVESTMENTS).record
  }

  const held: Records = { 'investment-account': ACCOUNTS, instrument: [DOLLAR_SHARE, SPUN_OFF], trade: [BUY] }

  it('refuses a sale beyond what its account holds on its day, and a removed buy that a later sale needs', async () => {
    const store = await storeWith({ ...held, trade: [BUY, { ...BUY, id: 't2', side: 'sell', date: '2026-02-10', quantity: '10' }] })
    const sale = onScreen(store, TRADE_RECORDS, 't2')

    await expect(store.write('Changed', (unit) => unit.of(TRADE_WRITES).change(sale, { ...sale, quantity: decimal('11') }))).rejects.toThrow(
      'The sale of "Example Tech" on 10 Feb 2026 would sell more than its account holds that day.',
    )
    await expect(store.write('Moved', (unit) => unit.of(TRADE_WRITES).change(sale, { ...sale, account: recordIdOf(INVESTMENT_ACCOUNT_RECORDS, TWO) }))).rejects.toThrow(WorkbookWriteRefused)
    await expect(store.write('Removed', (unit) => unit.of(TRADE_WRITES).remove(onScreen(store, TRADE_RECORDS, 't1')))).rejects.toThrow('The sale of "Example Tech" on 10 Feb 2026 would sell more')

    await store.write('Removed', (unit) => {
      unit.of(TRADE_WRITES).remove(onScreen(store, TRADE_RECORDS, 't1'))
      unit.of(TRADE_WRITES).remove(sale)
    })
    expect(store.state.workbook!.book.trades).toEqual([])
  })

  it('refuses a transfer of more units than its account holds, and a split that leaves a lot with no units', async () => {
    const store = await storeWith({
      ...held,
      trade: [
        { ...BUY, quantity: '0.000000000001' },
        { ...BUY, id: 't2', date: '2026-01-11', quantity: '1' },
      ],
    })
    const codec = codecOfInvestmentsKind(TRANSFER_RECORDS)
    const transfer = codec.make(storedFieldsOfValues({ from: TWO, to: ONE, date: '2026-02-01', instrument: SHARE, quantity: '1' }), recordIdOf(TRANSFER_RECORDS, 'm1'))
    const split = codecOfInvestmentsKind(SPLIT_RECORDS).make(storedFieldsOfValues({ instrument: SHARE, date: '2026-03-01', new: '1', old: '3' }), recordIdOf(SPLIT_RECORDS, 's1'))

    await expect(store.write('Added', (unit) => unit.of(TRANSFER_WRITES).add(transfer))).rejects.toThrow(
      'The transfer of "Example Tech" on 1 Feb 2026 would move more units than its account holds that day.',
    )
    // A third of a twelfth-place sliver rounds to nothing, which would leave its lot with no units.
    await expect(store.write('Added', (unit) => unit.of(SPLIT_WRITES).add(split))).rejects.toThrow('The split of "Example Tech" on 1 Mar 2026 would leave a lot with no units.')
  })

  it('refuses to remove an account or an instrument that a record still names, or to change what its trades read', async () => {
    const store = await storeWith(held)
    const account = onScreen(store, INVESTMENT_ACCOUNT_RECORDS, ONE)
    const share = onScreen(store, INSTRUMENT_RECORDS, SHARE)

    await expect(store.write('Removed', (unit) => unit.of(INVESTMENT_ACCOUNT_WRITES).remove(account))).rejects.toThrow(
      'The trade "2026-01-10, buy, 10" would then be left out: account names no investment account in the file.',
    )
    await expect(store.write('Removed', (unit) => unit.of(INSTRUMENT_WRITES).remove(share))).rejects.toThrow('instrument names no instrument in the file')
    await expect(store.write('Changed', (unit) => unit.of(INSTRUMENT_WRITES).change(share, { ...share, currency: 'EUR' as typeof share.currency }))).rejects.toThrow(
      'rate is filled, but "Example Tech" is quoted in EUR',
    )

    await store.write('Removed', (unit) => unit.of(INSTRUMENT_WRITES).remove(onScreen(store, INSTRUMENT_RECORDS, SPINCO)))
    expect(store.state.workbook!.book.instruments.map((instrument) => instrument.symbol)).toEqual(['ABC'])
  })

  it.each([
    ['an income', 'income', { id: 'i1', account: ONE, kind: 'interest', date: '2026-06-30', currency: 'EUR', gross: '3.15' }],
    ['a cash movement', 'cash-movement', { id: 'c1', account: ONE, kind: 'deposit', date: '2026-01-05', currency: 'EUR', amount: '2000' }],
    ['an exchange', 'exchange', { id: 'e1', account: ONE, date: '2026-01-06', sold: '1000', sold_currency: 'EUR', bought: '1085', bought_currency: 'USD' }],
    ['a transfer', 'transfer', { id: 'm1', from: ONE, to: TWO, date: '2026-02-01', currency: 'EUR', amount: '200' }],
  ])('refuses to remove an account that only %s names', async (_label, kind, record) => {
    const store = await storeWith({ 'investment-account': ACCOUNTS, [kind]: [record] })

    await expect(store.write('Removed', (unit) => unit.of(INVESTMENT_ACCOUNT_WRITES).remove(onScreen(store, INVESTMENT_ACCOUNT_RECORDS, ONE)))).rejects.toThrow('would then be left out')
  })

  it.each([
    ['an income', 'income', { id: 'i1', account: ONE, kind: 'dividend', instrument: SHARE, date: '2026-06-15', currency: 'USD', gross: '12', rate: '1.09' }],
    ['a transfer', 'transfer', { id: 'm1', from: ONE, to: TWO, date: '2026-02-01', instrument: SHARE, quantity: '4' }],
    ['a split', 'split', { id: 's1', instrument: SHARE, date: '2026-03-01', new: '2', old: '1' }],
    ['a spin-off', 'spin-off', { id: 'o1', instrument: SHARE, received: SPINCO, date: '2026-04-01', quantity: '1', cost_share: '0.1' }],
    ['a hand price', 'price', { id: 'p1', instrument: SHARE, date: '2026-09-30', price: '10.51' }],
  ])('refuses to remove an instrument that only %s names', async (_label, kind, record) => {
    const store = await storeWith({ 'investment-account': ACCOUNTS, instrument: [DOLLAR_SHARE, SPUN_OFF], [kind]: [record] })
    const target = kind === 'spin-off' ? SPINCO : SHARE

    await expect(store.write('Removed', (unit) => unit.of(INSTRUMENT_WRITES).remove(onScreen(store, INSTRUMENT_RECORDS, target)))).rejects.toThrow('would then be left out')
  })

  it('refuses to remove a spin-off whose received units a later sale needs', async () => {
    const sale = { id: 't3', account: ONE, instrument: SPINCO, side: 'sell', date: '2026-05-01', quantity: '1', price: '5', fees: '0', rate: '1.08' }
    const store = await storeWith({
      ...held,
      'spin-off': [{ id: 'o1', instrument: SHARE, received: SPINCO, date: '2026-04-01', quantity: '1', cost_share: '0.1' }],
      trade: [BUY, sale],
    })

    await expect(store.write('Removed', (unit) => unit.of(SPIN_OFF_WRITES).remove(onScreen(store, SPIN_OFF_RECORDS, 'o1')))).rejects.toThrow(
      'The sale of "Example Spinco" on 1 May 2026 would sell more',
    )
  })
})
