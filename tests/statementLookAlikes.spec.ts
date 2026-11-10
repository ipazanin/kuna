import { describe, expect, it } from 'vitest'

import { statementDryRun } from '../src/apps/spending/statements/domain/statementDryRun'
import { transcribedImportKeys } from '../src/apps/spending/statements/domain/statementRows'
import type { StatementRow, StatementRows } from '../src/apps/spending/statements/domain/statementRows'
import type { SpendingBook } from '../src/apps/spending/workbook/domain/readSpendingBook'
import { spendingSettingsOf } from '../src/apps/spending/workbook/domain/spendingSettings'
import type { Transaction } from '../src/apps/spending/workbook/domain/transaction'
import { accountMoneyFromAmount } from '../src/shared/money/accountMoney'
import type { LookAlikes } from '../src/shared/money/lookAlikeBookings'
import { ACCOUNTS, CATEGORIES, OTP, REVOLUT_EUR, row } from './fixtures/spending'
import { civil } from './fixtures/ledger'

const DAY = civil('2026-11-04')

function bookOf(transactions: readonly Transaction[]): SpendingBook {
  return {
    accounts: ACCOUNTS,
    categories: CATEGORIES,
    transactions,
    budgets: [],
    rules: [],
    receipts: [],
    lines: [],
    settings: spendingSettingsOf([]),
    readings: {} as SpendingBook['readings'],
    problems: [],
  }
}

/** Rows of a Revolut export already on the file. */
const REVOLUT_ROWS: readonly Transaction[] = [
  row(REVOLUT_EUR, '2026-10-12', -45.3, null, { payee: 'Konzum', source: 'statement', importKey: '0123456789abcdef-1', statement: 'revolut.csv' }),
  row(REVOLUT_EUR, '2026-10-14', -12.5, null, { payee: 'Corner market', source: 'statement', importKey: '0123456789abcdef-2', statement: 'revolut.csv' }),
  row(REVOLUT_EUR, '2026-10-20', -30, null, { payee: 'Pharmacy', source: 'statement', importKey: '0123456789abcdef-3', statement: 'revolut.csv' }),
]

/** Rows the bank sync brought to the OTP account. */
const SYNC_ROWS: readonly Transaction[] = [
  row(OTP, '2026-10-12', -45.3, null, { payee: 'KONZUM PLUS D.O.O.', source: 'statement', importKey: 'bank-ref-1', statement: 'Bank sync' }),
  row(OTP, '2026-10-15', -20, null, { payee: 'BAKERY 22', source: 'statement', importKey: 'bank-ref-2', statement: 'Bank sync' }),
]

/** A statement the AI copied onto the account, each row given as its day, amount and payee. */
function copied(on: StatementRow['account'], rows: readonly (readonly [string, number, string])[], lookAlikes: LookAlikes = 'ask'): StatementRows {
  const dated = rows.map(([date, amount, payee]) => ({ account: on, date: civil(date), amount: accountMoneyFromAmount(amount), payee }))
  const keys = transcribedImportKeys(dated)
  return {
    label: 'Copied statement',
    notes: [],
    transcribed: { lookAlikes },
    rows: dated.map((fields, at) => ({ ...fields, category: null, description: '', counterpartyIban: '', importKey: keys[at]!, movedAt: '', pocket: false })),
  }
}

const outcomes = (book: SpendingBook, statement: StatementRows) => statementDryRun(book, statement, DAY).lines.map((line) => line.outcome)

describe('a copied statement over a Revolut export', () => {
  it('skips the rows of the same day, amount and payee, holds the look-alikes and adds the rest', () => {
    const statement = copied(REVOLUT_EUR.id, [
      ['2026-10-12', -45.3, 'KONZUM'],
      ['2026-10-15', -12.5, 'Corner market Zagreb'],
      ['2026-10-18', -8, 'Kiosk'],
    ])
    const run = statementDryRun(bookOf(REVOLUT_ROWS), statement, DAY)
    expect(run.lines.map((line) => line.outcome)).toEqual(['already-in', 'look-alike', 'new'])
    expect(run.lines[1]).toMatchObject({ outcome: 'look-alike', like: REVOLUT_ROWS[1] })
    expect(run.added.map((added) => added.payee)).toEqual(['Kiosk'])
    expect(run.alreadyIn).toBe(1)
  })

  it('adds a look-alike once the person says it is another payment, and still skips the same row', () => {
    const statement = copied(
      REVOLUT_EUR.id,
      [
        ['2026-10-12', -45.3, 'Konzum'],
        ['2026-10-15', -12.5, 'Corner market'],
      ],
      'import',
    )
    expect(outcomes(bookOf(REVOLUT_ROWS), statement)).toEqual(['already-in', 'new'])
  })

  it.each([
    ['four days apart', ['2026-10-24', -30, 'Pharmacy'] as const],
    ['a cent off', ['2026-10-20', -30.01, 'Pharmacy'] as const],
    ['money in against money out', ['2026-10-20', 30, 'Pharmacy'] as const],
    ['another payee', ['2026-10-20', -30, 'Bookshop'] as const],
  ])('adds a row %s as new', (_, near) => {
    expect(outcomes(bookOf(REVOLUT_ROWS), copied(REVOLUT_EUR.id, [near]))).toEqual(['new'])
  })

  it('leaves a parsed Revolut export as it was, matching by key alone', () => {
    const { transcribed: _, ...parsed } = copied(REVOLUT_EUR.id, [['2026-10-12', -45.3, 'Konzum']])
    expect(outcomes(bookOf(REVOLUT_ROWS), parsed)).toEqual(['new'])
  })
})

describe('a copied statement over the bank sync', () => {
  it('matches the rows on the days the sync covers instead of leaving them out', () => {
    const statement = copied(OTP.id, [
      ['2026-10-12', -45.3, 'Konzum plus d.o.o.'],
      ['2026-10-16', -20, 'Bakery'],
      ['2026-10-17', -5, 'Parking'],
    ])
    expect(outcomes(bookOf(SYNC_ROWS), statement)).toEqual(['already-in', 'look-alike', 'new'])
  })

  it('still leaves out a parsed file’s rows on the days the sync covers', () => {
    const { transcribed: _, ...parsed } = copied(OTP.id, [['2026-10-17', -5, 'Parking']])
    expect(outcomes(bookOf(SYNC_ROWS), parsed)).toEqual(['other-source'])
  })
})

describe('a copied statement over typed rows', () => {
  it('fills the typed row of the same money, as a bank row does, and holds nothing', () => {
    const typed = row(OTP, '2026-10-12', -45.3, 'Home/Rent', { payee: 'Konzum', categorisedBy: 'person' })
    const run = statementDryRun(bookOf([typed]), copied(OTP.id, [['2026-10-13', -45.3, 'KONZUM PLUS']]), DAY)
    expect(run.lines.map((line) => line.outcome)).toEqual(['filled'])
    expect(run.changed).toMatchObject([{ before: typed, after: { id: typed.id, date: civil('2026-10-13') } }])
  })
})

describe('a copied statement over another copied one', () => {
  it('matches the rows another copied statement brought, but never the rows of its own other parts', () => {
    const earlier = row(OTP, '2026-10-12', -45.3, null, { payee: 'Konzum', source: 'statement', importKey: 'read-other', statement: 'Photo of October' })
    const ownPart = row(OTP, '2026-10-14', -3, null, { payee: 'Coffee', source: 'statement', importKey: 'read-part-1', statement: 'Copied statement' })
    const statement = copied(OTP.id, [
      ['2026-10-12', -45.3, 'Konzum'],
      ['2026-10-15', -3, 'Coffee'],
    ])
    expect(outcomes(bookOf([earlier, ownPart]), statement)).toEqual(['already-in', 'new'])
  })
})

describe('a parsed export over rows the AI copied', () => {
  const COPIED_ROWS: readonly Transaction[] = [
    row(REVOLUT_EUR, '2026-10-12', -45.3, null, { payee: 'Konzum', source: 'statement', importKey: 'read-a', statement: 'Copied October' }),
    row(REVOLUT_EUR, '2026-10-14', -12.5, null, { payee: 'Corner market', source: 'statement', importKey: 'read-b', statement: 'Copied October' }),
    row(REVOLUT_EUR, '2026-10-20', -30, null, { payee: 'Pharmacy', source: 'statement', importKey: 'read-c', statement: 'Copied October' }),
  ]

  /** The export as Revolut's reader hands it over, with keys of its own. */
  function parsed(rows: readonly (readonly [string, number, string])[]): StatementRows {
    const { transcribed: _, ...statement } = copied(REVOLUT_EUR.id, rows)
    return { ...statement, label: 'revolut.csv', rows: statement.rows.map((fields, at) => ({ ...fields, importKey: `0123456789abcdef-${at}` })) }
  }

  it('skips the same row, leaves a look-alike out with a note, and adds the rest', () => {
    const run = statementDryRun(
      bookOf(COPIED_ROWS),
      parsed([
        ['2026-10-12', -45.3, 'KONZUM'],
        ['2026-10-16', -12.5, 'Corner market Zagreb'],
        ['2026-10-18', -8, 'Kiosk'],
      ]),
      DAY,
    )
    expect(run.lines.map((line) => line.outcome)).toEqual(['already-in', 'look-alike', 'new'])
    expect(run.added.map((added) => added.payee)).toEqual(['Kiosk'])
    expect(run.notes).toEqual([
      "1 row left out, since it looks like a row the AI copied, with the same amount and at most 3 days apart. Delete the copied row first if the file's row should take its place.",
    ])
  })

  it.each([
    ['four days apart', ['2026-10-24', -30, 'Pharmacy'] as const],
    ['a cent off', ['2026-10-20', -30.01, 'Pharmacy'] as const],
    ['another payee', ['2026-10-20', -30, 'Bookshop'] as const],
  ])('adds a row %s as new', (_, near) => {
    const run = statementDryRun(bookOf(COPIED_ROWS), parsed([near]), DAY)
    expect(run.lines.map((line) => line.outcome)).toEqual(['new'])
    expect(run.notes).toEqual([])
  })

  it('matches a file only against copied rows, never against another file', () => {
    expect(outcomes(bookOf(REVOLUT_ROWS), parsed([['2026-10-12', -45.3, 'Konzum']]))).toEqual(['new'])
  })
})
