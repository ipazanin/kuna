import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { INSTRUMENT_WRITES, INVESTMENT_ACCOUNT_WRITES } from '../src/apps/investments/holdings/application/holdingWrites'
import { writeTransaction } from '../src/apps/investments/transactions/application/transactionWrites'
import { listedTransactions, passesFilter, transactionCount } from '../src/apps/investments/transactions/domain/listedTransactions'
import type { TransactionRecord } from '../src/apps/investments/transactions/domain/listedTransactions'
import { tradePreview } from '../src/apps/investments/transactions/domain/tradePreview'
import { ecbRateText, happeningsOfKind, keyOf, rateCurrency, textsOf, transactionDraft } from '../src/apps/investments/transactions/presentation/transactionForm'
import type { TransactionTexts } from '../src/apps/investments/transactions/presentation/transactionForm'
import type { InvestmentsBooks } from '../src/apps/investments/workbook/domain/investmentsBooks'
import { PRICE_RECORDS, TRADE_RECORDS } from '../src/apps/investments/workbook/domain/investmentKinds'
import { emptyInvestmentsDocument } from '../src/apps/investments/workbook/infrastructure/investmentsDocument'
import type { WorkbookStore } from '../src/shared/storage/application/createWorkbookStore'
import { WorkbookWriteRefused } from '../src/shared/storage/application/workbookWriteRefused'
import { EURO } from '../src/shared/money/currencyCode'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { USD, account, book, cashMovement, cashTransfer, decimal, dividend, exchange, instrument, rateBookOf, spinOff, split, trade, unitTransfer } from './fixtures/investments'
import { civil } from './fixtures/ledger'
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

  it('refuses to delete an account or a holding that records name, or to move a holding into another currency', async () => {
    const store = await storeWithBuys()

    await expect(store.write('Deleted', (unit) => unit.of(INVESTMENT_ACCOUNT_WRITES).remove(ONE))).rejects.toThrow('account names no investment account in the file')
    await expect(store.write('Deleted', (unit) => unit.of(INSTRUMENT_WRITES).remove(SHARE))).rejects.toThrow('instrument names no instrument in the file')
    await expect(store.write('Changed', (unit) => unit.of(INSTRUMENT_WRITES).change(SHARE, { ...SHARE, currency: EURO }))).rejects.toThrow('rate is filled, but "Example Tech" is quoted in EUR')

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
    expect(transactionDraft(typedBuy({ quantity: '1', price: '10', fees: '1.234' }), BOOK, 'k').errors.fees).toBe('An amount with at most two decimals, or blank')
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

  it('shows a changed record’s amounts with their cents, and one with more than two decimals as stored, which the form refuses', () => {
    const trade3 = trade('buy', ONE, SHARE, '2026-01-10', '10', '100', '1.234', '1.08')
    const fees = textsOf({ kind: 'trade', record: trade3 }, { happened: 'buy', instrument: null, today: civil('2026-10-21') }, BOOK)
    const income = textsOf({ kind: 'income', record: dividend(ONE, SHARE, '2026-06-15', '12.345', '1234.5', '1.1') }, { happened: 'buy', instrument: null, today: civil('2026-10-21') }, BOOK)

    expect([fees.fees, income.amount, income.withheld]).toEqual(['1.234', '12.345', '1,234.50'])
    expect(transactionDraft(fees, BOOK, 'k').errors.fees).toBe('An amount with at most two decimals, or blank')
    expect(transactionDraft(income, BOOK, 'k').errors.amount).toBe('An amount above zero with at most two decimals')
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
    expect(croatian.transactionDraft(changed, BOOK, 'k').errors.fees).toBeDefined()
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

  it('lists hand prices with every record, newest first, and filters them by kind, account and holding', () => {
    const listed = listedTransactions(book({ ...BOOK, prices: [handPrice] }), NO_RATES)

    expect(listed.map((entry) => entry.kind)).toEqual(['price', 'trade', 'exchange', 'cash-movement'])
    expect(listed.filter((entry) => passesFilter(entry, { kind: null, account: ONE.id, instrument: null })).map((entry) => entry.kind)).toEqual(['trade', 'exchange', 'cash-movement'])
    expect(listed.filter((entry) => passesFilter(entry, { kind: 'price', account: null, instrument: FUND.id }))).toHaveLength(1)
    expect(listed.filter((entry) => passesFilter(entry, { kind: null, account: null, instrument: SHARE.id }))).toHaveLength(1)
  })
})
