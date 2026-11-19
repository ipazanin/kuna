import { describe, expect, it } from 'vitest'

import { statementDryRun } from '../src/apps/spending/statements/domain/statementDryRun'
import type { StatementRow, StatementRows } from '../src/apps/spending/statements/domain/statementRows'
import { payeeCondition } from '../src/apps/spending/workbook/domain/spendingRule'
import type { SpendingRule } from '../src/apps/spending/workbook/domain/spendingRule'
import { ITEM_RECORDS, RULE_RECORDS } from '../src/apps/spending/workbook/domain/spendingKinds'
import { wholeItemOf } from '../src/apps/spending/workbook/domain/rowItems'
import type { StoredRow, Transaction } from '../src/apps/spending/workbook/domain/transaction'
import type { TransactionItem } from '../src/apps/spending/workbook/domain/transactionItem'
import { accountMoneyFromAmount } from '../src/shared/money/accountMoney'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { reviewCount } from '../src/apps/spending/statements/domain/reviewQueue'
import { category, OTP, REVOLUT_EUR, row, spendingBook, transactionId, wholeItems } from './fixtures/spending'
import { civil } from './fixtures/ledger'

const DAY = civil('2026-10-30')
const TRAVEL = category('Travel/Accommodation').id
const VIENNA = recordIdOf(ITEM_RECORDS, 'label-vienna')

/** A row the sync brought that the bank has not booked yet, filed by a person unless the fields say otherwise. */
function waiting(on: typeof OTP, date: string, amount: number, payee: string, fields: Partial<StoredRow> = {}): StoredRow {
  return row(on, date, amount, 'Travel/Accommodation', {
    source: 'statement',
    payee,
    description: payee,
    importKey: `bank-pending ${payee} ${date}`,
    statement: 'Enable Banking',
    categorisedBy: 'person',
    pending: true,
    ...fields,
  })
}

function synced(on: typeof OTP, date: string, amount: number, payee: string, fields: Partial<StatementRow> = {}): StatementRow {
  return {
    account: on.id,
    date: civil(date),
    amount: accountMoneyFromAmount(amount),
    payee,
    category: null,
    description: payee,
    counterpartyIban: '',
    importKey: `bank-${payee} ${date} ${amount}`,
    movedAt: '',
    pocket: false,
    cashWithdrawal: false,
    pending: false,
    ...fields,
  }
}

const SEEN = new Map([[OTP.id, { from: civil('2026-10-16'), to: civil('2026-10-29') }]])

const syncOf = (rows: readonly StatementRow[], covers = SEEN): StatementRows => ({ label: 'Enable Banking', rows, notes: [], covers })

/** The row's one item with a label and a note, as a person filed it. */
function filedItem(entry: Transaction): TransactionItem {
  return wholeItemOf(entry, { category: TRAVEL, note: 'two nights', link: null, labels: [VIENNA] })
}

function itemsAfter(run: ReturnType<typeof statementDryRun>, entry: Transaction): readonly TransactionItem[] | undefined {
  return run.changed.find(({ before }) => before.id === entry.id)?.items
}

describe('a row the bank had not booked yet', () => {
  it('takes the booked row on a later day at the same amount and keeps its filing, labels and note', () => {
    const hotel = waiting(OTP, '2026-10-20', -64.2, 'HOTEL ESPLANADE')
    const run = statementDryRun(spendingBook([hotel], { items: [filedItem(hotel)] }), syncOf([synced(OTP, '2026-10-22', -64.2, 'HOTEL ESPLANADE')]), DAY)

    expect(run).toMatchObject({ added: [], newRows: 0, pending: { booked: 1, gone: [] } })
    expect(run.changed.map(({ after }) => [after.id, after.date, after.pending, after.importKey])).toEqual([[hotel.id, civil('2026-10-22'), false, 'bank-HOTEL ESPLANADE 2026-10-22 -64.2']])
    expect(itemsAfter(run, hotel)).toEqual([filedItem(hotel)])
    expect(run.lines.map((line) => [line.outcome, line.category])).toEqual([['booked', TRAVEL]])
  })

  it('keeps a payee a person renamed and follows the bank on one they did not', () => {
    const renamed = waiting(OTP, '2026-10-20', -12, 'CAFE 12', { payee: 'Morning coffee' })
    const plain = waiting(OTP, '2026-10-21', -30, 'MARKET 7')
    const run = statementDryRun(spendingBook([renamed, plain]), syncOf([synced(OTP, '2026-10-21', -12, 'CAFE 12 ZAGREB'), synced(OTP, '2026-10-22', -30, 'MARKET 7 ZAGREB')]), DAY)

    expect(run.changed.map(({ after }) => after.payee)).toEqual(['Morning coffee', 'MARKET 7 ZAGREB'])
  })

  it('stays two of two equal payments on one day, one booked and one still pending', () => {
    const first = waiting(OTP, '2026-10-20', -2.4, 'COFFEE', { importKey: 'bank-pending coffee 1' })
    const second = waiting(OTP, '2026-10-20', -2.4, 'COFFEE', { importKey: 'bank-pending coffee 2' })
    const run = statementDryRun(
      spendingBook([first, second]),
      syncOf([synced(OTP, '2026-10-21', -2.4, 'COFFEE'), synced(OTP, '2026-10-20', -2.4, 'COFFEE', { importKey: second.importKey, pending: true })]),
      DAY,
    )

    expect(run).toMatchObject({ added: [], alreadyIn: 1, pending: { booked: 1, gone: [] } })
    expect(run.changed.map(({ before }) => before.id)).toEqual([first.id])
  })

  it('takes a newer pending row of the same money in its place, still pending', () => {
    const hold = waiting(OTP, '2026-10-20', -64.2, 'HOTEL ESPLANADE')
    const run = statementDryRun(spendingBook([hold]), syncOf([synced(OTP, '2026-10-20', -64.2, 'HOTEL ESPLANADE', { importKey: 'bank-pending another key', pending: true })]), DAY)

    expect(run.changed.map(({ after }) => [after.id, after.pending, after.importKey])).toEqual([[hold.id, true, 'bank-pending another key']])
  })

  it('books a transfer leg and keeps its pair', () => {
    const out = waiting(OTP, '2026-10-20', -100, 'Top-up', { pair: transactionId(90), categorisedBy: null })
    const run = statementDryRun(spendingBook([out]), syncOf([synced(OTP, '2026-10-21', -100, 'Top-up')]), DAY)

    expect(run.changed.map(({ after }) => after.pair)).toEqual([out.pair])
  })

  it('goes with its items when the bank no longer lists it on a day the sync saw whole, and stays outside those days', () => {
    const cancelled = waiting(OTP, '2026-10-20', -64.2, 'HOTEL ESPLANADE')
    const today = waiting(OTP, '2026-10-30', -5, 'BAKERY')
    const run = statementDryRun(spendingBook([cancelled, today]), syncOf([synced(OTP, '2026-10-25', -3, 'BAKERY')]), DAY)

    expect(run.pending?.gone).toEqual([cancelled])
    expect(run.changed).toEqual([])
  })

  it('removes nothing from a statement that says no days it saw whole, and takes no part in a statement of another source', () => {
    const hold = waiting(OTP, '2026-10-20', -64.2, 'HOTEL ESPLANADE')
    const fromFile = { ...synced(OTP, '2026-10-21', -64.2, 'HOTEL ESPLANADE'), importKey: 'file-row-1' }

    expect(statementDryRun(spendingBook([hold]), { label: 'export.csv', rows: [synced(OTP, '2026-10-25', -3, 'BAKERY')], notes: [] }, DAY).pending).toBeUndefined()
    expect(statementDryRun(spendingBook([hold]), { ...syncOf([fromFile]), label: 'export.csv' }, DAY).pending).toBeUndefined()
  })

  it('leaves a note naming how you filed a gone row you had filed, by the names its category and labels had, and none for one only the rules filed', () => {
    const hotel = waiting(OTP, '2026-10-20', -64.2, 'HOTEL ESPLANADE')
    const ruled = waiting(OTP, '2026-10-21', -12, 'KIOSK', { categorisedBy: 'rule' })
    const book = spendingBook([hotel, ruled], { items: [filedItem(hotel), ...wholeItems([ruled])], labels: [{ id: VIENNA, name: 'Vienna' }] })
    const run = statementDryRun(book, syncOf([synced(OTP, '2026-10-25', -3, 'BAKERY')]), DAY)

    expect(run.pending?.gone).toEqual([hotel, ruled])
    expect(run.pending?.dropped.map(({ account, date, amount, payee, filing }) => ({ account, date, amount, payee, filing }))).toEqual([
      { account: OTP.id, date: hotel.date, amount: hotel.amount, payee: 'HOTEL ESPLANADE', filing: 'Accommodation, Vienna, two nights' },
    ])
  })

  it('counts each note of a dropped payment on To review until you press OK', () => {
    const run = statementDryRun(spendingBook([waiting(OTP, '2026-10-20', -64.2, 'HOTEL ESPLANADE')]), syncOf([synced(OTP, '2026-10-25', -3, 'BAKERY')]), DAY)
    const dropped = run.pending?.dropped ?? []

    expect(reviewCount(spendingBook([], { dropped }))).toBe(1)
  })

  it('leaves the other leg of a gone row a lone leg', () => {
    const out = waiting(OTP, '2026-10-20', -100, 'Top-up', { categorisedBy: null })
    const into = row(REVOLUT_EUR, '2026-10-20', 100, 'Between my accounts', { source: 'statement', importKey: 'bank-in', pair: out.id })
    const paired = { ...out, pair: into.id }
    const run = statementDryRun(spendingBook([paired, into]), syncOf([synced(OTP, '2026-10-25', -3, 'BAKERY')]), DAY)

    expect(run.pending?.gone).toEqual([paired])
    expect(run.changed.map(({ before, after }) => [before.id, after.pair])).toEqual([[into.id, null]])
  })

  it('is filed by the rules on its booked facts while it still waits on review', () => {
    const fuel: SpendingRule = {
      id: recordIdOf(RULE_RECORDS, 'fuel'),
      order: 1,
      conditions: [payeeCondition({ payee: 'INA', counterpartyIban: '' })!],
      category: category('Transport/Fuel').id,
      labels: [],
      stop: false,
      withdrawal: null,
      link: null,
    }
    const hold = waiting(OTP, '2026-10-20', -40, 'PAYMENT 1', { categorisedBy: null, category: null })
    const run = statementDryRun(spendingBook([hold], { rules: [fuel] }), syncOf([synced(OTP, '2026-10-21', -40, 'INA ILICA', { description: 'PAYMENT 1' })]), DAY)

    expect(run.changed.map(({ after, items }) => [after.categorisedBy, items?.map((item) => item.category)])).toEqual([['rule', [category('Transport/Fuel').id]]])
  })

  it('books at another amount from the same payee and its one item follows, while a booked row of the exact amount comes first', () => {
    const card = waiting(OTP, '2026-10-20', -27.4, 'BOOKSHOP NY')
    const fuel = waiting(OTP, '2026-10-20', -100, 'INA ILICA')
    const run = statementDryRun(
      spendingBook([card, fuel], { items: [filedItem(card), filedItem(fuel)] }),
      syncOf([synced(OTP, '2026-10-21', -27.62, 'BOOKSHOP NY'), synced(OTP, '2026-10-22', -43.17, 'INA ILICA'), synced(OTP, '2026-10-22', -100, 'INA ILICA')]),
      DAY,
    )

    expect(run.changed.map(({ after, items }) => [after.amount, items?.map((item) => [item.amount, item.category, item.labels])])).toEqual([
      [accountMoneyFromAmount(-27.62), [[accountMoneyFromAmount(-27.62), TRAVEL, [VIENNA]]]],
      [accountMoneyFromAmount(-100), [[accountMoneyFromAmount(-100), TRAVEL, [VIENNA]]]],
    ])
    expect(run.added.map((entry) => entry.amount)).toEqual([accountMoneyFromAmount(-43.17)])
  })

  it('takes a hold of another amount from the same payee inside the window, and leaves it gone for another payee or outside the window', () => {
    const fuel = waiting(OTP, '2026-10-20', -100, 'INA ILICA')
    const later = statementDryRun(spendingBook([fuel]), syncOf([synced(OTP, '2026-10-22', -43.17, 'INA ILICA')]), DAY)
    const elsewhere = statementDryRun(spendingBook([fuel]), syncOf([synced(OTP, '2026-10-22', -43.17, 'PETROL')]), DAY)
    const tooLate = statementDryRun(spendingBook([fuel]), syncOf([synced(OTP, '2026-10-28', -43.17, 'INA ILICA')]), DAY)

    expect(later.changed.map(({ after }) => after.amount)).toEqual([accountMoneyFromAmount(-43.17)])
    expect([elsewhere, tooLate].map((run) => [run.pending?.booked, run.pending?.gone])).toEqual([
      [0, [fuel]],
      [0, [fuel]],
    ])
  })

  it('gives a split a Difference part in its first part’s category when it books higher', () => {
    const hotel = waiting(OTP, '2026-10-20', -200, 'HOTEL ESPLANADE')
    const parts: TransactionItem[] = [
      { ...filedItem(hotel), id: recordIdOf(ITEM_RECORDS, 'lodging'), amount: accountMoneyFromAmount(-170) },
      { ...filedItem(hotel), id: recordIdOf(ITEM_RECORDS, 'breakfast'), amount: accountMoneyFromAmount(-30), category: category('Food/Eating out').id },
    ]
    const run = statementDryRun(spendingBook([hotel], { items: parts }), syncOf([synced(OTP, '2026-10-22', -212.4, 'HOTEL ESPLANADE')]), DAY)

    expect(itemsAfter(run, hotel)?.map((item) => [item.amount, item.category])).toEqual([
      [accountMoneyFromAmount(-170), TRAVEL],
      [accountMoneyFromAmount(-30), category('Food/Eating out').id],
      [accountMoneyFromAmount(-12.4), TRAVEL],
    ])
  })

  it('leaves the receiving leg alone until the bank books the sending leg it did not list, then pairs the two', () => {
    const received = row(REVOLUT_EUR, '2026-10-21', 45, null, { source: 'statement', payee: 'Transfer from OTP', importKey: 'bank-rev-1', statement: 'Enable Banking' })
    const sent = synced(OTP, '2026-10-22', -45, 'Transfer to Revolut', { counterpartyIban: REVOLUT_EUR.iban })
    const run = statementDryRun(spendingBook([received]), syncOf([sent]), DAY)

    expect(run.added.map((entry) => entry.pair)).toEqual([received.id])
    expect(run.changed.map(({ before, after }) => [before.id, after.pair !== null])).toEqual([[received.id, true]])
  })

  it('comes in like any row when the bank sends it first, and is left out with a note when it looks like a row from a file', () => {
    const fromFile = row(OTP, '2026-10-20', -64.2, 'Travel/Accommodation', { source: 'statement', payee: 'HOTEL ESPLANADE', description: 'HOTEL ESPLANADE', importKey: 'file-1' })
    const fresh = statementDryRun(spendingBook([]), syncOf([synced(OTP, '2026-10-25', -5, 'BAKERY', { pending: true })]), DAY)
    const alike = statementDryRun(spendingBook([fromFile]), syncOf([synced(OTP, '2026-10-21', -64.2, 'HOTEL ESPLANADE', { pending: true })]), DAY)

    expect(fresh.added.map((entry) => [entry.payee, entry.pending])).toEqual([['BAKERY', true]])
    expect(alike).toMatchObject({ added: [], held: [], questions: [] })
    expect(alike.notes).toEqual(['1 payment the bank has not booked yet looks like a row Kuna has, so it is left out until it books.'])
  })
})
