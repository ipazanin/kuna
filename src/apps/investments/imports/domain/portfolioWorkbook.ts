import { civilDateFromSerial, parseCivilDate } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { currencyCodeOf } from '../../../../shared/money/currencyCode'
import type { CurrencyCode } from '../../../../shared/money/currencyCode'
import { decimalOfNumber, decimalOfText, decimalText } from '../../../../shared/money/decimal'
import type { Decimal } from '../../../../shared/money/decimal'
import { cellText } from '../../../../shared/text/cellText'
import { factKey } from '../../../../shared/text/factKey'
import { fold } from '../../../../shared/text/fold'

/** A cell as a spreadsheet file gives it: text, a number, a date as a serial number, or a flag. */
export type WorkbookCell = string | number | boolean

/** A tab of the portfolio workbook by its name, with its cells from A1. */
export interface WorkbookTab {
  readonly name: string
  readonly grid: readonly (readonly (WorkbookCell | undefined)[])[]
}

/** The kinds of row the Transactions tab books, as its Type column writes them. */
export const WORKBOOK_TYPES = [
  'BUY',
  'SELL',
  'DIVIDEND',
  'WITHHOLDING TAX',
  'INTEREST',
  'STOCK YIELD INCOME',
  'REFERRAL CREDIT',
  'DEPOSIT',
  'WITHDRAWAL',
  'FEE',
  'FEE REFUND',
  'FX',
  'TRANSFER OUT',
  'TRANSFER IN',
  'INTERNAL CASH TRANSFER',
  'SPLIT',
  'SPINOFF',
] as const

export type WorkbookType = (typeof WORKBOOK_TYPES)[number]

/** The tab the import reads. The workbook's other tabs are its owner's working notes. */
const TRANSACTIONS_TAB = 'Transactions'

/** How far down the tab the header row is looked for. */
const HEADER_SEARCH_ROWS = 10

/** The columns the import reads, by their header. The workbook's split-adjusted columns are not read. */
export const WORKBOOK_COLUMNS = {
  date: 'Date',
  time: 'Time',
  broker: 'Broker',
  account: 'Account',
  type: 'Type',
  yahooSymbol: 'Symbol (Yahoo)',
  brokerSymbol: 'Broker symbol',
  isin: 'ISIN',
  quantity: 'Quantity (as executed)',
  price: 'Price (as executed)',
  currency: 'Currency',
  gross: 'Gross amount',
  commission: 'Commission',
  netCash: 'Net cash',
  counterCurrency: 'FX counter currency',
  counterAmount: 'FX counter amount',
  revolutRate: 'Revolut FX rate',
  note: 'Note',
  sourceFile: 'Source file',
} as const

export type WorkbookColumn = keyof typeof WORKBOOK_COLUMNS

/** Quantities, prices and rates keep twelve places, and amounts of money are in cents. */
const PLACES = { quantity: 12, price: 12, revolutRate: 12, gross: 2, commission: 2, netCash: 2, counterAmount: 2 } as const

type NumberColumn = keyof typeof PLACES

/** A number cell's binary noise, such as the 2 at the end of 12.300000000000002, is at most this share of the number. */
const NOISE = 1e-12

/** One row of the Transactions tab, signed as the broker booked it. */
export interface WorkbookRow {
  /** Numbered as the spreadsheet numbers it. */
  readonly fileRow: number
  readonly date: CivilDate
  readonly time: string
  readonly broker: string
  /** The broker's account as the workbook writes it, which only the import's questions and keys read. */
  readonly account: string
  readonly type: WorkbookType
  readonly yahooSymbol: string
  readonly brokerSymbol: string
  readonly isin: string
  readonly quantity: Decimal | null
  readonly price: Decimal | null
  readonly currency: CurrencyCode | null
  readonly gross: Decimal | null
  /** Above zero. */
  readonly commission: Decimal | null
  /** The statement's total for the row, signed: below zero when cash leaves the account. */
  readonly netCash: Decimal | null
  readonly counterCurrency: CurrencyCode | null
  readonly counterAmount: Decimal | null
  readonly revolutRate: Decimal | null
  readonly note: string
  readonly sourceFile: string
  /** The row's facts with its count among rows of the file with the same facts. */
  readonly key: string
}

/** Why a row of the tab is not imported. */
export type SkipReason =
  | { readonly kind: 'unknown-type'; readonly text: string }
  | { readonly kind: 'unreadable'; readonly column: WorkbookColumn; readonly text: string }
  | { readonly kind: 'missing'; readonly column: WorkbookColumn }

export interface SkippedRow {
  readonly fileRow: number
  readonly reason: SkipReason
}

/** A number cell that rounding moved by more than its binary noise, such as an amount of 12.345 rounded to 12.35. */
export interface RoundedCell {
  readonly fileRow: number
  readonly column: NumberColumn
  readonly cell: number
  readonly rounded: Decimal
}

export type WorkbookRefusal = { readonly kind: 'no-transactions-tab' } | { readonly kind: 'missing-columns'; readonly columns: readonly string[] }

export type WorkbookReading =
  | { readonly kind: 'read'; readonly rows: readonly WorkbookRow[]; readonly skipped: readonly SkippedRow[]; readonly rounded: readonly RoundedCell[] }
  | { readonly kind: 'refused'; readonly refusal: WorkbookRefusal }

class RowSkipped extends Error {
  readonly reason: SkipReason

  constructor(reason: SkipReason) {
    super(reason.kind)
    this.reason = reason
  }
}

/**
 * The rows of the workbook's Transactions tab, read by header name from the first of its top rows that carries every
 * column. A tab with no such row is refused with the columns missing from the top row that has the most of them. A
 * blank row is passed over. A row whose type, date, number or currency cannot be read is skipped with its
 * reason. Number cells are rounded half away from zero, quantities, prices and rates to twelve places and amounts to
 * cents, and a cell that rounding moved by more than binary noise is listed.
 */
export function readPortfolioWorkbook(tabs: readonly WorkbookTab[]): WorkbookReading {
  const tab = tabs.find((candidate) => fold(candidate.name) === fold(TRANSACTIONS_TAB))
  if (tab === undefined) {
    return { kind: 'refused', refusal: { kind: 'no-transactions-tab' } }
  }
  const wanted = Object.values(WORKBOOK_COLUMNS)
  const missing = tab.grid.slice(0, HEADER_SEARCH_ROWS).map((row) => {
    const headers = new Set(row.map((cell) => fold(cellText(cell))))
    return wanted.filter((column) => !headers.has(fold(column)))
  })
  const headerIndex = missing.findIndex((columns) => columns.length === 0)
  if (headerIndex < 0) {
    const fewest = missing.reduce((best, columns) => (columns.length < best.length ? columns : best), wanted)
    return { kind: 'refused', refusal: { kind: 'missing-columns', columns: fewest } }
  }
  const header = tab.grid[headerIndex]!.map((cell) => fold(cellText(cell)))
  const columnOf = Object.fromEntries(Object.entries(WORKBOOK_COLUMNS).map(([name, title]) => [name, header.indexOf(fold(title))])) as Record<WorkbookColumn, number>

  const rows: Omit<WorkbookRow, 'key'>[] = []
  const skipped: SkippedRow[] = []
  const rounded: RoundedCell[] = []
  tab.grid.slice(headerIndex + 1).forEach((cells, index) => {
    if (cells.every((cell) => cellText(cell) === '')) {
      return
    }
    const fileRow = headerIndex + index + 2
    try {
      rows.push(rowOf(fileRow, (column) => cells[columnOf[column]], rounded))
    } catch (failure) {
      if (failure instanceof RowSkipped) {
        skipped.push({ fileRow, reason: failure.reason })
        return
      }
      throw failure
    }
  })
  return { kind: 'read', rows: withKeys(rows), skipped, rounded }
}

function rowOf(fileRow: number, cellAt: (column: WorkbookColumn) => WorkbookCell | undefined, rounded: RoundedCell[]): Omit<WorkbookRow, 'key'> {
  const text = (column: WorkbookColumn): string => cellText(cellAt(column))
  const typeText = fold(text('type'))
  const type = WORKBOOK_TYPES.find((known) => known === typeText)
  if (type === undefined) {
    throw new RowSkipped({ kind: 'unknown-type', text: text('type') })
  }
  const number = (column: NumberColumn): Decimal | null => {
    const cell = cellAt(column)
    if (typeof cell === 'number') {
      const value = decimalOfNumber(cell, PLACES[column])
      if (value === null) {
        throw new RowSkipped({ kind: 'unreadable', column, text: String(cell) })
      }
      if (Math.abs(Number(decimalText(value)) - cell) > Math.max(Math.abs(cell), 1) * NOISE) {
        rounded.push({ fileRow, column, cell, rounded: value })
      }
      return value
    }
    const written = text(column)
    if (written === '') {
      return null
    }
    const value = decimalOfText(written)
    if (value === null) {
      throw new RowSkipped({ kind: 'unreadable', column, text: written })
    }
    return value
  }
  const currency = (column: 'currency' | 'counterCurrency'): CurrencyCode | null => {
    const written = text(column)
    const code = written === '' ? null : currencyCodeOf(written)
    if (written !== '' && code === null) {
      throw new RowSkipped({ kind: 'unreadable', column, text: written })
    }
    return code
  }
  return {
    fileRow,
    date: dateOf(cellAt('date')),
    time: timeOf(cellAt('time')),
    broker: text('broker'),
    account: text('account'),
    type,
    yahooSymbol: text('yahooSymbol'),
    brokerSymbol: text('brokerSymbol'),
    isin: text('isin').toUpperCase(),
    quantity: number('quantity'),
    price: number('price'),
    currency: currency('currency'),
    gross: number('gross'),
    commission: number('commission'),
    netCash: number('netCash'),
    counterCurrency: currency('counterCurrency'),
    counterAmount: number('counterAmount'),
    revolutRate: number('revolutRate'),
    note: text('note'),
    sourceFile: text('sourceFile'),
  }
}

function dateOf(cell: WorkbookCell | undefined): CivilDate {
  const date = typeof cell === 'number' && Number.isFinite(cell) ? civilDateFromSerial(cell) : parseCivilDate(cellText(cell))
  if (date === null) {
    throw new RowSkipped(cellText(cell) === '' ? { kind: 'missing', column: 'date' } : { kind: 'unreadable', column: 'date', text: cellText(cell) })
  }
  return date
}

/** A time cell as `hh:mm:ss`, from the fraction of a day a spreadsheet gives, or the text as written. */
function timeOf(cell: WorkbookCell | undefined): string {
  if (typeof cell !== 'number') {
    return cellText(cell)
  }
  const seconds = Math.round((cell - Math.floor(cell)) * 86_400)
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map((part) => String(part).padStart(2, '0')).join(':')
}

/**
 * Each row's key of the facts that tell it from the rest: the account, type, date, time, broker symbol, quantity,
 * price and net cash, with its count among rows of the file with the same facts, so two equal rows get two keys and
 * the same row in a later version of the workbook gets the same key.
 */
function withKeys(rows: readonly Omit<WorkbookRow, 'key'>[]): WorkbookRow[] {
  const occurrences = new Map<string, number>()
  return rows.map((row) => {
    const amount = (value: Decimal | null): string => (value === null ? '' : decimalText(value))
    const facts = factKey(['workbook', fold(row.account), row.type, row.date, fold(row.time), fold(row.brokerSymbol), amount(row.quantity), amount(row.price), amount(row.netCash)])
    const occurrence = (occurrences.get(facts) ?? 0) + 1
    occurrences.set(facts, occurrence)
    return { ...row, key: `${facts}-${occurrence}` }
  })
}
