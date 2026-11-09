import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { INSTRUMENT_WRITES, INVESTMENT_ACCOUNT_WRITES } from '../src/apps/investments/holdings/application/holdingWrites'
import { FUND_MIX_WRITES, TARGET_WRITES, replaceRows } from '../src/apps/investments/holdings/application/mixWrites'
import { COUNTRY_ITEMS, NOT_SET, SECTOR_ITEMS, instrumentErrors, instrumentOfTexts, instrumentTexts, typeItems } from '../src/apps/investments/holdings/presentation/instrumentForm'
import { fundMixChanges, fundMixErrors, fundMixTexts, mixLineTexts, mixSum } from '../src/apps/investments/holdings/presentation/instrumentMixForm'
import { writeCheck } from '../src/apps/investments/overview/application/checkWrites'
import { writeTransaction } from '../src/apps/investments/transactions/application/transactionWrites'
import { listedTransactions, passesFilter, transactionCount, withImportFacts } from '../src/apps/investments/transactions/domain/listedTransactions'
import type { TransactionRecord } from '../src/apps/investments/transactions/domain/listedTransactions'
import { tradePreview } from '../src/apps/investments/transactions/domain/tradePreview'
import { DIVIDEND_CO, EXAMPLE_RATES, TECH, WORLD, exampleYear } from './fixtures/taxExample'
import { ecbRateText, happeningsOfKind, keyOf, rateCurrency, textsOf, transactionDraft } from '../src/apps/investments/transactions/presentation/transactionForm'
import type { TransactionTexts } from '../src/apps/investments/transactions/presentation/transactionForm'
import type { FundMixLine } from '../src/apps/investments/workbook/domain/fundMix'
import type { InvestmentsBooks } from '../src/apps/investments/workbook/domain/investmentsBooks'
import { FUND_MIX_RECORDS, INSTRUMENT_RECORDS, PRICE_RECORDS, SETTING_RECORDS, TRADE_RECORDS } from '../src/apps/investments/workbook/domain/investmentKinds'
import { SURTAX_CITY_2023_KEY } from '../src/apps/investments/workbook/domain/investmentSettings'
import { countryOf } from '../src/apps/investments/workbook/domain/mixGroup'
import type { Target } from '../src/apps/investments/workbook/domain/target'
import { emptyInvestmentsDocument } from '../src/apps/investments/workbook/infrastructure/investmentsDocument'
import type { WorkbookStore } from '../src/shared/storage/application/createWorkbookStore'
import { WorkbookWriteRefused } from '../src/shared/storage/application/workbookWriteRefused'
import { EURO } from '../src/shared/money/currencyCode'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { settingRow } from '../src/shared/storage/domain/settingRows'
import { BROKER, GBP, USD, account, book, cashMovement, cashTransfer, decimal, dividend, exchange, instrument, rateBookOf, spinOff, split, trade, unitTransfer } from './fixtures/investments'
import { civil, euros } from './fixtures/ledger'
import { INVESTMENTS, browserHarness, forgetCaches } from './fixtures/writeBack'

const used = new Set<string>()

afterEach(async () => {
  await forgetCaches(used)
})

const ONE = account('one', 'Broker One')
const TWO = account('two', 'Broker Two')
const SHARE = instrument('share', { name: 'Example Tech', currency: USD })
const FUND = instrument('fund', { name: 'Example Fund', prices: 'manual', sourceSymbol: '' })
const SPUN = instrument('spun', { name: 'Example Spinco', currency: USD, prices: 'manual', sourceSymbol: '' })
const DEPOSIT = cashMovement('deposit', ONE, '2026-01-05', '5000')
const BUY = trade('buy', ONE, SHARE, '2026-01-10', '10', '100', '1', '1.08')
const FUND_BUY = trade('buy', ONE, FUND, '2026-01-12', '3', '10', null)

/** A store whose file holds two accounts, three instruments, a deposit and two buys. */
async function storeWithBuys(): Promise<WorkbookStore<InvestmentsBooks>> {
  const { store } = await browserHarness(used, emptyInvestmentsDocument('2026-10-30T09:00:00.000Z'), INVESTMENTS)
  await store.write('Set up', (unit) => {
    unit.of(INVESTMENT_ACCOUNT_WRITES).add(ONE)
    unit.of(INVESTMENT_ACCOUNT_WRITES).add(TWO)
    ;[SHARE, FUND, SPUN].forEach((added) => unit.of(INSTRUMENT_WRITES).add(added))
    writeTransaction(unit, null, { kind: 'cash-movement', record: DEPOSIT })
    writeTransaction(unit, null, { kind: 'trade', record: BUY })
    writeTransaction(unit, null, { kind: 'trade', record: FUND_BUY })
  })
  return store
}

function bookOf(store: WorkbookStore<InvestmentsBooks>) {
  return store.state.workbook!.book
}

const handPrice = { id: recordIdOf(PRICE_RECORDS, 'p1'), instrument: FUND.id, date: civil('2026-09-30'), price: decimal('10.51'), note: 'Statement of 30 Sep' }

/** Each kind the dialog writes, as added and as changed. */
const KINDS: readonly (readonly [string, TransactionRecord, TransactionRecord])[] = [
  ['a sale', { kind: 'trade', record: trade('sell', ONE, SHARE, '2026-03-02', '4', '120', '1', '1.09') }, { kind: 'trade', record: trade('sell', ONE, SHARE, '2026-03-02', '6', '120', '1', '1.09') }],
  [
    'a dividend',
    { kind: 'income', record: dividend(ONE, SHARE, '2026-06-15', '12', '1.8', '1.1') },
    { kind: 'income', record: { ...dividend(ONE, SHARE, '2026-06-15', '12', '1.8', '1.1'), withheld: decimal('0') } },
  ],
  ['a fee', { kind: 'cash-movement', record: cashMovement('fee', ONE, '2026-03-01', '5') }, { kind: 'cash-movement', record: { ...cashMovement('fee', ONE, '2026-03-01', '5'), kind: 'fee-refund' } }],
  [
    'an exchange',
    { kind: 'exchange', record: exchange(ONE, '2026-01-06', '1000', EURO, '1085', USD, { amount: decimal('2'), currency: EURO }) },
    { kind: 'exchange', record: exchange(ONE, '2026-01-06', '1000', EURO, '1090', USD) },
  ],
  ['a transfer of units', { kind: 'transfer', record: unitTransfer(ONE, TWO, '2026-02-01', SHARE, '4') }, { kind: 'transfer', record: unitTransfer(ONE, TWO, '2026-02-01', SHARE, '5') }],
  ['a transfer of cash', { kind: 'transfer', record: cashTransfer(ONE, TWO, '2026-02-01', EURO, '200') }, { kind: 'transfer', record: cashTransfer(TWO, ONE, '2026-02-01', EURO, '200') }],
  ['a split', { kind: 'split', record: split(SHARE, '2026-04-01', 2, 1) }, { kind: 'split', record: split(SHARE, '2026-04-01', 4, 1) }],
  ['a spin-off', { kind: 'spin-off', record: spinOff(SHARE, SPUN, '2026-05-01', '2', '0.1') }, { kind: 'spin-off', record: spinOff(SHARE, SPUN, '2026-05-01', '3', '0.12') }],
  ['a hand price', { kind: 'price', record: handPrice }, { kind: 'price', record: { ...handPrice, price: decimal('10.6') } }],
]

describe('the transaction dialog writes', () => {
  it.each(KINDS)('adds, changes and deletes %s, and Undo puts the deleted one back', async (_name, added, changed) => {
    const store = await storeWithBuys()
    const before = transactionCount(bookOf(store))
    const changedRecord = { ...changed, record: { ...changed.record, id: added.record.id } } as TransactionRecord

    await store.write('Added', (unit) => writeTransaction(unit, null, added))
    expect(transactionCount(bookOf(store))).toBe(before + 1)
    await store.write('Changed', (unit) => writeTransaction(unit, added, changedRecord))
    const listed = listedTransactions(bookOf(store), rateBookOf(new Map())).find((entry) => entry.record.id === added.record.id)
    expect(listed?.record).toEqual(changedRecord.record)

    await store.write('Deleted', (unit) => writeTransaction(unit, changedRecord, null))
    expect(transactionCount(bookOf(store))).toBe(before)
    await store.undo(store.state.writes[0]!)
    expect(listedTransactions(bookOf(store), rateBookOf(new Map())).some((entry) => entry.record.id === added.record.id)).toBe(true)
  })

  it('adds a buy, and Undo of the add takes it out', async () => {
    const store = await storeWithBuys()
    const buy = trade('buy', ONE, SHARE, '2026-09-15', '5', '158', '1', '1.0853')

    await store.write('Added', (unit) => writeTransaction(unit, null, { kind: 'trade', record: buy }))
    expect(bookOf(store).trades).toContainEqual(buy)
    await store.undo(store.state.writes[0]!)
    expect(bookOf(store).trades).not.toContainEqual(buy)
  })

  it('refuses to turn one kind of record into another', async () => {
    const store = await storeWithBuys()

    await expect(store.write('Changed', (unit) => writeTransaction(unit, { kind: 'trade', record: BUY }, { kind: 'cash-movement', record: DEPOSIT }))).rejects.toThrow(
      'A trade cannot become a cash-movement.',
    )
  })

  it("keeps a bond trade's accrued interest through an edit, which neither the dialog nor the chat shows, until the trade names another instrument", () => {
    const bond = instrument('bond', { quoted: { kind: 'percent', coupon: decimal('3'), maturity: civil('2030-03-02') } })
    const bought = { ...trade('buy', ONE, bond, '2026-03-02', '1000', '99.5', '2'), accrued: decimal('12.34') }
    const edited = { ...bought, accrued: null, note: 'Checked' }

    const kept = withImportFacts({ kind: 'trade', record: bought }, { kind: 'trade', record: edited })
    const moved = withImportFacts({ kind: 'trade', record: bought }, { kind: 'trade', record: { ...edited, instrument: SHARE.id } })

    expect(kept.record).toEqual({ ...edited, accrued: decimal('12.34') })
    expect(moved.record).toEqual({ ...edited, instrument: SHARE.id })
  })
})

describe('the refusals the dialogs show', () => {
  it('refuses a sale beyond what its account holds on its day, and in the other account', async () => {
    const store = await storeWithBuys()
    const sale = trade('sell', ONE, SHARE, '2026-02-10', '11', '120', '1', '1.09')

    await expect(store.write('Added', (unit) => writeTransaction(unit, null, { kind: 'trade', record: sale }))).rejects.toThrow(
      'The sale of "Example Tech" on 10 Feb 2026 would sell more than its account holds that day.',
    )
    await expect(store.write('Added', (unit) => writeTransaction(unit, null, { kind: 'trade', record: { ...sale, account: TWO.id, quantity: decimal('1') } }))).rejects.toThrow(WorkbookWriteRefused)
    await expect(store.write('Added', (unit) => writeTransaction(unit, null, { kind: 'trade', record: { ...sale, date: civil('2026-01-09'), quantity: decimal('1') } }))).rejects.toThrow(
      'The sale of "Example Tech" on 9 Jan 2026 would sell more',
    )
    expect(bookOf(store).trades).toHaveLength(2)
  })

  it('refuses to delete or shrink a buy that a later sale needs', async () => {
    const store = await storeWithBuys()
    const sale = trade('sell', ONE, SHARE, '2026-02-10', '10', '120', '1', '1.09')
    await store.write('Added', (unit) => writeTransaction(unit, null, { kind: 'trade', record: sale }))

    await expect(store.write('Deleted', (unit) => writeTransaction(unit, { kind: 'trade', record: BUY }, null))).rejects.toThrow('The sale of "Example Tech" on 10 Feb 2026 would sell more')
    await expect(store.write('Changed', (unit) => writeTransaction(unit, { kind: 'trade', record: BUY }, { kind: 'trade', record: { ...BUY, quantity: decimal('9') } }))).rejects.toThrow(
      'The sale of "Example Tech" on 10 Feb 2026 would sell more',
    )
  })

  it('refuses a transfer of more units than its account holds, and a split that leaves a lot with no units', async () => {
    const store = await storeWithBuys()

    await expect(store.write('Added', (unit) => writeTransaction(unit, null, { kind: 'transfer', record: unitTransfer(TWO, ONE, '2026-02-01', SHARE, '1') }))).rejects.toThrow(
      'The transfer of "Example Tech" on 1 Feb 2026 would move more units than its account holds that day.',
    )
    await store.write('Added', (unit) => writeTransaction(unit, null, { kind: 'trade', record: trade('buy', TWO, FUND, '2026-02-01', '0.000000000001', '10', '0') }))
    await expect(store.write('Added', (unit) => writeTransaction(unit, null, { kind: 'split', record: split(FUND, '2026-03-01', 1, 3) }))).rejects.toThrow(
      'The split of "Example Fund" on 1 Mar 2026 would leave a lot with no units.',
    )
  })

  it('refuses a trade without the rate its currency needs, and a rate for one in euros', async () => {
    const store = await storeWithBuys()

    await expect(store.write('Added', (unit) => writeTransaction(unit, null, { kind: 'trade', record: { ...BUY, id: recordIdOf(TRADE_RECORDS, 'no-rate'), rate: null } }))).rejects.toThrow(
      'no rate, which a trade of "Example Tech" in USD needs, in USD per EUR',
    )
    await expect(store.write('Added', (unit) => writeTransaction(unit, null, { kind: 'trade', record: { ...FUND_BUY, id: recordIdOf(TRADE_RECORDS, 'rate'), rate: decimal('1.1') } }))).rejects.toThrow(
      'rate is filled, but "Example Fund" is quoted in EUR',
    )
  })

  it('refuses a spin-off into another currency, withholding over the gross, and a second hand price of a day', async () => {
    const store = await storeWithBuys()

    await expect(store.write('Added', (unit) => writeTransaction(unit, null, { kind: 'spin-off', record: spinOff(SHARE, FUND, '2026-05-01', '2', '0.1') }))).rejects.toThrow(
      '"Example Fund" is quoted in EUR, and its parent in USD',
    )
    await expect(store.write('Added', (unit) => writeTransaction(unit, null, { kind: 'income', record: dividend(ONE, SHARE, '2026-06-15', '12', '13', '1.1') }))).rejects.toThrow(
      'withheld is more than gross',
    )
    await store.write('Added', (unit) => writeTransaction(unit, null, { kind: 'price', record: handPrice }))
    await expect(store.write('Added', (unit) => writeTransaction(unit, null, { kind: 'price', record: { ...handPrice, id: recordIdOf(PRICE_RECORDS, 'p2') } }))).rejects.toThrow(
      'another price of "Example Fund" is for 30 Sep 2026 too',
    )
  })

  it('refuses to delete an account or a holding that records name, or to change the quote currency of a holding that records name', async () => {
    const store = await storeWithBuys()

    await expect(store.write('Deleted', (unit) => unit.of(INVESTMENT_ACCOUNT_WRITES).remove(ONE))).rejects.toThrow('account names no investment account in the file')
    await expect(store.write('Deleted', (unit) => unit.of(INSTRUMENT_WRITES).remove(SHARE))).rejects.toThrow('instrument names no instrument in the file')
    await expect(store.write('Changed', (unit) => unit.of(INSTRUMENT_WRITES).change(SHARE, { ...SHARE, currency: EURO }))).rejects.toThrow('rate is filled, but "Example Tech" is quoted in EUR')

    await expect(store.write('Changed', (unit) => unit.of(INSTRUMENT_WRITES).change(SHARE, { ...SHARE, currency: GBP }))).rejects.toThrow('"Example Tech" stays quoted in USD while records name it')
    await store.write('Changed', (unit) => unit.of(INSTRUMENT_WRITES).change(SPUN, { ...SPUN, currency: GBP }))

    await store.write('Deleted', (unit) => unit.of(INVESTMENT_ACCOUNT_WRITES).remove(TWO))
    expect(bookOf(store).accounts).toEqual([ONE])
    await store.undo(store.state.writes[0]!)
    expect(bookOf(store).accounts).toEqual([ONE, TWO])
  })
})

/** The texts of a new buy of the share, as the dialog starts it, with what the test types. */
function typedBuy(typed: Partial<TransactionTexts>): TransactionTexts {
  const start = textsOf(null, { happened: 'buy', instrument: SHARE.id, today: civil('2026-10-21') }, book({ accounts: [ONE], instruments: [SHARE, FUND] }))
  return { ...start, ...typed }
}

describe('the transaction form', () => {
  const BOOK = book({ accounts: [ONE, TWO], instruments: [SHARE, FUND, SPUN], cashMovements: [DEPOSIT], trades: [BUY, FUND_BUY] })
  const RATES = rateBookOf(new Map([[USD, [['2026-10-20', '1.0850']]]]))

  it('starts a buy of the holding it opens from, in the one account, with the ECB rate of the day or the last before it', () => {
    const texts = typedBuy({})

    expect([texts.account, texts.instrument, texts.date]).toEqual([ONE.id, SHARE.id, '2026-10-21'])
    expect(rateCurrency(texts, BOOK)).toBe('USD')
    expect(ecbRateText(RATES, USD, texts.date)).toBe('1.085')
    expect(ecbRateText(RATES, USD, '2026-10-19')).toBe('')
    expect(rateCurrency({ ...texts, instrument: FUND.id }, BOOK)).toBeNull()
  })

  it('reads a dollar buy with a k in its fee and a decimal comma in its units', () => {
    const draft = transactionDraft(typedBuy({ quantity: '2,5', price: '158.96', fees: '0.01k', rate: '1.085' }), BOOK, 'new-buy')

    expect(draft.errors).toEqual({})
    expect(draft.record).toEqual({
      kind: 'trade',
      record: { ...trade('buy', ONE, SHARE, '2026-10-21', '2.5', '158.96', '10', '1.085'), id: recordIdOf(TRADE_RECORDS, 'new-buy') },
    })
  })

  it('says what each field of a buy lacks, keeps a blank fee as not entered, and needs no rate in euros', () => {
    expect(Object.keys(transactionDraft(typedBuy({ account: '', instrument: '', date: '' }), BOOK, 'k').errors).sort()).toEqual(['account', 'date', 'instrument', 'price', 'quantity'])
    expect(transactionDraft(typedBuy({ quantity: '1', price: '10', rate: '' }), BOOK, 'k').errors).toEqual({ rate: 'A rate above zero, such as 1.0850' })
    expect(transactionDraft(typedBuy({ quantity: '1', price: '10', fees: 'one' }), BOOK, 'k').errors.fees).toBe('An amount, or blank')
    const fundBuy = transactionDraft(typedBuy({ instrument: FUND.id, quantity: '1', price: '10' }), BOOK, 'k').record
    expect(fundBuy?.kind === 'trade' && [fundBuy.record.fees, fundBuy.record.rate]).toEqual([null, null])
  })

  it('reads the other kinds, with a spin-off share typed in percent and the errors that keep a record out', () => {
    const base = typedBuy({})
    const read = (typed: Partial<TransactionTexts>) => transactionDraft({ ...base, ...typed }, BOOK, 'k')

    expect(read({ happened: 'income', incomeKind: 'dividend', currency: 'USD', amount: '12.00', withheld: '1.80', rate: '1.1' }).record?.record).toMatchObject({
      gross: decimal('12'),
      withheld: decimal('1.8'),
    })
    expect(read({ happened: 'income', amount: '12', withheld: '13', rate: '1.1' }).errors.withheld).toBeDefined()
    expect(read({ happened: 'income', incomeKind: 'interest', instrument: '', currency: 'EUR', amount: '3' }).record?.record).toMatchObject({ instrument: null, rate: null })
    expect(read({ happened: 'deposit', currency: 'EUR', amount: '3k' }).record?.record).toMatchObject({ kind: 'deposit', amount: decimal('3000') })
    expect(read({ happened: 'exchange', currency: 'EUR', amount: '1000', boughtCurrency: 'EUR', bought: '1085' }).errors.boughtCurrency).toBe('Another currency than the one sold')
    expect(read({ happened: 'transfer', toAccount: ONE.id, moves: 'cash', currency: 'EUR', amount: '200' }).errors.toAccount).toBe('Another account than the one it leaves')
    expect(read({ happened: 'transfer', toAccount: TWO.id, quantity: '4' }).record?.record).toMatchObject({ moved: { kind: 'units', instrument: SHARE.id, quantity: decimal('4') } })
    expect(read({ happened: 'split', newUnits: '3', oldUnits: '3' }).errors.oldUnits).toBe('New and old differ in a split')
    expect(read({ happened: 'split', newUnits: '1.5', oldUnits: '1' }).errors.newUnits).toBe('A whole number above zero')
    expect(read({ happened: 'spin-off', received: SPUN.id, quantity: '2', costShare: '8' }).record?.record).toMatchObject({ costShare: decimal('0.08') })
    expect(read({ happened: 'spin-off', received: FUND.id, quantity: '2', costShare: '8' }).errors.received).toBe('A holding quoted in USD, as the one it came from')
    expect(read({ happened: 'spin-off', received: SPUN.id, quantity: '2', costShare: '101' }).errors.costShare).toBe('A share from 0 to 100')
    expect(read({ happened: 'price', price: '0' }).errors.price).toBe('A price above zero, such as 10.42')
  })

  it('reads units grouped as English writes them, as the money fields beside them read amounts', () => {
    const read = (quantity: string) => transactionDraft(typedBuy({ quantity, price: '1,234.56', fees: '1,000', rate: '1.085' }), BOOK, 'k').record?.record

    expect(read('1,000')).toMatchObject({ quantity: decimal('1000'), price: decimal('1234.56'), fees: decimal('1000') })
    expect(read('0,125')).toMatchObject({ quantity: decimal('0.125') })
  })

  it('shows a changed record’s amounts with their cents, and one finer than a cent as stored, which a save rounds half away from zero to the cent', () => {
    const trade3 = trade('buy', ONE, SHARE, '2026-01-10', '10', '100', '1.235', '1.08')
    const fees = textsOf({ kind: 'trade', record: trade3 }, { happened: 'buy', instrument: null, today: civil('2026-10-21') }, BOOK)
    const income = textsOf({ kind: 'income', record: dividend(ONE, SHARE, '2026-06-15', '1234.5', '12.345', '1.1') }, { happened: 'buy', instrument: null, today: civil('2026-10-21') }, BOOK)

    expect([fees.fees, income.amount, income.withheld]).toEqual(['1.235', '1,234.50', '12.345'])
    expect(transactionDraft(fees, BOOK, 'k').record?.record).toMatchObject({ fees: decimal('1.24') })
    expect(transactionDraft(income, BOOK, 'k').record?.record).toMatchObject({ gross: decimal('1234.5'), withheld: decimal('12.35') })
    expect(transactionDraft({ ...fees, fees: '1.2x' }, BOOK, 'k').errors.fees).toBe('An amount, or blank')
  })

  it('shows a reversal’s amounts above zero and keeps them below zero, with a note saying what it reverses', () => {
    const reversal = { ...dividend(ONE, SHARE, '2026-06-22', '-12', '-1.8', '1.1'), note: 'Reverses a dividend' }
    const texts = textsOf({ kind: 'income', record: reversal }, { happened: 'buy', instrument: null, today: civil('2026-10-21') }, BOOK)

    expect([texts.reverses, texts.amount, texts.withheld]).toEqual([true, '12.00', '1.80'])
    expect(transactionDraft(texts, BOOK, 'k').record?.record).toMatchObject({ gross: decimal('-12'), withheld: decimal('-1.8'), note: 'Reverses a dividend' })
    expect(transactionDraft({ ...texts, note: ' ' }, BOOK, 'k').errors.note).toBe('A note saying which payment it reverses')
  })

  it('reads and shows numbers as Croatian writes them', async () => {
    vi.resetModules()
    vi.doMock('../src/shared/text/language', () => ({ language: 'hr', intlLocale: 'hr-HR' }))
    const croatian = await import('../src/apps/investments/transactions/presentation/transactionForm')
    vi.doUnmock('../src/shared/text/language')
    const start = { happened: 'buy' as const, instrument: SHARE.id, today: civil('2026-10-21') }
    const typed = { ...croatian.textsOf(null, start, BOOK), account: ONE.id, quantity: '1.000', price: '158,96', fees: '1.000', rate: '1,085' }
    const changed = croatian.textsOf({ kind: 'trade', record: trade('buy', ONE, SHARE, '2026-01-10', '1.5', '100', '1.234', '1.08') }, start, BOOK)

    expect(croatian.transactionDraft(typed, BOOK, 'k').record?.record).toMatchObject({ quantity: decimal('1000'), price: decimal('158.96'), fees: decimal('1000'), rate: decimal('1.085') })
    expect([changed.quantity, changed.fees, changed.rate]).toEqual(['1,5', '1,234', '1,08'])
    expect(croatian.transactionDraft(changed, BOOK, 'k').record?.record).toMatchObject({ fees: decimal('1.23') })
  })

  it('shows a record it changes as typed, and keeps its id and its own kinds', () => {
    const entry: TransactionRecord = { kind: 'spin-off', record: spinOff(SHARE, SPUN, '2026-05-01', '2', '0.08') }
    const texts = textsOf(entry, { happened: 'buy', instrument: null, today: civil('2026-10-21') }, BOOK)

    expect([texts.happened, texts.costShare, texts.quantity]).toEqual(['spin-off', '8', '2'])
    expect(transactionDraft(texts, BOOK, keyOf(entry)).record).toEqual(entry)
    expect(happeningsOfKind('cash-movement')).toEqual(['deposit', 'withdrawal', 'fee', 'fee-refund'])
    expect(happeningsOfKind('split')).toEqual(['split'])
  })
})

describe('the trade summary and the list', () => {
  const BOOK = book({ accounts: [ONE, TWO], instruments: [SHARE, FUND], cashMovements: [DEPOSIT], exchanges: [exchange(ONE, '2026-01-06', '2000', EURO, '2160', USD)], trades: [BUY] })
  const NO_RATES = rateBookOf(new Map())

  it('says what a buy pays, what the account holds and has in cash afterwards, and the new average cost', () => {
    const buy = trade('buy', ONE, SHARE, '2026-09-15', '10', '120', '1', '1.2')
    const preview = tradePreview(BOOK, NO_RATES, SHARE, buy)

    // 10 × 120 + 1 = 1,201, and 1,201 ÷ 1.2 = €1,000.83. The cash is 2,160 − 1,001 − 1,201.
    expect([preview.total, preview.euros, preview.unitsAfter, preview.cashAfter]).toEqual([decimal('1201'), 100083, decimal('20'), decimal('-42')])
    // The cost of the lots in dollars, (1,001 + 1,201) ÷ 20.
    expect([preview.averageCostBefore, preview.averageCostAfter]).toEqual([decimal('100.1'), decimal('110.1')])
    expect(preview.beyondHeld).toBe(false)
  })

  it('takes the average cost an edit starts from as the file stands, with the trade it changes', () => {
    const preview = tradePreview(BOOK, NO_RATES, SHARE, { ...BUY, quantity: decimal('20') })

    // 10 × 100 + 1 = 1,001 over 10 units now, and 20 × 100 + 1 = 2,001 over 20 once saved.
    expect([preview.averageCostBefore, preview.averageCostAfter]).toEqual([decimal('100.1'), decimal('100.05')])
  })

  it('says how many of a sale’s units are past two years, and when a sale is beyond what is held', () => {
    const old = { ...BUY, date: civil('2023-01-10') }
    const later = trade('buy', ONE, SHARE, '2026-01-12', '5', '100', '0', '1.08')
    const listed = book({ ...BOOK, trades: [old, later] })

    expect(tradePreview(listed, NO_RATES, SHARE, trade('sell', ONE, SHARE, '2026-10-01', '12', '120', '1', '1.1')).taxSplit?.taxFree.quantity).toEqual(decimal('10'))
    expect(tradePreview(listed, NO_RATES, SHARE, trade('sell', TWO, SHARE, '2026-10-01', '1', '120', '1', '1.1')).beyondHeld).toBe(true)
  })

  it("previews the tax a sale adds to its year, against the year's losses, and reads about while its rate is not out", () => {
    const records = exampleYear()
    const tech = records.trades.find((record) => record.instrument === TECH.id && record.side === 'sell')!
    const others = { ...records, trades: records.trades.filter((record) => record.id !== tech.id) }

    // With the sale the year owes 16.30. Without it the June loss of 80.00 outweighs the World ETF's 49.17, so nothing.
    // Alone, 12% of the sale's 166.67 would be 20.00.
    expect(tradePreview(others, EXAMPLE_RATES, TECH, tech).tax).toEqual({ year: 2026, onSale: euros(16.3), forYear: euros(16.3), estimated: false, beforeSurtax: false, nearTaxFreeDay: null })
    const alone = book({ ...records, trades: records.trades.filter((record) => record.instrument === TECH.id) })
    expect(tradePreview(book({ ...alone, trades: alone.trades.filter((record) => record.id !== tech.id) }), EXAMPLE_RATES, TECH, tech).tax?.onSale).toBe(euros(20))
    const typedToday = { ...tech, date: civil('2026-11-04') }
    expect(tradePreview(others, EXAMPLE_RATES, TECH, typedToday).tax?.estimated).toBe(true)
  })

  it('previews a late-December sale on the next year, a 2023 sale before surtax, and no tax for a year before 2023', () => {
    const etf = instrument('etf')
    const records = book({ instruments: [etf], trades: [trade('buy', BROKER, etf, '2021-03-01', '30', '100', '0')] })
    const sell = (day: string) => tradePreview(records, EXAMPLE_RATES, etf, trade('sell', BROKER, etf, day, '10', '110', '0'))?.tax ?? null

    // 10 units at 110.00 against 100.00 is 100.00 of gain, past two years in every case, so the tax line is zero.
    expect([sell('2026-12-30')?.year, sell('2023-06-01')?.year, sell('2023-06-01')?.beforeSurtax, sell('2022-06-01')]).toEqual([2027, 2023, true, null])
  })

  it("previews a 2023 sale with the owner's city saved as its tax and the city's surtax", () => {
    const etf = instrument('etf')
    const records = book({
      instruments: [etf],
      trades: [trade('buy', BROKER, etf, '2023-01-09', '20', '100', '0')],
      settings: [settingRow(SETTING_RECORDS, SURTAX_CITY_2023_KEY, '133')],
    })

    // 10 units at 110.00 against 100.00 is 100.00 of gain under two years. 10% is 10.00, and Zagreb's 18% of it is 1.80.
    const tax = tradePreview(records, EXAMPLE_RATES, etf, trade('sell', BROKER, etf, '2023-06-01', '10', '110', '0')).tax
    expect([tax?.onSale, tax?.forYear, tax?.beforeSurtax]).toEqual([euros(11.8), euros(11.8), false])
  })

  it("tells the tax a sale adds apart from the year's tax with it", () => {
    const records = exampleYear()
    const tech = records.trades.find((record) => record.instrument === TECH.id && record.side === 'sell')!
    const others = { ...records, trades: records.trades.filter((record) => record.id !== tech.id && !(record.instrument === DIVIDEND_CO.id && record.side === 'sell')) }

    // Without the June loss the year has the World ETF's 49.17, 5.90 of tax. With Example Tech's 166.67 it has
    // 215.84, 25.90 of tax, so the sale adds 20.00.
    expect(tradePreview(others, EXAMPLE_RATES, TECH, tech).tax).toMatchObject({ onSale: euros(20), forYear: euros(25.9) })
  })

  it('warns on the sell form when a lot it closes turns tax-free within five days', () => {
    // The 5 World ETF units left from 10 Jun 2025 turn tax-free on 11 Jun 2027.
    const sale = trade('sell', BROKER, WORLD, '2027-06-09', '5', '140', '0')

    expect(tradePreview(exampleYear(), EXAMPLE_RATES, WORLD, sale).tax?.nearTaxFreeDay).toBe('2027-06-11')
    expect(tradePreview(exampleYear(), EXAMPLE_RATES, WORLD, { ...sale, date: civil('2027-06-05') }).tax?.nearTaxFreeDay).toBeNull()
  })

  it('lists hand prices with every record, newest first, and filters them by kind, account and holding', () => {
    const listed = listedTransactions(book({ ...BOOK, prices: [handPrice] }), NO_RATES)

    expect(listed.map((entry) => entry.kind)).toEqual(['price', 'trade', 'exchange', 'cash-movement'])
    expect(listed.filter((entry) => passesFilter(entry, { kind: null, account: ONE.id, instrument: null })).map((entry) => entry.kind)).toEqual(['trade', 'exchange', 'cash-movement'])
    expect(listed.filter((entry) => passesFilter(entry, { kind: 'price', account: null, instrument: FUND.id }))).toHaveLength(1)
    expect(listed.filter((entry) => passesFilter(entry, { kind: null, account: null, instrument: SHARE.id }))).toHaveLength(1)
  })
})

/** A line of the fund's mix by sector. */
function sectorLine(group: string, percent: string): Omit<FundMixLine, 'id'> {
  return { instrument: FUND.id, slice: { mix: 'sector', group } as FundMixLine['slice'], percent: decimal(percent) }
}

function classTarget(group: string, percent: string): Omit<Target, 'id'> {
  return { slice: { mix: 'class', group } as Target['slice'], percent: decimal(percent) }
}

describe('the mixes, targets and checks', () => {
  it('writes a fund’s mix whole, changes it to fewer lines in one write, and Undo puts the lines back', async () => {
    const store = await storeWithBuys()

    await store.write('Mix set', (unit) => replaceRows(unit, FUND_MIX_WRITES, [], [sectorLine('financials', '62.5'), sectorLine('health-care', '25'), sectorLine('energy', '12.5')]))
    const written = bookOf(store).fundMixes
    expect(written.map((line) => [line.slice.group, line.percent])).toEqual([
      ['financials', decimal('62.5')],
      ['health-care', decimal('25')],
      ['energy', decimal('12.5')],
    ])

    await store.write('Mix changed', (unit) => replaceRows(unit, FUND_MIX_WRITES, written, [sectorLine('utilities', '100')]))
    expect(bookOf(store).fundMixes).toEqual([{ ...sectorLine('utilities', '100'), id: written[0]!.id }])
    await store.undo(store.state.writes[0]!)
    expect(bookOf(store).fundMixes).toEqual(written)
  })

  it('refuses a fund’s mix that does not add up to 100%, a change of one line alone, and deleting the fund while its mix names it', async () => {
    const store = await storeWithBuys()

    await expect(store.write('Mix set', (unit) => replaceRows(unit, FUND_MIX_WRITES, [], [sectorLine('financials', '60'), sectorLine('energy', '30')]))).rejects.toThrow(
      'the lines of "Example Fund" by sector add up to 90%, not 100%',
    )
    await store.write('Mix set', (unit) => replaceRows(unit, FUND_MIX_WRITES, [], [sectorLine('financials', '60'), sectorLine('energy', '40')]))
    const [financials] = bookOf(store).fundMixes
    await expect(store.write('Changed', (unit) => unit.of(FUND_MIX_WRITES).change(financials!, { ...financials!, percent: decimal('50') }))).rejects.toThrow(WorkbookWriteRefused)
    await expect(store.write('Deleted', (unit) => unit.of(INSTRUMENT_WRITES).remove(FUND))).rejects.toThrow(
      'The line of a fund mix "sector, financials, 60%" would then be left out: instrument names no instrument in the file.',
    )
  })

  it('replaces every target held with those of another mix, refuses targets of a second mix beside them, targets that do not add up, and an account deleted while a target names it', async () => {
    const store = await storeWithBuys()
    const accountTargets: Omit<Target, 'id'>[] = [
      { slice: { mix: 'account', group: ONE.id }, percent: decimal('75') },
      { slice: { mix: 'account', group: TWO.id }, percent: decimal('25') },
    ]

    await store.write('Targets set', (unit) => replaceRows(unit, TARGET_WRITES, [], [classTarget('stocks', '70'), classTarget('bonds', '20'), classTarget('cash', '10')]))
    await expect(store.write('Targets set', (unit) => replaceRows(unit, TARGET_WRITES, bookOf(store).targets, [classTarget('stocks', '70'), classTarget('cash', '20')]))).rejects.toThrow(
      'the targets by class add up to 90%, not 100%',
    )
    await expect(store.write('Targets set', (unit) => replaceRows(unit, TARGET_WRITES, [], accountTargets))).rejects.toThrow(
      'Targets are set for one mix at a time, so targets by account cannot stay beside targets by class.',
    )
    await store.write('Targets set', (unit) => replaceRows(unit, TARGET_WRITES, bookOf(store).targets, accountTargets))
    expect(bookOf(store).targets.map((target) => target.slice)).toEqual(accountTargets.map((target) => target.slice))
    await expect(store.write('Deleted', (unit) => unit.of(INVESTMENT_ACCOUNT_WRITES).remove(TWO))).rejects.toThrow(
      'The target "account, 25%" would then be left out: group names no investment account in the file.',
    )
  })

  it('keeps a check’s record only while it differs from the default, and Undo brings back the one before', async () => {
    const store = await storeWithBuys()
    const held = () => bookOf(store).checks.find((setting) => setting.check === 'cash') ?? null

    await store.write('Threshold', (unit) => writeCheck(unit, held(), 'cash', decimal('15'), true))
    expect(held()).toMatchObject({ threshold: decimal('15'), off: false })
    await store.write('Switched off', (unit) => writeCheck(unit, held(), 'cash', decimal('10'), false))
    expect(held()).toMatchObject({ threshold: null, off: true })
    await store.write('Back on', (unit) => writeCheck(unit, held(), 'cash', decimal('10'), true))
    expect(bookOf(store).checks).toEqual([])
    await store.undo(store.state.writes[0]!)
    expect(held()).toMatchObject({ threshold: null, off: true })
  })
})

describe('the instrument form', () => {
  it('reads a sector, a country or region and a TER typed with either decimal mark, and keeps blank as none', () => {
    const typed = { ...instrumentTexts(null), name: 'Example Fund', symbol: 'EMF', sector: 'financials' as const, country: 'europe', ter: '0,2' }

    expect(instrumentOfTexts(typed, [], recordIdOf(INSTRUMENT_RECORDS, 'new'), { quoted: { kind: 'unit' }, benchmark: false })).toMatchObject({
      sector: 'financials',
      country: 'europe',
      ter: decimal('0.2'),
    })
    expect(instrumentOfTexts({ ...typed, sector: '', country: '', ter: ' ' }, [], recordIdOf(INSTRUMENT_RECORDS, 'new'), { quoted: { kind: 'unit' }, benchmark: false })).toMatchObject({
      sector: null,
      country: null,
      ter: null,
    })
    expect(instrumentErrors({ ...typed, ter: 'low' }, []).ter).toBe('A yearly cost in percent such as 0.20, or blank')
    expect(instrumentTexts({ ...SHARE, sector: 'energy', country: countryOf('US'), ter: decimal('0.07') })).toMatchObject({ sector: 'energy', country: 'US', ter: '0.07' })
  })

  it('takes the class from a type that holds one, keeps the class field for a fund, and offers a percent bond or gold in grams its one type', () => {
    const typed = { ...instrumentTexts(null), name: 'Example Coin', symbol: 'XCN', class: 'stocks' as const }
    const unit = { quoted: { kind: 'unit' }, benchmark: false } as const

    expect(instrumentOfTexts({ ...typed, type: 'crypto' }, [], recordIdOf(INSTRUMENT_RECORDS, 'new'), unit)).toMatchObject({ type: 'crypto', class: 'crypto' })
    expect(instrumentOfTexts({ ...typed, type: 'fund', class: 'gold' }, [], recordIdOf(INSTRUMENT_RECORDS, 'new'), unit)).toMatchObject({ type: 'fund', class: 'gold' })
    expect(instrumentOfTexts(typed, [], recordIdOf(INSTRUMENT_RECORDS, 'new'), unit)).toMatchObject({ type: null, class: 'stocks' })
    expect(instrumentTexts({ ...SHARE, type: 'share' }).type).toBe('share')
    expect(typeItems('unit').map((item) => item.value)).toEqual(['share', 'fund', 'bond', 'gold', 'crypto'])
    expect(typeItems('percent').map((item) => item.value)).toEqual(['bond'])
    expect(typeItems('gram').map((item) => item.value)).toEqual(['gold'])
  })

  it('offers no type, sector or country whose value is blank or the Not set row’s stand-in, since a list item cannot be blank', () => {
    const values = [...typeItems('unit'), ...SECTOR_ITEMS, ...COUNTRY_ITEMS].map((item) => item.value)

    expect(values).not.toContain('')
    expect(values).not.toContain(NOT_SET)
    expect(NOT_SET).not.toBe('')
  })

  it('keeps a fund’s dividends as typed, blank as none, and drops them once the type is no longer a fund', () => {
    const typed = { ...instrumentTexts(null), name: 'Example Fund', symbol: 'EMF', type: 'fund' as const, distribution: 'accumulating' as const }
    const unit = { quoted: { kind: 'unit' }, benchmark: false } as const

    expect(instrumentOfTexts(typed, [], recordIdOf(INSTRUMENT_RECORDS, 'new'), unit)).toMatchObject({ type: 'fund', distribution: 'accumulating' })
    expect(instrumentOfTexts({ ...typed, distribution: '' }, [], recordIdOf(INSTRUMENT_RECORDS, 'new'), unit)).toMatchObject({ distribution: null })
    expect(instrumentOfTexts({ ...typed, type: 'share' }, [], recordIdOf(INSTRUMENT_RECORDS, 'new'), unit)).toMatchObject({ type: 'share', distribution: null })
    expect(instrumentTexts({ ...SHARE, type: 'fund', distribution: 'distributing' }).distribution).toBe('distributing')
  })

  it('says what a fund’s mix lacks: a group, a group on one line only, a percent above 0 and at most 100, and lines that add up to 100%', () => {
    const typed = { sector: [mixLineTexts('', '60'), mixLineTexts('energy', '0'), mixLineTexts('energy', '120')], country: [] }
    const errors = fundMixErrors(typed)

    expect(errors.lines.sector).toEqual([
      { group: 'Choose a group', percent: null },
      { group: null, percent: 'A percent above 0, at most 100' },
      { group: 'On another line too', percent: 'A percent above 0, at most 100' },
    ])
    expect(errors.whole).toEqual({ sector: 'Lines that add up to 100%', country: null })
    expect(mixSum(typed.sector)).toEqual(decimal('60'))
    expect(fundMixChanges(typed, [], FUND.id)).toBeNull()
  })

  it('gives only the mixes whose lines changed, with the lines in the order typed', () => {
    const held: FundMixLine[] = [
      { ...sectorLine('financials', '60'), id: recordIdOf(FUND_MIX_RECORDS, 'm1') },
      { ...sectorLine('energy', '40'), id: recordIdOf(FUND_MIX_RECORDS, 'm2') },
    ]
    const typed = fundMixTexts(held)

    expect(typed.sector.map((line) => [line.group, line.percent])).toEqual([
      ['financials', '60'],
      ['energy', '40'],
    ])
    expect(fundMixChanges(typed, held, FUND.id)).toEqual([])
    const changed = fundMixChanges({ sector: typed.sector, country: [mixLineTexts('US', '62,5'), mixLineTexts('europe', '37.5')] }, held, FUND.id)
    expect(changed).toEqual([
      {
        held: [],
        wanted: [
          { instrument: FUND.id, slice: { mix: 'country', group: 'US' }, percent: decimal('62.5') },
          { instrument: FUND.id, slice: { mix: 'country', group: 'europe' }, percent: decimal('37.5') },
        ],
      },
    ])
    expect(fundMixChanges({ sector: [], country: [] }, held, FUND.id)).toEqual([{ held, wanted: [] }])
  })

  it('writes a new fund and its mix in one write, and deletes the fund with its mix in one write that Undo reverses', async () => {
    const store = await storeWithBuys()
    const fund = instrument('world', { name: 'Example World Fund' })
    const lines = fundMixChanges({ sector: [], country: [mixLineTexts('world', '100')] }, [], fund.id)!

    await store.write('Holding added', (unit) => {
      unit.of(INSTRUMENT_WRITES).add(fund)
      lines.forEach((mix) => replaceRows(unit, FUND_MIX_WRITES, mix.held, mix.wanted))
    })
    expect(bookOf(store).fundMixes.map((line) => [line.instrument, line.slice])).toEqual([[fund.id, { mix: 'country', group: 'world' }]])

    await store.write('Holding deleted', (unit) => {
      replaceRows(unit, FUND_MIX_WRITES, bookOf(store).fundMixes, [])
      unit.of(INSTRUMENT_WRITES).remove(fund)
    })
    expect(bookOf(store).fundMixes).toEqual([])
    await store.undo(store.state.writes[0]!)
    expect(bookOf(store).instruments.map((held) => held.id)).toContain(fund.id)
    expect(bookOf(store).fundMixes).toHaveLength(1)
  })
})
