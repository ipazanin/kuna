import { importableRecords } from './importDryRun'
import type { WorkbookRows } from './importDryRun'
import type { LookAlikes } from '../../../../shared/money/lookAlikeBookings'
import { WORKBOOK_COLUMNS, readPortfolioWorkbook } from './portfolioWorkbook'
import type { SkippedRow, WorkbookColumn, WorkbookRow, WorkbookType } from './portfolioWorkbook'
import { accountScopeOf, transcribedRowKey } from './reportKey'
import { workbookEntries } from './workbookEntries'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { AccountMoney } from '../../../../shared/money/accountMoney'
import { currencyCodeOf } from '../../../../shared/money/currencyCode'
import type { CurrencyCode } from '../../../../shared/money/currencyCode'
import { DECIMAL_ZERO, accountMoneyOfDecimal, decimalOfText, decimalText, magnitude, negateDecimal } from '../../../../shared/money/decimal'
import type { Decimal } from '../../../../shared/money/decimal'
import { cardDaysRefusal, statementTies } from '../../../../shared/money/statementTies'
import type { StatementTie } from '../../../../shared/money/statementTies'
import { factKey, occurrenceKeys } from '../../../../shared/text/factKey'
import { fold } from '../../../../shared/text/fold'

/** A row the AI copied from a broker's file Kuna does not read, in the portfolio workbook's columns, each number as the file writes it. */
export interface TranscribedRow {
  readonly date: string
  readonly type: WorkbookType
  readonly symbol: string
  readonly isin: string
  readonly name: string
  readonly quantity: string | null
  readonly price: string | null
  readonly currency: string | null
  readonly gross: string | null
  readonly commission: string | null
  readonly commissionCurrency: string | null
  readonly netCash: string | null
  readonly counterCurrency: string | null
  readonly counterAmount: string | null
  readonly note: string
}

/** The cash balance a file prints for one currency before the card's first row and after its last, each as copied. */
export interface TranscribedBalance {
  readonly currency: string
  readonly opening: string
  readonly closing: string
}

/** The rows of one card, with the broker and account they are on and the file they came from. */
export interface TranscribedFile {
  /** The file's name, blank for rows typed in the chat. */
  readonly fileName: string
  readonly broker: string
  /** The account as the import's questions know it, such as the id of an account in Kuna. */
  readonly account: string
  readonly rows: readonly TranscribedRow[]
  readonly balances: readonly TranscribedBalance[]
}

/** What is wrong with a copied row, by the field it was copied into, never quoting what was copied. */
export type CopiedRowProblem =
  | { readonly kind: 'unreadable' | 'missing'; readonly field: string }
  | { readonly kind: 'commission-below-zero' | 'commission-currency' | 'against-sign' | 'below-a-cent' | 'unknown-type' }
  | { readonly kind: 'refused'; readonly reason: string }

export interface CopiedRowRefusal {
  readonly fileRow: number
  readonly problem: CopiedRowProblem
}

/** A printed balance that the card's rows do not lead to, in cents of its currency. */
export interface CashOff {
  readonly currency: CurrencyCode
  readonly tie: Extract<StatementTie<AccountMoney>, { readonly kind: 'off' }>
}

export type TranscribedReading =
  | { readonly kind: 'read'; readonly rows: WorkbookRows; readonly cashChecked: boolean }
  | { readonly kind: 'refused'; readonly rows: readonly CopiedRowRefusal[] }
  | { readonly kind: 'balance-unread'; readonly field: string }
  | { readonly kind: 'cash-off'; readonly off: readonly CashOff[] }

/** The field of a copied row each workbook column is read from, null for a column the card fills in. */
const FIELD_OF: { readonly [Column in WorkbookColumn]: keyof TranscribedRow | null } = {
  date: 'date',
  time: null,
  broker: null,
  account: null,
  type: 'type',
  yahooSymbol: null,
  brokerSymbol: 'symbol',
  isin: 'isin',
  quantity: 'quantity',
  price: 'price',
  currency: 'currency',
  gross: 'gross',
  commission: 'commission',
  netCash: 'netCash',
  counterCurrency: 'counterCurrency',
  counterAmount: 'counterAmount',
  revolutRate: null,
  note: 'note',
  sourceFile: null,
}

/** The header row the workbook's reader needs, so copied rows go through the same reading of each cell. */
const HEADER: readonly string[] = Object.values(WORKBOOK_COLUMNS)

function cellsOf(file: TranscribedFile, row: TranscribedRow): string[] {
  const filled: Partial<Record<WorkbookColumn, string>> = { broker: file.broker, account: file.account, sourceFile: file.fileName }
  return (Object.keys(WORKBOOK_COLUMNS) as WorkbookColumn[]).map((column) => {
    const field = FIELD_OF[column]
    return (field === null ? (filled[column] ?? '') : (row[field] ?? '')).trim()
  })
}

/** A row the workbook's reader or the dry run skips, said by the copied row's field. */
export function copiedRowRefusal({ fileRow, reason }: SkippedRow): CopiedRowRefusal {
  switch (reason.kind) {
    case 'unreadable':
    case 'missing':
      return { fileRow, problem: { kind: reason.kind, field: FIELD_OF[reason.column] ?? reason.column } }
    case 'refused':
      return { fileRow, problem: { kind: 'refused', reason: reason.reason } }
    default:
      return { fileRow, problem: { kind: reason.kind } }
  }
}

/** The day of a copied row's file and account, which its key starts with, so Kuna can tell which rows of a day it holds. */
function dayScopeOf(fileName: string, row: WorkbookRow): string {
  return factKey([fold(fileName), fold(row.account), row.date])
}

/** The facts that tell a copied row from the rest of its day. */
function factsOf(fileName: string, row: WorkbookRow): string[] {
  const amount = (value: Decimal | null): string => (value === null ? '' : decimalText(value))
  return [
    dayScopeOf(fileName, row),
    row.type,
    fold(row.brokerSymbol),
    row.isin,
    row.currency ?? '',
    amount(row.quantity),
    amount(row.price),
    amount(row.gross),
    amount(row.netCash),
    amount(row.counterAmount),
  ]
}

/**
 * A commission is above zero, in the row's currency, or for an exchange in either of its currencies. A commission in
 * any other currency is a fee row of its own.
 */
function commissionOf(row: WorkbookRow, copied: TranscribedRow): { readonly currency: CurrencyCode | null } | { readonly problem: CopiedRowProblem } {
  if (row.commission === null) return { currency: null }
  if (row.commission < DECIMAL_ZERO) return { problem: { kind: 'commission-below-zero' } }
  const written = copied.commissionCurrency?.trim() ?? ''
  if (written === '') return { problem: { kind: 'missing', field: 'commissionCurrency' } }
  const currency = currencyCodeOf(written)
  if (currency === null) return { problem: { kind: 'unreadable', field: 'commissionCurrency' } }
  return currency === row.currency || (row.type === 'FX' && currency === row.counterCurrency) ? { currency } : { problem: { kind: 'commission-currency' } }
}

/** What a copied row moves in one currency: its net cash, and an exchange's other leg the opposite way. */
function cashIn(currency: CurrencyCode, row: WorkbookRow): Decimal[] {
  const net = row.currency === currency && row.netCash !== null ? [row.netCash] : []
  if (row.type !== 'FX' || row.counterCurrency !== currency || row.counterAmount === null || row.netCash === null) return net
  const counter = magnitude(row.counterAmount)
  return [...net, row.netCash < DECIMAL_ZERO ? counter : negateDecimal(counter)]
}

/** The currencies the copied rows move cash in. */
function cashCurrencies(rows: readonly WorkbookRow[]): Set<CurrencyCode> {
  return new Set(rows.flatMap((row) => [...(row.netCash !== null && row.currency !== null ? [row.currency] : []), ...(row.type === 'FX' && row.counterCurrency !== null ? [row.counterCurrency] : [])]))
}

/** Each printed balance read, or the field that cannot be read. */
function balancesOf(balances: readonly TranscribedBalance[]): { readonly currency: CurrencyCode; readonly opening: Decimal; readonly closing: Decimal }[] | string {
  const read = []
  for (const [at, balance] of balances.entries()) {
    const currency = currencyCodeOf(balance.currency)
    const opening = decimalOfText(balance.opening.trim())
    const closing = decimalOfText(balance.closing.trim())
    if (currency === null) return `balances[${at}].currency`
    if (opening === null) return `balances[${at}].opening`
    if (closing === null) return `balances[${at}].closing`
    read.push({ currency, opening, closing })
  }
  return read
}

/**
 * The copied rows read as the workbook's reader reads its cells, numbered from 1 in the order given. Each row's key starts
 * with its file, account and day and holds its facts, with its count among the card's rows with the same facts, so the
 * same rows copied again are in Kuna already. Refused with every row the reader cannot read or whose commission breaks
 * its rules, since the AI can copy it again. Each printed balance given must be reached from its opening by the rows'
 * cash in its currency, and the rows count as checked when every currency they move has one.
 */
export function transcribedRows(file: TranscribedFile, lookAlikes: LookAlikes): TranscribedReading {
  const reading = readPortfolioWorkbook([{ name: 'Transactions', grid: [HEADER, ...file.rows.map((row) => cellsOf(file, row))] }])
  if (reading.kind === 'refused') throw new Error('The header of copied rows names every column.')
  const numbered = (fileRow: number): number => fileRow - 1
  const refusals = reading.skipped.map((skipped) => copiedRowRefusal({ ...skipped, fileRow: numbered(skipped.fileRow) }))
  const keys = occurrenceKeys(reading.rows.map((row) => factsOf(file.fileName, row)))
  const rows: WorkbookRow[] = []
  reading.rows.forEach((row, at) => {
    const commission = commissionOf(row, file.rows[at]!)
    if ('problem' in commission) {
      refusals.push({ fileRow: numbered(row.fileRow), problem: commission.problem })
      return
    }
    const key = transcribedRowKey(dayScopeOf(file.fileName, row), keys[at]!)
    rows.push({ ...row, fileRow: numbered(row.fileRow), name: file.rows[at]!.name.trim(), commissionCurrency: commission.currency, key })
  })
  if (refusals.length > 0) return { kind: 'refused', rows: refusals.sort((first, second) => first.fileRow - second.fileRow) }
  const balances = balancesOf(file.balances)
  if (typeof balances === 'string') return { kind: 'balance-unread', field: balances }
  const off = balances.flatMap(({ currency, opening, closing }): CashOff[] => {
    const tie = statementTies({ opening: accountMoneyOfDecimal(opening), closing: accountMoneyOfDecimal(closing), amounts: rows.flatMap((row) => cashIn(currency, row)).map(accountMoneyOfDecimal) })
    return tie.kind === 'off' ? [{ currency, tie }] : []
  })
  if (off.length > 0) return { kind: 'cash-off', off }
  const printed = new Set(balances.map((balance) => balance.currency))
  const cashChecked = balances.length > 0 && [...cashCurrencies(rows)].every((currency) => printed.has(currency))
  return { kind: 'read', rows: { rows, skipped: [], rounded: [], transcribed: { lookAlikes } }, cashChecked }
}

/**
 * The days of a file's copied rows that Kuna holds rows of the card does not give, so the card holds only part of that day
 * and an equal row on it would be taken for one Kuna has. Rows typed in the chat share no file, so they are never checked.
 */
export function daysPartlyOnCard(rows: WorkbookRows, book: InvestmentBook, fileName: string): CivilDate[] {
  if (fileName === '') return []
  const cardKeys = new Set(workbookEntries(rows.rows).map((entry) => entry.key))
  const scopesHeld = importableRecords(book).flatMap(({ record: { importKey } }) => (importKey === null || cardKeys.has(importKey) ? [] : [accountScopeOf(importKey)]))
  const dayOf = new Map(rows.rows.map((row) => [accountScopeOf(row.key), row.date]))
  const refusal = cardDaysRefusal(scopesHeld, [...dayOf.keys()], null)
  return refusal?.kind === 'split' ? refusal.days.map((scope) => dayOf.get(scope)!).sort() : []
}
