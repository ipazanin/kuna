import { describe, expect, it } from 'vitest'

import { codecOfSpendingKind } from '../src/apps/spending/workbook/application/spendingCodecs'
import { ACCOUNT_RECORDS, BUDGET_RECORDS, CATEGORY_RECORDS, TRANSACTION_RECORDS } from '../src/apps/spending/workbook/domain/spendingKinds'
import { SPENDING_APP, SPENDING_DOCUMENT } from '../src/apps/spending/workbook/infrastructure/spendingDocument'
import type { DocumentRecord } from '../src/shared/storage/infrastructure/documentFormat'
import { newDocument } from '../src/shared/storage/infrastructure/documentRecordStorage'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import type { RecordKind } from '../src/shared/storage/domain/recordKind'
import type { RecordFields } from '../src/shared/storage/domain/recordFields'
import { storedFieldsOfValues } from '../src/shared/storage/domain/storedFields'
import { euros } from './fixtures/ledger'

const uuid = (place: number): string => `5e000000-0000-4000-8000-${String(place).padStart(12, '0')}`

const [OTP, REVOLUT_EUR, REVOLUT_USD, CASH] = [uuid(1), uuid(2), uuid(3), uuid(4)]
const [FOOD, GROCERIES, RESTAURANTS, INCOME, SALARY, BETWEEN, SAVED, COMPANY] = [uuid(11), uuid(12), uuid(13), uuid(14), uuid(15), uuid(16), uuid(17), uuid(18)]

const ACCOUNTS: readonly RecordFields[] = [
  { id: OTP, name: 'OTP current', kind: 'bank', bank: 'otp', currency: 'EUR', opening: '1000.00', opened_on: '2026-09-01', iban: 'HR0000000000000000001' },
  { id: REVOLUT_EUR, name: 'Revolut EUR', kind: 'bank', bank: 'revolut', currency: 'EUR', opened_on: '2026-09-01', iban: 'LT000000000000000001' },
  { id: REVOLUT_USD, name: 'Revolut USD', kind: 'bank', bank: 'revolut', currency: 'USD', opened_on: '2026-09-01', iban: 'LT000000000000000001' },
  { id: CASH, name: 'Cash', kind: 'cash', currency: 'EUR', opening: '64.00', opened_on: '2026-09-01' },
]

const CATEGORIES: readonly RecordFields[] = [
  { id: FOOD, name: 'Food', kind: 'spending', order: '1' },
  { id: GROCERIES, name: 'Groceries', kind: 'spending', parent: FOOD, order: '1' },
  { id: RESTAURANTS, name: 'Restaurants', kind: 'spending', parent: FOOD, order: '2' },
  { id: INCOME, name: 'Income', kind: 'income', order: '12' },
  { id: SALARY, name: 'Salary', kind: 'income', parent: INCOME, order: '1' },
  { id: BETWEEN, name: 'Between my accounts', kind: 'transfer', order: '13' },
  { id: SAVED, name: 'Saved to investments', kind: 'saving', order: '14' },
  { id: COMPANY, name: 'For the company', kind: 'company', order: '15' },
]

type Records = Partial<Record<'account' | 'category' | 'transaction' | 'budget', readonly DocumentRecord[]>>

function bookOf(records: Records) {
  const document = newDocument(SPENDING_APP, { spending: 1 }, records, '2026-11-04T09:00:00.000Z')
  return SPENDING_DOCUMENT.read({
    meta: { id: 'local', source: 'browser', title: 'kuna-spending.json', syncedAt: '2026-11-04T09:00:00.000Z', lastExportedAt: null, unexportedSince: null },
    revision: '1',
    document,
  }).workbook
}

/** Each problem as its kind, the record's label and the reason. */
function problemsOf(records: Records): [string, string, string][] {
  return bookOf(records).problems.map((problem) => [problem.kind, problem.label, problem.reason])
}

function roundTrip<R>(kind: RecordKind<R>, fields: RecordFields): RecordFields {
  const codec = codecOfSpendingKind(kind)
  return codec.fieldsOf(codec.make(storedFieldsOfValues(fields), recordIdOf(kind, String(fields.id))))
}

function entry(id: number, fields: RecordFields): RecordFields {
  return { id: uuid(id), account: OTP, date: '2026-10-12', amount: '-45.30', payee: 'Corner market', category: GROCERIES, source: 'typed', ...fields }
}

/** The entry with its category left blank, as a row waiting on review. */
function unreviewed(id: number, fields: RecordFields): RecordFields {
  return Object.fromEntries(Object.entries(entry(id, fields)).filter(([field]) => field !== 'category'))
}

describe('the Spending file', () => {
  it('writes every kind back field for field as it read it', () => {
    const kinds: [RecordKind<unknown>, RecordFields][] = [
      [ACCOUNT_RECORDS, { ...ACCOUNTS[0]!, closed: true }],
      [ACCOUNT_RECORDS, ACCOUNTS[3]!],
      [CATEGORY_RECORDS, { ...CATEGORIES[1]!, colour: '#d4e8ff', hidden: true }],
      [CATEGORY_RECORDS, CATEGORIES[5]!],
      [TRANSACTION_RECORDS, entry(101, { note: 'Weekly shop' })],
      [TRANSACTION_RECORDS, entry(102, { amount: '200.00', payee: 'Top-up', category: BETWEEN, source: 'statement', pair: uuid(103) })],
      [TRANSACTION_RECORDS, unreviewed(104, { source: 'receipt' })],
      [BUDGET_RECORDS, { id: uuid(201), category: FOOD, from: '2026-09', amount: '400.00' }],
      [BUDGET_RECORDS, { id: uuid(202), category: FOOD, from: '2026-12', amount: '0.00' }],
    ]

    for (const [kind, fields] of kinds) {
      expect(roundTrip(kind, fields)).toEqual(fields)
    }
  })

  it('reads accounts, categories, entries oldest first and limits, with the IBAN in capitals without spaces', () => {
    const book = bookOf({
      account: [{ ...ACCOUNTS[0]!, iban: 'hr00 0000 0000 0000 0000 1' }],
      category: [...CATEGORIES],
      transaction: [entry(102, { date: '2026-10-20' }), entry(101, { date: '2026-10-05', amount: '2400.00', payee: 'Example Studio d.o.o.', category: SALARY })],
      budget: [{ id: uuid(201), category: FOOD, from: '2026-09', amount: '400.00' }],
    })

    expect(book.problems).toEqual([])
    expect(book.accounts).toMatchObject([
      { id: recordIdOf(ACCOUNT_RECORDS, OTP), kind: 'bank', bank: 'otp', currency: 'EUR', opening: euros(1_000), openedOn: '2026-09-01', iban: 'HR0000000000000000001', closed: false },
    ])
    expect(book.categories.map((category) => [category.name, category.kind, category.parent])).toEqual([
      ['Food', 'spending', null],
      ['Groceries', 'spending', recordIdOf(CATEGORY_RECORDS, FOOD)],
      ['Restaurants', 'spending', recordIdOf(CATEGORY_RECORDS, FOOD)],
      ['Income', 'income', null],
      ['Salary', 'income', recordIdOf(CATEGORY_RECORDS, INCOME)],
      ['Between my accounts', 'transfer', null],
      ['Saved to investments', 'saving', null],
      ['For the company', 'company', null],
    ])
    expect(book.transactions.map((transaction) => [transaction.date, transaction.amount])).toEqual([
      ['2026-10-05', euros(2_400)],
      ['2026-10-20', euros(-45.3)],
    ])
    expect(book.budgets).toMatchObject([{ category: recordIdOf(CATEGORY_RECORDS, FOOD), from: '2026-09', amount: euros(400) }])
  })

  it('reads a cash account with no bank and no IBAN, and an opening left blank as zero', () => {
    const book = bookOf({ account: [{ id: CASH, name: 'Cash', kind: 'cash', currency: 'eur', opened_on: '2026-09-01' }] })

    expect(book.problems).toEqual([])
    expect(book.accounts).toMatchObject([{ bank: null, currency: 'EUR', opening: euros(0), iban: '' }])
  })
})

describe('problems in the Spending file, listed by kind', () => {
  it('refuses an account without a name, a kind, a known currency or the day it opened, and a bank or an IBAN on cash', () => {
    expect(
      problemsOf({
        account: [
          { ...ACCOUNTS[0]!, id: uuid(5), name: '' },
          { ...ACCOUNTS[0]!, id: uuid(6), name: 'Piggy bank', kind: 'jar' },
          { ...ACCOUNTS[0]!, id: uuid(7), name: 'No currency', currency: '' },
          { ...ACCOUNTS[0]!, id: uuid(8), name: 'Play money', currency: 'XYZ' },
          { ...ACCOUNTS[0]!, id: uuid(9), name: 'Undated', opened_on: '' },
          { ...ACCOUNTS[3]!, id: uuid(10), name: 'Wallet', iban: 'HR0000000000000000009' },
          { ...ACCOUNTS[3]!, id: uuid(19), name: 'Purse', bank: 'otp' },
        ],
      }),
    ).toEqual([
      ['account', 'unnamed', 'no name'],
      ['account', 'Piggy bank', '"jar" is not a kind of account. Use bank, cash, savings'],
      ['account', 'No currency', 'no currency'],
      ['account', 'Play money', 'currency "XYZ" is not a currency code such as EUR or USD'],
      ['account', 'Undated', 'no opened_on date'],
      ['account', 'Wallet', 'iban is for a bank or savings account, not cash'],
      ['account', 'Purse', 'bank is for a bank or savings account, not cash'],
    ])
  })

  it('counts two accounts with one IBAN and currency but doubts both, while one IBAN in two currencies is a card that holds both', () => {
    const book = bookOf({ account: [...ACCOUNTS, { ...ACCOUNTS[1]!, id: uuid(5), name: 'Revolut EUR again', iban: 'lt00 0000 0000 0000 0001' }] })

    expect(book.accounts.map((account) => account.name)).toEqual(['OTP current', 'Revolut EUR', 'Revolut USD', 'Cash', 'Revolut EUR again'])
    expect(book.problems.map((problem) => [problem.kind, problem.label, problem.reason])).toEqual([
      ['account', 'Revolut EUR', 'another account in EUR has the IBAN LT000000000000000001 too'],
      ['account', 'Revolut EUR again', 'another account in EUR has the IBAN LT000000000000000001 too'],
    ])
  })

  it('leaves out a child under a child, a child of a group of another kind or of a group not in the file, and refuses a fixed category with a parent', () => {
    expect(
      problemsOf({
        category: [
          ...CATEGORIES,
          { id: uuid(20), name: 'Organic', kind: 'spending', parent: GROCERIES },
          { id: uuid(21), name: 'Bonus', kind: 'income', parent: FOOD },
          { id: uuid(22), name: 'Orphan', kind: 'spending', parent: uuid(99) },
          { id: uuid(23), name: 'Broker', kind: 'saving', parent: FOOD },
        ],
      }),
    ).toEqual([
      ['category', 'Broker', 'a fixed category has no parent'],
      ['category', 'Organic', 'names a parent that is itself a child. Categories go two levels deep'],
      ['category', 'Bonus', 'names a parent of another kind'],
      ['category', 'Orphan', 'names a parent that is not in the file'],
    ])
  })

  it('counts a second category of a fixed kind but doubts both, since each fixed kind is one category', () => {
    const book = bookOf({ category: [...CATEGORIES, { id: uuid(20), name: 'Broker transfers', kind: 'saving' }] })

    expect(book.categories.filter((category) => category.kind === 'saving').map((category) => category.name)).toEqual(['Saved to investments', 'Broker transfers'])
    expect(book.problems.map((problem) => [problem.label, problem.reason])).toEqual([
      ['Saved to investments', 'another category is of kind saving too. Each of transfer, saving and company is one category'],
      ['Broker transfers', 'another category is of kind saving too. Each of transfer, saving and company is one category'],
    ])
  })

  it('refuses an entry of zero, and leaves out one naming no account or category that counts, while a blank category waits on review and counts', () => {
    const book = bookOf({
      account: [...ACCOUNTS, { ...ACCOUNTS[3]!, id: uuid(5), name: 'Wallet', iban: 'HR0000000000000000009' }],
      category: [...CATEGORIES, { id: uuid(20), name: 'Organic', kind: 'spending', parent: GROCERIES }],
      transaction: [
        entry(101, { amount: '0.00', payee: 'Nothing' }),
        entry(102, { account: uuid(98), payee: 'Lost account' }),
        entry(103, { account: uuid(5), payee: 'Refused account' }),
        entry(104, { category: uuid(99), payee: 'Lost category' }),
        entry(105, { category: uuid(20), payee: 'Too deep' }),
        unreviewed(106, { payee: 'Waits on review' }),
      ],
    })

    expect(book.problems.filter((problem) => problem.kind === 'transaction').map((problem) => [problem.label, problem.reason])).toEqual([
      ['2026-10-12, 0, Nothing', 'amount is zero'],
      ['2026-10-12, -45.3, Lost account', 'names no account in the file'],
      ['2026-10-12, -45.3, Refused account', 'names no account in the file'],
      ['2026-10-12, -45.3, Lost category', 'names no category in the file'],
      ['2026-10-12, -45.3, Too deep', 'names no category in the file'],
    ])
    expect(book.transactions.map((transaction) => [transaction.payee, transaction.category])).toEqual([['Waits on review', null]])
  })

  it('reads a transfer whose legs name each other from two accounts, and leaves out a leg not named back or on the same account', () => {
    const transfer = (out: number, into: number, intoAccount: string, payee: string): RecordFields[] => [
      entry(out, { amount: '-200.00', payee, category: BETWEEN, pair: uuid(into) }),
      entry(into, { account: intoAccount, amount: '200.00', payee, category: BETWEEN, pair: uuid(out) }),
    ]
    const book = bookOf({
      account: [...ACCOUNTS],
      category: [...CATEGORIES],
      transaction: [
        ...transfer(101, 102, REVOLUT_EUR, 'Top-up'),
        ...transfer(103, 104, OTP, 'Same account'),
        entry(105, { amount: '-50.00', payee: 'Not named back', category: BETWEEN, pair: uuid(101) }),
        entry(106, { amount: '-50.00', payee: 'Missing leg', category: BETWEEN, pair: uuid(99) }),
      ],
    })

    expect(book.transactions.map((transaction) => transaction.payee)).toEqual(['Top-up', 'Top-up'])
    expect(book.problems.map((problem) => [problem.label, problem.reason])).toEqual([
      ['2026-10-12, -200, Same account', 'names as its other leg a row on the same account'],
      ['2026-10-12, 200, Same account', 'names as its other leg a row on the same account'],
      ['2026-10-12, -50, Not named back', 'names as its other leg a row that does not name it back'],
      ['2026-10-12, -50, Missing leg', 'names as its other leg a row that does not name it back'],
    ])
  })

  it('leaves out a limit on an income category or on none, refuses one below zero or without a month, and two limits of one category in one month', () => {
    expect(
      problemsOf({
        category: [...CATEGORIES],
        budget: [
          { id: uuid(201), category: SALARY, from: '2026-09', amount: '100.00' },
          { id: uuid(202), category: uuid(99), from: '2026-09', amount: '100.00' },
          { id: uuid(203), category: FOOD, from: '2026-09', amount: '-1.00' },
          { id: uuid(204), category: FOOD, from: 'September', amount: '400.00' },
          { id: uuid(205), category: RESTAURANTS, from: '2026-10', amount: '150.00' },
          { id: uuid(206), category: RESTAURANTS, from: '2026-10', amount: '120.00' },
        ],
      }),
    ).toEqual([
      ['budget', '2026-09, -1', 'amount is below zero'],
      ['budget', 'September, 400', 'from "September" is not a month such as 2026-11'],
      ['budget', '2026-09, 100', 'is on a category that is not spending, which no limit counts'],
      ['budget', '2026-09, 100', 'names no category in the file'],
      ['budget', '2026-10, 150', 'another limit of the category starts in 2026-10 too'],
      ['budget', '2026-10, 120', 'another limit of the category starts in 2026-10 too'],
    ])
  })

  it('leaves out a limit on a group and on its child in the same months', () => {
    expect(
      problemsOf({
        category: [...CATEGORIES],
        budget: [
          { id: uuid(201), category: FOOD, from: '2026-09', amount: '400.00' },
          { id: uuid(202), category: GROCERIES, from: '2027-01', amount: '250.00' },
        ],
      }),
    ).toEqual([
      ['budget', '2026-09, 400', 'is on a group and on one of its children in the same months, so no euro counts against two limits'],
      ['budget', '2027-01, 250', 'is on a group and on one of its children in the same months, so no euro counts against two limits'],
    ])
  })

  it("reads a limit on a group, then one on its child from the month a budget of zero ended the group's", () => {
    const book = bookOf({
      category: [...CATEGORIES],
      budget: [
        { id: uuid(201), category: FOOD, from: '2026-09', amount: '400.00' },
        { id: uuid(202), category: FOOD, from: '2026-11', amount: '0.00' },
        { id: uuid(203), category: GROCERIES, from: '2026-11', amount: '250.00' },
      ],
    })

    expect(book.problems).toEqual([])
    expect(book.budgets).toHaveLength(3)
  })

  it('lists the problems of every kind in the order of the kinds', () => {
    const problems = problemsOf({
      budget: [{ id: uuid(201), category: FOOD, from: '2026-09', amount: '400.00' }],
      transaction: [entry(101, {})],
      category: [{ id: uuid(20), name: 'Orphan', kind: 'spending', parent: uuid(99) }],
      account: [{ ...ACCOUNTS[0]!, name: '' }],
    })

    expect(problems.map(([kind]) => kind)).toEqual(['account', 'category', 'transaction', 'budget'])
  })
})
