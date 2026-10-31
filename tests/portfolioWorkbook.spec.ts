import 'fake-indexeddb/auto'
import * as XLSX from 'xlsx'
import { afterEach, describe, expect, it } from 'vitest'

import { accountCash } from '../src/apps/investments/holdings/domain/accountCash'
import { readPortfolioWorkbookFile } from '../src/apps/investments/imports/application/portfolioWorkbookFile'
import { writeWorkbookImport } from '../src/apps/investments/imports/application/workbookImport'
import { goneFromWorkbook } from '../src/apps/investments/imports/domain/editedRecords'
import { NO_ANSWERS, proposedCostShare, workbookDryRun } from '../src/apps/investments/imports/domain/importDryRun'
import type { DryRunEntry, ImportedRecord, WorkbookAnswers, WorkbookDryRun, WorkbookRows } from '../src/apps/investments/imports/domain/importDryRun'
import { WORKBOOK_TYPES, readPortfolioWorkbook } from '../src/apps/investments/imports/domain/portfolioWorkbook'
import { words } from '../src/apps/investments/imports/domain/words'
import { transactionCount } from '../src/apps/investments/transactions/domain/listedTransactions'
import type { InvestmentBook } from '../src/apps/investments/workbook/domain/investmentBook'
import { words as recordWords } from '../src/apps/investments/workbook/domain/words'
import { emptyInvestmentsDocument } from '../src/apps/investments/workbook/infrastructure/investmentsDocument'
import { serialFromCivilDate } from '../src/shared/calendar/civilDate'
import { EURO } from '../src/shared/money/currencyCode'
import { decimalText } from '../src/shared/money/decimal'
import { USD, account, book, decimal, instrument, rateBookOf } from './fixtures/investments'
import { civil } from './fixtures/ledger'
import { INVESTMENTS, browserHarness, forgetCaches } from './fixtures/writeBack'

const used = new Set<string>()

afterEach(async () => {
  await forgetCaches(used)
})

/** The Transactions tab's columns, with the split-adjusted ones the import does not read and a comment column of the owner's. */
const HEADER = [
  'Date',
  'Time',
  'Broker',
  'Account',
  'Type',
  'Symbol (Yahoo)',
  'Broker symbol',
  'ISIN',
  'Quantity (as executed)',
  'Price (as executed)',
  'Quantity (split-adjusted)',
  'Price (split-adjusted)',
  'Split factor',
  'Currency',
  'Gross amount',
  'Commission',
  'Net cash',
  'FX counter currency',
  'FX counter amount',
  'Revolut FX rate',
  'Note',
  'Source file',
  'Comment',
] as const

type Cells = Partial<Record<(typeof HEADER)[number], string | number>>

/** A row with its date as the serial number a spreadsheet keeps, or as text when it is not a date. */
function line(date: string, cells: Cells): (string | number)[] {
  return HEADER.map((column) => (column === 'Date' ? (/^\d{4}-\d{2}-\d{2}$/.test(date) ? serialFromCivilDate(civil(date)) : date) : (cells[column] ?? '')))
}

const IBKR = { Broker: 'IBKR', 'Source file': 'activity-2025.csv' } as const
const MAIN = { ...IBKR, Account: 'U0000001' } as const
const SECOND = { ...IBKR, Account: 'U0000002' } as const
const REVOLUT = { Broker: 'Revolut', Account: 'RVL-1', 'Source file': 'trading-statement.csv' } as const
const ABC = { 'Symbol (Yahoo)': 'ABC', 'Broker symbol': 'ABC', ISIN: 'US0000000001' } as const
const DIVIDEND_NOTE = 'ABC(US0000000001) Cash Dividend USD 0.17 per Share'

/**
 * A made-up portfolio workbook of three accounts at two brokers with every one of the seventeen kinds of row, laid
 * out under a title row, with a blank row, noisy number cells, two equal rows and three rows that cannot be read.
 * The spreadsheet row of each line is in its comment.
 */
const TRANSACTIONS: (string | number)[][] = [
  ['Portfolio transactions, made up'],
  [...HEADER],
  line('2025-01-02', { ...MAIN, Type: 'DEPOSIT', Currency: 'EUR', 'Net cash': 5000, Note: 'Electronic fund transfer', Comment: 'row 3' }),
  line('2025-01-03', { ...MAIN, Type: 'FX', Currency: 'EUR', Commission: 2, 'Net cash': -1002, 'FX counter currency': 'USD', 'FX counter amount': 1100, Comment: 'row 4' }),
  line('2025-01-06', {
    ...MAIN,
    ...ABC,
    Time: 0.4375,
    Type: 'BUY',
    'Quantity (as executed)': 10,
    'Price (as executed)': 50.250000000000004,
    'Quantity (split-adjusted)': 20,
    'Price (split-adjusted)': 25.125,
    'Split factor': 2,
    Currency: 'USD',
    'Gross amount': -502.5,
    Commission: 1,
    'Net cash': -503.5,
    Comment: 'row 5',
  }),
  line('2025-02-03', {
    ...MAIN,
    ...ABC,
    Time: '15:02:11',
    Type: 'BUY',
    'Quantity (as executed)': 4.5,
    'Price (as executed)': 40,
    Currency: 'USD',
    Commission: 0.35,
    'Net cash': -181,
    Comment: 'row 6',
  }),
  line('2025-03-14', { ...MAIN, ...ABC, Type: 'DIVIDEND', Currency: 'USD', 'Gross amount': 2.5, 'Net cash': 2.5, Note: `${DIVIDEND_NOTE} (Ordinary Dividend)`, Comment: 'row 7' }),
  line('2025-03-14', { ...MAIN, ...ABC, Type: 'DIVIDEND', Currency: 'USD', 'Gross amount': 0.5, 'Net cash': 0.5, Note: 'ABC(US0000000001) Return of capital USD 0.03 per Share', Comment: 'row 8' }),
  line('2025-03-14', { ...MAIN, ...ABC, Type: 'WITHHOLDING TAX', Currency: 'USD', 'Net cash': -0.38, Note: `${DIVIDEND_NOTE} - US Tax`, Comment: 'row 9' }),
  line('2025-04-01', { ...MAIN, ...ABC, Type: 'WITHHOLDING TAX', Currency: 'USD', 'Net cash': -0.1, Note: `${DIVIDEND_NOTE} - US Tax`, Comment: 'row 10' }),
  [],
  line('2025-04-30', { ...MAIN, Type: 'INTEREST', Currency: 'EUR', 'Gross amount': 3.2, 'Net cash': 3.2, Note: 'EUR Credit Interest for Apr-2025', Comment: 'row 12' }),
  line('2025-04-30', { ...MAIN, Type: 'WITHHOLDING TAX', Currency: 'EUR', 'Net cash': -0.32, Note: 'EUR Credit Interest for Apr-2025 - Tax', Comment: 'row 13' }),
  line('2025-05-02', { ...MAIN, Type: 'FEE', Currency: 'EUR', 'Net cash': -3.005, Note: 'Market data', Comment: 'row 14' }),
  line('2025-05-05', { ...MAIN, Type: 'FEE REFUND', Currency: 'EUR', 'Net cash': 1, Note: 'Market data refund', Comment: 'row 15' }),
  line('2025-06-10', { ...MAIN, ...ABC, Type: 'SPLIT', 'Quantity (as executed)': 14.5, Note: 'ABC(US0000000001) Split 2 for 1', Comment: 'row 16' }),
  line('2025-07-01', {
    ...MAIN,
    'Symbol (Yahoo)': 'NEWCO',
    'Broker symbol': 'NEWCO',
    Type: 'SPINOFF',
    'Quantity (as executed)': 2,
    'Price (as executed)': 12,
    Currency: 'USD',
    Note: 'NEWCO spun off from ABC',
    Comment: 'row 17',
  }),
  line('2025-08-01', {
    ...MAIN,
    ...ABC,
    Type: 'SELL',
    'Quantity (as executed)': -5,
    'Price (as executed)': 30,
    Currency: 'USD',
    'Gross amount': 150,
    Commission: 1,
    'Net cash': 149,
    Comment: 'row 18',
  }),
  line('2025-08-15', { ...MAIN, Type: 'INTERNAL CASH TRANSFER', Currency: 'EUR', 'Net cash': -500, Comment: 'row 19' }),
  line('2025-08-15', { ...SECOND, Type: 'INTERNAL CASH TRANSFER', Currency: 'EUR', 'Net cash': 500, Comment: 'row 20' }),
  line('2025-09-01', { ...MAIN, ...ABC, Type: 'TRANSFER OUT', 'Quantity (as executed)': -10, Comment: 'row 21' }),
  line('2025-09-01', { ...SECOND, ...ABC, Type: 'TRANSFER IN', 'Quantity (as executed)': 10, Comment: 'row 22' }),
  line('2025-09-02', { ...SECOND, 'Symbol (Yahoo)': 'NEWCO', 'Broker symbol': 'NEWCO', Type: 'TRANSFER IN', 'Quantity (as executed)': 2, Comment: 'row 23' }),
  line('2025-10-01', { ...SECOND, Type: 'WITHDRAWAL', Currency: 'EUR', 'Net cash': -100, Comment: 'row 24' }),
  line('2025-10-06', {
    ...SECOND,
    'Symbol (Yahoo)': 'XYZ.DE',
    'Broker symbol': 'XYZ',
    ISIN: 'IE0000000002',
    Type: 'BUY',
    'Quantity (as executed)': 3,
    'Price (as executed)': 500,
    Currency: 'EUR',
    Commission: 1,
    'Net cash': -1501.0000000000002,
    Comment: 'row 25',
  }),
  line('2025-10-07', {
    ...SECOND,
    'Symbol (Yahoo)': 'XYZA.DE',
    'Broker symbol': 'XYZA',
    ISIN: 'IE0000000002',
    Type: 'BUY',
    'Quantity (as executed)': 1,
    'Price (as executed)': 510,
    Currency: 'EUR',
    Commission: 1,
    'Net cash': -511,
    Comment: 'row 26',
  }),
  line('2025-11-03', { ...REVOLUT, Type: 'DEPOSIT', Currency: 'USD', 'Net cash': 220, 'Revolut FX rate': 1.095, Comment: 'row 27' }),
  line('2025-11-04', {
    ...REVOLUT,
    'Symbol (Yahoo)': 'DEF',
    'Broker symbol': 'DEF',
    Type: 'BUY',
    'Quantity (as executed)': 2,
    'Price (as executed)': 100,
    Currency: 'USD',
    'Net cash': -200,
    Comment: 'row 28',
  }),
  line('2025-12-15', { ...REVOLUT, 'Symbol (Yahoo)': 'DEF', 'Broker symbol': 'DEF', Type: 'DIVIDEND', Currency: 'USD', 'Gross amount': 1.7, 'Net cash': 1.7, Comment: 'row 29' }),
  line('2025-12-31', { ...REVOLUT, Type: 'STOCK YIELD INCOME', Currency: 'USD', 'Gross amount': 0.12, 'Net cash': 0.12, Note: 'Stock lending income', Comment: 'row 30' }),
  line('2025-12-31', { ...REVOLUT, Type: 'WITHHOLDING TAX', Currency: 'USD', 'Net cash': -0.01, Note: 'Stock lending income - Tax', Comment: 'row 31' }),
  line('2026-01-05', { ...REVOLUT, Time: '09:00:00', Type: 'REFERRAL CREDIT', Currency: 'EUR', 'Gross amount': 10, 'Net cash': 10 }),
  line('2026-01-05', { ...REVOLUT, Time: '09:00:00', Type: 'REFERRAL CREDIT', Currency: 'EUR', 'Gross amount': 10, 'Net cash': 10 }),
  line('2026-01-10', {
    ...REVOLUT,
    'Symbol (Yahoo)': 'DEF',
    'Broker symbol': 'DEF',
    Type: 'SELL',
    'Quantity (as executed)': -5,
    'Price (as executed)': 110,
    Currency: 'USD',
    'Net cash': 550,
    Comment: 'row 34',
  }),
  line('2024-12-31', { ...MAIN, Type: 'INTEREST', Currency: 'USD', 'Gross amount': 0.5, 'Net cash': 0.5, Comment: 'row 35' }),
  line('2025-02-10', { ...MAIN, ...ABC, Type: 'CORPORATE ACTION', Comment: 'row 36' }),
  line('2025-02-11', { ...MAIN, ...ABC, Type: 'BUY', 'Quantity (as executed)': 1, Currency: 'USD', 'Net cash': -41, Comment: 'row 37' }),
  line('31.13.2025', { ...MAIN, Type: 'DEPOSIT', Currency: 'EUR', 'Net cash': 50, Comment: 'row 38' }),
]

/** The owner's working tabs, which the import never reads. */
const CHECKS: (string | number)[][] = [
  ['Check', 'Result'],
  ['Cash agrees with the statements', 'TRUE'],
]

function workbookBytes(transactions: readonly (readonly (string | number)[])[]): ArrayBuffer {
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([...CHECKS]), 'Checks')
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(transactions.map((row) => [...row])), 'Transactions')
  return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
}

async function readRows(transactions: readonly (readonly (string | number)[])[] = TRANSACTIONS): Promise<WorkbookRows> {
  const reading = await readPortfolioWorkbookFile(workbookBytes(transactions))
  if (reading.kind !== 'read') {
    throw new Error(`The workbook was refused: ${reading.refusal.kind}.`)
  }
  return reading
}

/** ECB rates from the first trading day of 2025, so a dollar row of 2024 has none yet. */
const RATES = rateBookOf(
  new Map([
    [
      USD,
      [
        ['2025-01-02', '1.04'],
        ['2025-06-02', '1.13'],
        ['2025-11-03', '1.15'],
      ],
    ],
  ]),
)

const IBKR_MAIN = account('ibkr-main', 'IBKR main')
const IBKR_SECOND = account('ibkr-second', 'IBKR second')
const REVOLUT_ACCOUNT = account('revolut', 'Revolut')
const ABC_SHARE = instrument('abc', { name: 'ABC Corp', isin: 'US0000000001', currency: USD })
const NEWCO_SHARE = instrument('newco', { name: 'NewCo', currency: USD })
const DEF_SHARE = instrument('def', { name: 'DEF Inc', currency: USD })
const XYZ_FUND = instrument('xyz', { name: 'XYZ World', isin: 'IE0000000002', prices: 'alphavantage', sourceSymbol: 'XYZ.DEX' })

function entryOf(dryRun: WorkbookDryRun, fileRow: number): DryRunEntry {
  const entry = dryRun.entries.find((candidate) => candidate.rows[0].fileRow === fileRow)
  if (entry === undefined) {
    throw new Error(`No entry starts at row ${fileRow}.`)
  }
  return entry
}

function importedAt(dryRun: WorkbookDryRun, fileRow: number): ImportedRecord {
  const outcome = entryOf(dryRun, fileRow).outcome
  if (outcome.kind !== 'new') {
    throw new Error(`Row ${fileRow} is ${outcome.kind}, not new.`)
  }
  return outcome.imported
}

function outcomesByRow(dryRun: WorkbookDryRun): Record<number, string> {
  return Object.fromEntries(dryRun.entries.map((entry) => [entry.rows[0].fileRow, entry.outcome.kind === 'waiting' ? `waiting: ${entry.outcome.reason.kind}` : entry.outcome.kind]))
}

/** Every answer the first dry run asks for, with the split and the spin-off answered as proposed. */
function fullAnswers(rows: WorkbookRows): WorkbookAnswers {
  const asked = workbookDryRun(rows, { book: book({}), rates: RATES, answers: NO_ANSWERS }).questions
  return {
    accounts: new Map([
      ['U0000001', IBKR_MAIN],
      ['U0000002', IBKR_SECOND],
      ['RVL-1', REVOLUT_ACCOUNT],
    ]),
    instruments: new Map([
      ['US0000000001', ABC_SHARE],
      ['NEWCO', NEWCO_SHARE],
      ['IE0000000002', XYZ_FUND],
      ['DEF', DEF_SHARE],
    ]),
    splits: new Map([[asked.splits[0]!.key, { newUnits: 2, oldUnits: 1 }]]),
    spinOffs: new Map([[asked.spinOffs[0]!.key, { parent: ABC_SHARE.id, costShare: decimal('0.035062089116') }]]),
  }
}

async function importedBook(): Promise<{ readonly rows: WorkbookRows; readonly answers: WorkbookAnswers; readonly dryRun: WorkbookDryRun }> {
  const rows = await readRows()
  const answers = fullAnswers(rows)
  return { rows, answers, dryRun: workbookDryRun(rows, { book: book({}), rates: RATES, answers }) }
}

describe('reading the portfolio workbook', () => {
  it('reads the Transactions tab by its headers under a title row, with serial dates and the signs the brokers booked', async () => {
    const { rows } = await readRows()
    const sale = rows.find((row) => row.fileRow === 18)!
    expect([sale.date, sale.type, decimalText(sale.quantity!), decimalText(sale.netCash!), sale.currency]).toEqual(['2025-08-01', 'SELL', '-5', '149', USD])
    expect(rows.find((row) => row.fileRow === 5)!.time).toBe('10:30:00')
    expect(rows.map((row) => row.fileRow)).not.toContain(11)
  })

  it('rounds number cells, quantities and prices to twelve places and amounts to cents, and lists the cells that moved beyond noise', async () => {
    const { rows, rounded } = await readRows()
    // 50.250000000000004 and -1501.0000000000002 are binary noise. A fee of -3.005 is a real half cent, rounded away from zero.
    expect(decimalText(rows.find((row) => row.fileRow === 5)!.price!)).toBe('50.25')
    expect(decimalText(rows.find((row) => row.fileRow === 25)!.netCash!)).toBe('-1501')
    expect(rounded.map((cell) => [cell.fileRow, cell.column, cell.cell, decimalText(cell.rounded)])).toEqual([[14, 'netCash', -3.005, '-3.01']])
  })

  it('skips a row of an unknown type or with a date it cannot read, and passes over a blank row', async () => {
    const { skipped } = await readRows()
    expect(skipped).toEqual([
      { fileRow: 36, reason: { kind: 'unknown-type', text: 'CORPORATE ACTION' } },
      { fileRow: 38, reason: { kind: 'unreadable', column: 'date', text: '31.13.2025' } },
    ])
  })

  it('reads every one of the seventeen kinds of row', async () => {
    const { rows } = await readRows()
    expect(new Set(rows.map((row) => row.type))).toEqual(new Set(WORKBOOK_TYPES))
    expect(WORKBOOK_TYPES).toHaveLength(17)
  })

  it('gives two equal rows two keys, and the same row the same key in another copy of the file', async () => {
    const first = await readRows()
    const second = await readRows()
    const [one, two] = first.rows.filter((row) => row.type === 'REFERRAL CREDIT')
    expect(one!.key).not.toBe(two!.key)
    expect(second.rows.map((row) => row.key)).toEqual(first.rows.map((row) => row.key))
  })

  it('refuses a workbook without a Transactions tab or without one of the columns it reads', () => {
    expect(readPortfolioWorkbook([{ name: 'Checks', grid: CHECKS }])).toEqual({ kind: 'refused', refusal: { kind: 'no-transactions-tab' } })
    const withoutNetCash = HEADER.filter((column) => column !== 'Net cash')
    expect(readPortfolioWorkbook([{ name: 'Transactions', grid: [withoutNetCash] }])).toEqual({ kind: 'refused', refusal: { kind: 'missing-columns', columns: ['Net cash'] } })
    expect(readPortfolioWorkbook([{ name: 'Transactions', grid: [['Portfolio transactions, made up'], withoutNetCash] }])).toEqual({
      kind: 'refused',
      refusal: { kind: 'missing-columns', columns: ['Net cash'] },
    })
  })
})

describe('the first dry run, before any answer', () => {
  it('asks once per account and per instrument, finding a fund booked under two symbols by its ISIN', async () => {
    const dryRun = workbookDryRun(await readRows(), { book: book({}), rates: RATES, answers: NO_ANSWERS })
    expect(dryRun.questions.accounts.map((question) => [question.account, question.proposedName, question.known])).toEqual([
      ['U0000001', 'IBKR', null],
      ['U0000002', 'IBKR 2', null],
      ['RVL-1', 'Revolut', null],
    ])
    expect(dryRun.questions.instruments.map((question) => question.identity)).toEqual(['US0000000001', 'NEWCO', 'IE0000000002', 'DEF'])
    const [abc, , xyz] = dryRun.questions.instruments
    expect(abc!.proposal).toEqual({
      name: 'ABC',
      class: 'stocks',
      isin: 'US0000000001',
      symbol: 'ABC',
      exchange: null,
      currency: USD,
      quoted: { kind: 'unit' },
      prices: 'twelvedata',
      sourceSymbol: 'ABC',
      note: '',
    })
    expect([xyz!.proposal.exchange, xyz!.proposal.prices, xyz!.proposal.sourceSymbol, xyz!.proposal.currency]).toEqual(['XETR', 'alphavantage', 'XYZ.DEX', EURO])
  })

  it('asks for the split and the spin-off, and holds every row until its account or instrument is named', async () => {
    const dryRun = workbookDryRun(await readRows(), { book: book({}), rates: RATES, answers: NO_ANSWERS })
    expect(dryRun.questions.splits.map((question) => [question.date, decimalText(question.added), question.held, question.proposal])).toEqual([['2025-06-10', '14.5', null, null]])
    expect(dryRun.questions.spinOffs.map((question) => [question.identity, decimalText(question.quantity), decimalText(question.worth)])).toEqual([['NEWCO', '2', '24']])
    const outcomes = outcomesByRow(dryRun)
    // A split and a spin-off name no account, so they wait for their instrument.
    expect([outcomes[16], outcomes[17]]).toEqual(['waiting: instrument', 'waiting: instrument'])
    expect(new Set(Object.values(outcomes))).toEqual(new Set(['waiting: account', 'waiting: instrument', 'waiting: no-partner']))
    expect(dryRun.added).toEqual(book({}))
  })

  it('skips a buy without its price as soon as it maps the row', async () => {
    const dryRun = workbookDryRun(await readRows(), { book: book({}), rates: RATES, answers: NO_ANSWERS })
    expect(dryRun.skipped.map((row) => [row.fileRow, row.reason.kind])).toEqual([
      [36, 'unknown-type'],
      [37, 'missing'],
      [38, 'unreadable'],
    ])
  })
})

describe('the dry run with every answer', () => {
  it('sorts the entries into new and waiting, each with its reason', async () => {
    const { dryRun } = await importedBook()
    const waiting = Object.entries(outcomesByRow(dryRun)).filter(([, outcome]) => outcome !== 'new')
    expect(waiting).toEqual([
      ['10', 'waiting: no-partner'],
      ['23', 'waiting: no-partner'],
      ['34', 'waiting: beyond-held'],
      ['35', 'waiting: no-rate'],
    ])
    expect(dryRun.entries.filter((entry) => entry.outcome.kind === 'new')).toHaveLength(23)
  })

  it('takes a trade from its executed quantity and price, its fees from the net cash, and the ECB rate of its day', async () => {
    const { dryRun } = await importedBook()
    const buy = importedAt(dryRun, 5)
    expect(buy.kind).toBe('trade')
    expect(buy.record).toMatchObject({
      account: IBKR_MAIN.id,
      instrument: ABC_SHARE.id,
      side: 'buy',
      date: '2025-01-06',
      quantity: decimal('10'),
      price: decimal('50.25'),
      fees: decimal('1'),
      rate: decimal('1.04'),
    })
    expect(importedAt(dryRun, 18).record).toMatchObject({ side: 'sell', quantity: decimal('5'), price: decimal('30'), fees: decimal('1'), rate: decimal('1.13') })
    // Row 6: 181.00 paid for 4.5 × 40.00 = 180.00 makes 1.00 of fees, against 0.35 in its Commission cell.
    expect(importedAt(dryRun, 6).record).toMatchObject({ fees: decimal('1') })
    expect(dryRun.commissionDifferences).toEqual([{ fileRow: 6, currency: USD, commission: decimal('0.35'), fees: decimal('1') }])
    // Row 28: Revolut booked no commission, and 200.00 for 2 × 100.00 leaves none.
    expect(importedAt(dryRun, 28).record).toMatchObject({ fees: decimal('0'), rate: decimal('1.15') })
  })

  it('joins each withholding row to the income whose note it repeats', async () => {
    const { dryRun } = await importedBook()
    expect(entryOf(dryRun, 7).rows.map((row) => row.fileRow)).toEqual([7, 9])
    expect(importedAt(dryRun, 7).record).toMatchObject({ kind: 'dividend', instrument: ABC_SHARE.id, gross: decimal('2.5'), withheld: decimal('0.38'), rate: decimal('1.04') })
    expect(importedAt(dryRun, 8).record).toMatchObject({ kind: 'dividend', gross: decimal('0.5'), withheld: decimal('0') })
    expect(importedAt(dryRun, 12).record).toMatchObject({ kind: 'interest', instrument: null, gross: decimal('3.2'), withheld: decimal('0.32'), rate: null })
    expect(importedAt(dryRun, 30).record).toMatchObject({ kind: 'other', gross: decimal('0.12'), withheld: decimal('0.01'), note: `${words.stockYieldIncome}. Stock lending income` })
  })

  it('imports a dividend Revolut booked net at its net with a note, never asking for the tax', async () => {
    const { dryRun } = await importedBook()
    expect(importedAt(dryRun, 29).record).toMatchObject({ gross: decimal('1.7'), withheld: decimal('0'), note: words.bookedNet })
    expect(Object.keys(dryRun.questions)).toEqual(['accounts', 'instruments', 'splits', 'spinOffs'])
  })

  it('makes two equal referral credits two income records', async () => {
    const { dryRun } = await importedBook()
    const credits = dryRun.added.income.filter((payment) => payment.note === words.referralCredit)
    expect(credits.map((payment) => decimalText(payment.gross))).toEqual(['10', '10'])
    expect(new Set(credits.map((payment) => payment.importKey)).size).toBe(2)
  })

  it('maps deposits, withdrawals, fees, refunds and exchanges, a Revolut top-up at the rate Revolut changed it at', async () => {
    const { dryRun } = await importedBook()
    expect(importedAt(dryRun, 3).record).toMatchObject({ kind: 'deposit', currency: EURO, amount: decimal('5000'), rate: null })
    expect(importedAt(dryRun, 24).record).toMatchObject({ kind: 'withdrawal', account: IBKR_SECOND.id, amount: decimal('100') })
    expect(importedAt(dryRun, 14).record).toMatchObject({ kind: 'fee', amount: decimal('3.01') })
    expect(importedAt(dryRun, 15).record).toMatchObject({ kind: 'fee-refund', amount: decimal('1') })
    expect(importedAt(dryRun, 27).record).toMatchObject({ kind: 'deposit', currency: USD, amount: decimal('220'), rate: decimal('1.095') })
    expect(importedAt(dryRun, 4).record).toMatchObject({ sold: decimal('1002'), soldCurrency: EURO, bought: decimal('1100'), boughtCurrency: USD, fees: { amount: decimal('2'), currency: EURO } })
  })

  it('pairs transfers of units and of cash between two accounts', async () => {
    const { dryRun } = await importedBook()
    expect(importedAt(dryRun, 21).record).toMatchObject({ from: IBKR_MAIN.id, to: IBKR_SECOND.id, date: '2025-09-01', moved: { kind: 'units', instrument: ABC_SHARE.id, quantity: decimal('10') } })
    expect(importedAt(dryRun, 19).record).toMatchObject({ from: IBKR_MAIN.id, to: IBKR_SECOND.id, moved: { kind: 'cash', currency: EURO, amount: decimal('500') } })
  })

  it('proposes the split from the shares it added over the shares held, and the spin-off cost share from its worth over the parent cost', async () => {
    const { dryRun } = await importedBook()
    // 10 + 4.5 = 14.5 held the day before and 14.5 added make 29, which is 2 for 1.
    expect(dryRun.questions.splits.map((question) => [decimalText(question.held!), question.proposal])).toEqual([['14.5', { newUnits: 2, oldUnits: 1 }]])
    expect(importedAt(dryRun, 16).record).toMatchObject({ instrument: ABC_SHARE.id, date: '2025-06-10', newUnits: 2, oldUnits: 1 })
    // 2 NEWCO at 12.00 = 24.00 over the 503.50 + 181.00 the ABC lots cost in dollars.
    expect(decimalText(proposedCostShare(dryRun.planned, ABC_SHARE.id, dryRun.questions.spinOffs[0]!)!)).toBe('0.035062089116')
    expect(importedAt(dryRun, 17).record).toMatchObject({ instrument: ABC_SHARE.id, received: NEWCO_SHARE.id, quantity: decimal('2'), costShare: decimal('0.035062089116') })
  })

  it('adds the accounts and instruments the new records name, and leaves the cash every account statement shows', async () => {
    const { dryRun } = await importedBook()
    expect(dryRun.added.accounts).toEqual([IBKR_MAIN, IBKR_SECOND, REVOLUT_ACCOUNT])
    expect(dryRun.added.instruments).toEqual([ABC_SHARE, NEWCO_SHARE, XYZ_FUND, DEF_SHARE])
    // IBKR main in euros: 5,000.00 − 1,002.00 + 3.20 − 0.32 − 3.01 + 1.00 − 500.00. In dollars: 1,100.00 − 503.50 − 181.00 + 2.50 − 0.38 + 0.50 + 149.00.
    // IBKR second: 500.00 − 100.00 − 1,501.00 − 511.00, below zero as the made-up file leaves it. Revolut: 220.00 − 200.00 + 1.70 + 0.12 − 0.01 and 20.00.
    const balances = accountCash(dryRun.planned, RATES, new Set()).balances.map((balance) => [balance.account, balance.currency, decimalText(balance.balance)])
    expect(balances).toEqual([
      [IBKR_MAIN.id, EURO, '3498.87'],
      [IBKR_MAIN.id, USD, '567.12'],
      [IBKR_SECOND.id, EURO, '-1612'],
      [REVOLUT_ACCOUNT.id, EURO, '20'],
      [REVOLUT_ACCOUNT.id, USD, '21.81'],
    ])
  })

  it('holds a transfer whose two accounts are answered as one', async () => {
    const { rows, answers } = await importedBook()
    const oneAccount = workbookDryRun(rows, { book: book({}), rates: RATES, answers: { ...answers, accounts: new Map([...answers.accounts, ['U0000002', IBKR_MAIN]]) } })
    expect([outcomesByRow(oneAccount)[19], outcomesByRow(oneAccount)[21]]).toEqual(['waiting: same-account', 'waiting: same-account'])
  })
})

describe('importing the workbook again', () => {
  /** Kuna's records after the first import. */
  async function afterFirstImport(): Promise<InvestmentBook> {
    return (await importedBook()).dryRun.planned
  }

  it('adds nothing from the same file, and needs no answer for rows already in Kuna', async () => {
    const again = workbookDryRun(await readRows(), { book: await afterFirstImport(), rates: RATES, answers: NO_ANSWERS })
    expect(again.entries.filter((entry) => entry.outcome.kind === 'in-kuna')).toHaveLength(23)
    expect(Object.entries(outcomesByRow(again)).filter(([, outcome]) => outcome !== 'in-kuna')).toEqual([
      ['10', 'waiting: no-partner'],
      ['23', 'waiting: no-partner'],
      ['34', 'waiting: beyond-held'],
      ['35', 'waiting: no-rate'],
    ])
    expect(again.added).toEqual(book({}))
    expect(again.gone).toEqual([])
    expect(again.questions.accounts.map((question) => [question.account, question.known])).toEqual([
      ['U0000001', IBKR_MAIN.id],
      ['U0000002', IBKR_SECOND.id],
      ['RVL-1', REVOLUT_ACCOUNT.id],
    ])
  })

  it('shows a row edited in the workbook once as new and once as gone', async () => {
    const before = await afterFirstImport()
    const edited = TRANSACTIONS.map((row) =>
      row.at(-1) === 'row 18' ? line('2025-08-01', { ...MAIN, ...ABC, Type: 'SELL', 'Quantity (as executed)': -5, 'Price (as executed)': 31, Currency: 'USD', Commission: 1, 'Net cash': 154 }) : row,
    )
    const again = workbookDryRun(await readRows(edited), { book: before, rates: RATES, answers: NO_ANSWERS })
    expect(importedAt(again, 18).record).toMatchObject({ price: decimal('31'), fees: decimal('1') })
    const oldSale = before.trades.find((trade) => trade.side === 'sell' && trade.price === decimal('30'))!
    expect(again.gone).toEqual([{ kind: 'trade', record: oldSale }])
    expect(again.added.trades).toHaveLength(1)
    expect(goneFromWorkbook(again)).toEqual({ edited: [{ gone: { kind: 'trade', record: oldSale }, now: importedAt(again, 18) }], removed: [] })
  })

  it('imports a row added since, beside everything already in Kuna', async () => {
    const before = await afterFirstImport()
    const added = [...TRANSACTIONS, line('2026-02-02', { ...REVOLUT, Type: 'DEPOSIT', Currency: 'EUR', 'Net cash': 300 })]
    const again = workbookDryRun(await readRows(added), { book: before, rates: RATES, answers: NO_ANSWERS })
    expect(again.added.cashMovements.map((movement) => [movement.account, movement.date, decimalText(movement.amount)])).toEqual([[REVOLUT_ACCOUNT.id, '2026-02-02', '300']])
    expect(again.added.accounts).toEqual([])
  })
})

describe('a day of several dividends and withholding rows', () => {
  /** IBKR reverses a withholding and books it again, and pays two dividends of one note on one day. The spreadsheet row of each line is in its comment. */
  const DAY_OF_DIVIDENDS: (string | number)[][] = [
    [...HEADER],
    line('2025-03-14', { ...MAIN, ...ABC, Type: 'DIVIDEND', Currency: 'USD', 'Gross amount': 2.5, 'Net cash': 2.5, Note: `${DIVIDEND_NOTE} (Ordinary Dividend)`, Comment: 'row 2' }),
    line('2025-03-14', { ...MAIN, ...ABC, Type: 'DIVIDEND', Currency: 'USD', 'Gross amount': 0.5, 'Net cash': 0.5, Note: 'ABC(US0000000001) Return of capital USD 0.03 per Share', Comment: 'row 3' }),
    line('2025-03-14', { ...MAIN, ...ABC, Type: 'WITHHOLDING TAX', Currency: 'USD', 'Net cash': -0.38, Note: `${DIVIDEND_NOTE} - US Tax`, Comment: 'row 4' }),
    line('2025-03-14', { ...MAIN, ...ABC, Type: 'WITHHOLDING TAX', Currency: 'USD', 'Net cash': 0.38, Note: `${DIVIDEND_NOTE} - US Tax`, Comment: 'row 5' }),
    line('2025-03-14', { ...MAIN, ...ABC, Type: 'WITHHOLDING TAX', Currency: 'USD', 'Net cash': -0.38, Note: `${DIVIDEND_NOTE} - US Tax`, Comment: 'row 6' }),
    line('2025-06-13', { ...MAIN, ...ABC, Type: 'DIVIDEND', Currency: 'USD', 'Gross amount': 1, 'Net cash': 1, Note: DIVIDEND_NOTE, Comment: 'row 7' }),
    line('2025-06-13', { ...MAIN, ...ABC, Type: 'DIVIDEND', Currency: 'USD', 'Gross amount': 1, 'Net cash': 1, Note: DIVIDEND_NOTE, Comment: 'row 8' }),
    line('2025-06-13', { ...MAIN, ...ABC, Type: 'WITHHOLDING TAX', Currency: 'USD', 'Net cash': -0.15, Note: `${DIVIDEND_NOTE} - US Tax`, Comment: 'row 9' }),
    line('2025-06-13', { ...MAIN, ...ABC, Type: 'WITHHOLDING TAX', Currency: 'USD', 'Net cash': -0.15, Note: `${DIVIDEND_NOTE} - US Tax`, Comment: 'row 10' }),
  ]

  async function dayOfDividends(): Promise<WorkbookDryRun> {
    const answers: WorkbookAnswers = { ...NO_ANSWERS, accounts: new Map([['U0000001', IBKR_MAIN]]), instruments: new Map([['US0000000001', ABC_SHARE]]) }
    return workbookDryRun(await readRows(DAY_OF_DIVIDENDS), { book: book({}), rates: RATES, answers })
  }

  it('joins a reversed and rebooked withholding to the dividend whose note it repeats, as the sum of its signed rows', async () => {
    const dryRun = await dayOfDividends()
    // −0.38 + 0.38 − 0.38 leaves 0.38 withheld from the dividend, and nothing from the return of capital.
    expect(entryOf(dryRun, 2).rows.map((row) => row.fileRow)).toEqual([2, 4, 5, 6])
    expect(importedAt(dryRun, 2).record).toMatchObject({ gross: decimal('2.5'), withheld: decimal('0.38') })
    expect(importedAt(dryRun, 3).record).toMatchObject({ gross: decimal('0.5'), withheld: decimal('0') })
  })

  it('gives each of two dividends with the same note one withholding row', async () => {
    const dryRun = await dayOfDividends()
    expect([entryOf(dryRun, 7).rows.map((row) => row.fileRow), entryOf(dryRun, 8).rows.map((row) => row.fileRow)]).toEqual([
      [7, 9],
      [8, 10],
    ])
  })
})

describe('a row Kuna cannot keep as booked', () => {
  const answers: WorkbookAnswers = { ...NO_ANSWERS, accounts: new Map([['U0000001', IBKR_MAIN]]), instruments: new Map([['US0000000001', ABC_SHARE]]) }

  async function dryRunOf(lines: readonly (string | number)[][]): Promise<WorkbookDryRun> {
    return workbookDryRun(await readRows([[...HEADER], ...lines]), { book: book({}), rates: RATES, answers })
  }

  async function written(dryRun: WorkbookDryRun): Promise<InvestmentBook> {
    const { store } = await browserHarness(used, emptyInvestmentsDocument('2026-10-30T09:00:00.000Z'), INVESTMENTS)
    await store.write('Workbook imported', (unit) => writeWorkbookImport(unit, dryRun.added, []))
    return store.state.workbook!.book
  }

  it('imports fees a fraction of a cent below zero as none, without listing them', async () => {
    // 2 × 100.006 = 200.012 against a net cash of 200.01 leaves −0.002 of fees, which round to 0.00.
    const dryRun = await dryRunOf([line('2025-11-04', { ...MAIN, ...ABC, Type: 'BUY', 'Quantity (as executed)': 2, 'Price (as executed)': 100.006, Currency: 'USD', 'Net cash': -200.01 })])
    expect(importedAt(dryRun, 2).record).toMatchObject({ fees: decimal('0') })
    expect(dryRun.commissionDifferences).toEqual([])
    expect((await written(dryRun)).trades).toHaveLength(1)
  })

  it('skips a trade whose fees fall below zero and a net withholding refund with the words of the write rules, so the rest imports', async () => {
    const dryRun = await dryRunOf([
      line('2025-11-04', { ...MAIN, ...ABC, Type: 'BUY', 'Quantity (as executed)': 2, 'Price (as executed)': 100, Currency: 'USD', 'Net cash': -199.5 }),
      line('2025-05-30', { ...MAIN, Type: 'INTEREST', Currency: 'EUR', 'Gross amount': 3, 'Net cash': 3, Note: 'EUR Credit Interest for May-2025' }),
      line('2025-05-30', { ...MAIN, Type: 'WITHHOLDING TAX', Currency: 'EUR', 'Net cash': 0.5, Note: 'EUR Credit Interest for May-2025 - Tax refund' }),
      line('2025-06-02', { ...MAIN, Type: 'DEPOSIT', Currency: 'EUR', 'Net cash': 100 }),
    ])
    expect(dryRun.skipped).toEqual([
      { fileRow: 2, reason: { kind: 'refused', reason: recordWords.belowZero('fees') } },
      { fileRow: 3, reason: { kind: 'refused', reason: recordWords.belowZero('withheld') } },
    ])
    expect(dryRun.commissionDifferences).toEqual([])
    const stored = await written(dryRun)
    expect([stored.trades.length, stored.income.length, stored.cashMovements.length]).toEqual([0, 0, 1])
  })

  it('skips a row signed against its type rather than import it with the sign turned', async () => {
    const dryRun = await dryRunOf([
      line('2025-02-03', { ...MAIN, Type: 'INTEREST', Currency: 'EUR', 'Gross amount': -4.2, 'Net cash': -4.2, Note: 'EUR Debit Interest for Jan-2025' }),
      line('2025-02-04', { ...MAIN, Type: 'FEE', Currency: 'EUR', 'Net cash': 2 }),
      line('2025-02-05', { ...MAIN, Type: 'DEPOSIT', Currency: 'EUR', 'Net cash': -50 }),
      line('2025-02-06', { ...MAIN, Type: 'WITHDRAWAL', Currency: 'EUR', 'Net cash': 20 }),
      line('2025-02-07', { ...MAIN, Type: 'FEE REFUND', Currency: 'EUR', 'Net cash': -1 }),
      line('2025-03-14', { ...MAIN, ...ABC, Type: 'DIVIDEND', Currency: 'USD', 'Gross amount': -1, 'Net cash': -1, Note: `${DIVIDEND_NOTE} - Reversal` }),
      line('2025-03-17', { ...MAIN, ...ABC, Type: 'BUY', 'Quantity (as executed)': 1, 'Price (as executed)': 10, Currency: 'USD', 'Net cash': 10 }),
      line('2025-03-18', { ...MAIN, ...ABC, Type: 'SELL', 'Quantity (as executed)': -1, 'Price (as executed)': 10, Currency: 'USD', 'Net cash': -10 }),
    ])
    expect(dryRun.skipped.map((row) => [row.fileRow, row.reason.kind])).toEqual([2, 3, 4, 5, 6, 7, 8, 9].map((fileRow) => [fileRow, 'against-sign']))
    expect(dryRun.entries).toEqual([])
    expect(dryRun.questions.accounts).toEqual([])
  })
})

describe('the import through the write rules', () => {
  /** A browser file with no records, and the workbook's dry run with every answer. */
  async function emptyStore() {
    const { store } = await browserHarness(used, emptyInvestmentsDocument('2026-10-30T09:00:00.000Z'), INVESTMENTS)
    return { store, ...(await importedBook()) }
  }

  it('writes the accounts, holdings and records in one write, after which the same file adds nothing, and one Undo takes it all back', async () => {
    const { store, rows, dryRun } = await emptyStore()
    await store.write('Workbook imported', (unit) => writeWorkbookImport(unit, dryRun.added, []))
    const written = store.state.workbook!.book
    expect([written.accounts.length, written.instruments.length, transactionCount(written)]).toEqual([3, 4, 23])

    const again = workbookDryRun(rows, { book: written, rates: RATES, answers: NO_ANSWERS })
    expect(again.added).toEqual(book({}))
    expect(again.entries.filter((entry) => entry.outcome.kind === 'in-kuna')).toHaveLength(23)

    await store.undo(store.state.writes[0]!)
    const undone = store.state.workbook!.book
    expect([undone.accounts.length, undone.instruments.length, transactionCount(undone)]).toEqual([0, 0, 0])
  })

  it('keeps a record gone from the workbook, and deletes it only when the person says so', async () => {
    const { store, dryRun } = await emptyStore()
    await store.write('Workbook imported', (unit) => writeWorkbookImport(unit, dryRun.added, []))
    const withoutRefund = TRANSACTIONS.filter((row) => row.at(-1) !== 'row 15')
    const again = workbookDryRun(await readRows(withoutRefund), { book: store.state.workbook!.book, rates: RATES, answers: NO_ANSWERS })
    const [refund] = again.gone
    expect(refund).toMatchObject({ kind: 'cash-movement', record: { kind: 'fee-refund' } })

    await store.write('Kept', (unit) => writeWorkbookImport(unit, again.added, []))
    expect(store.state.workbook!.book.cashMovements.some((movement) => movement.id === refund!.record.id)).toBe(true)
    await store.write('Deleted', (unit) => writeWorkbookImport(unit, again.added, [refund!]))
    expect(store.state.workbook!.book.cashMovements.some((movement) => movement.id === refund!.record.id)).toBe(false)
  })
})
