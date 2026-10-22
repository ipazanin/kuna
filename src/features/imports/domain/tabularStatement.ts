import { civilDate, civilDateFromSerial } from '../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../shared/calendar/civilDate'
import { addMoney, moneyFromAmount, negateMoney, plainAmount, subtractMoney } from '../../../shared/money/money'
import type { Money } from '../../../shared/money/money'
import { fold, normaliseIban } from '../../../shared/text/fold'
import { profileColumns } from './importProfile'
import type { DateFormat, DecimalMark, ImportProfile } from './importProfile'
import { StatementRefused } from './importedStatement'
import type { ImportedRow, ImportedStatement, StatementReading } from './importedStatement'

/** A cell of a bank's statement file: text, a number, a date as a serial number, or a flag. */
export type StatementCell = string | number | boolean

/** A sheet's cells from A1, row by row, as a spreadsheet file holds them. */
export type CellGrid = readonly (readonly (StatementCell | undefined)[])[]

/** How far down a file the header row is looked for, past a bank's title and account lines. */
const HEADER_SEARCH_ROWS = 40

const NO_SIGNALS = { purpose: '', txDomain: '', txFamily: '', txSubFamily: '', creditorReference: '', instructedCurrency: '' } as const

/** The first row that carries every header the profile names, 0-based, or null. */
export function headerRowOf(grid: CellGrid, profile: ImportProfile): number | null {
  const wanted = profileColumns(profile).map(headerKey)
  const index = grid.slice(0, HEADER_SEARCH_ROWS).findIndex((row) => {
    const headers = new Set(row.map((cell) => headerKey(cellString(cell))))
    return wanted.every((column) => headers.has(column))
  })
  return index < 0 ? null : index
}

/**
 * The rows of a bank's spreadsheet export, read by a profile: the header row found by its texts,
 * then every row below with a date, put in booking order oldest first when the file lists newest
 * first. A row without a date, or with a label such as "Total" where the date goes, is skipped and
 * noted. A row with a date that cannot be read refuses the file, since leaving a payment out would
 * break every balance after it.
 * With a balance column each row's balance must follow from the row before. A row without a
 * reference column, or with a blank one, gets a key of its account, date, amount, balance and text
 * with its count among equal rows of the file, so the same row in a later export gets the same key.
 */
export function readTabularStatement(grid: CellGrid, profile: ImportProfile, fileName: string, fileHash: string): StatementReading {
  const label = `${fileName.replace(/\.[^.]+$/, '') || fileName} (${fileHash.slice(0, 8)})`
  try {
    return { statement: tabularStatement(grid, profile, fileName, fileHash, label) }
  } catch (failure) {
    if (failure instanceof StatementRefused) {
      return { fileName, label, refusal: failure.message }
    }
    throw failure
  }
}

interface ReadRow {
  /** The row of the bank's own file, numbered as a spreadsheet numbers it, for the notes about it. */
  readonly fileRow: number
  readonly date: CivilDate
  readonly amount: Money
  readonly balance: Money | null
  readonly counterparty: string
  readonly counterpartyIban: string
  readonly description: string
  readonly reference: string
}

function tabularStatement(grid: CellGrid, profile: ImportProfile, fileName: string, fileHash: string, label: string): ImportedStatement {
  const headerIndex = headerRowOf(grid, profile)
  if (headerIndex === null) {
    throw new StatementRefused(`No row in the first ${HEADER_SEARCH_ROWS} of ${fileName} carries every column of the profile ${profile.name}: ${profileColumns(profile).map((column) => `"${column}"`).join(', ')}.`)
  }
  const header = grid[headerIndex]!.map((cell) => headerKey(cellString(cell)))
  const columnOf = (name: string): number => (name === '' ? -1 : header.indexOf(headerKey(name)))
  const cellAt = (row: readonly (StatementCell | undefined)[], name: string): StatementCell | undefined => {
    const column = columnOf(name)
    return column < 0 ? undefined : row[column]
  }
  const notes: string[] = []
  const problems: string[] = []
  const rows: ReadRow[] = []
  grid.slice(headerIndex + 1).forEach((cells, offset) => {
    const fileRow = headerIndex + 2 + offset
    if (cells.every((cell) => cellString(cell) === '')) return
    const dateCell = cellAt(cells, profile.date)
    if (cellString(dateCell) === '') {
      notes.push(`Row ${fileRow} has no date, so it is skipped.`)
      return
    }
    const date = dateOf(dateCell, profile.dateFormat)
    if (date === null) {
      // A label such as a total holds no digit where the date goes. Anything else is a date the profile misreads.
      if (typeof dateCell === 'string' && !/\d/.test(dateCell)) {
        notes.push(`Row ${fileRow} reads "${cellString(dateCell)}" where the date goes, so it is skipped.`)
      } else {
        problems.push(`row ${fileRow}: "${cellString(dateCell)}" is not a ${profile.dateFormat} date`)
      }
      return
    }
    const amount = amountOfRow(cells, profile, cellAt)
    if (typeof amount === 'string') {
      problems.push(`row ${fileRow}: ${amount}`)
      return
    }
    let balance: Money | null = null
    if (profile.balance !== '') {
      balance = moneyOf(cellAt(cells, profile.balance), profile.decimal)
      if (balance === null) {
        problems.push(`row ${fileRow}: the balance "${cellString(cellAt(cells, profile.balance))}" is not an amount`)
        return
      }
    }
    rows.push({
      fileRow,
      date,
      amount,
      balance,
      counterparty: cellString(cellAt(cells, profile.counterparty)),
      counterpartyIban: cellString(cellAt(cells, profile.counterpartyIban)),
      description: cellString(cellAt(cells, profile.description)),
      reference: cellString(cellAt(cells, profile.reference)),
    })
  })
  if (problems.length > 0) {
    throw new StatementRefused(`${fileName} has rows the profile ${profile.name} cannot read, so nothing of it is imported: ${problems.slice(0, 5).join('; ')}${problems.length > 5 ? `, and ${problems.length - 5} more` : ''}.`)
  }
  if (rows.length === 0) {
    throw new StatementRefused(`${fileName} holds no rows with a date under the header row.`)
  }
  const ordered = inBookingOrder(rows, fileName)
  checkBalances(ordered)
  const occurrences = new Map<string, number>()
  const imported: ImportedRow[] = ordered.map((row) => {
    let reference = row.reference
    if (reference === '') {
      const key = rowKey(profile.account, row)
      const occurrence = (occurrences.get(key) ?? 0) + 1
      occurrences.set(key, occurrence)
      reference = `row-${key}-${occurrence}`
    }
    return {
      date: row.date,
      amount: row.amount,
      balance: row.balance,
      counterparty: row.counterparty,
      counterpartyIban: row.counterpartyIban,
      description: row.description,
      reference,
      signals: NO_SIGNALS,
      reviewReasons: [],
    }
  })
  const first = ordered[0]!
  const last = ordered[ordered.length - 1]!
  return {
    fileName,
    source: { kind: 'table', profile: profile.name, fileHash },
    label,
    account: profile.account,
    opening: first.balance === null ? null : subtractMoney(first.balance, first.amount),
    closing: last.balance,
    rows: imported,
    notes,
  }
}

/** The row's signed amount: the signed column, or the credit less the debit, where exactly one of the two holds an amount. */
function amountOfRow(
  cells: readonly (StatementCell | undefined)[],
  profile: ImportProfile,
  cellAt: (row: readonly (StatementCell | undefined)[], name: string) => StatementCell | undefined,
): Money | string {
  if ('signed' in profile.amount) {
    const cell = cellAt(cells, profile.amount.signed)
    return moneyOf(cell, profile.decimal) ?? (cellString(cell) === '' ? 'no amount' : `the amount "${cellString(cell)}" is not an amount`)
  }
  const debitCell = cellAt(cells, profile.amount.debit)
  const creditCell = cellAt(cells, profile.amount.credit)
  const debit = cellString(debitCell) === '' ? null : moneyOf(debitCell, profile.decimal)
  const credit = cellString(creditCell) === '' ? null : moneyOf(creditCell, profile.decimal)
  if ((cellString(debitCell) !== '' && debit === null) || (cellString(creditCell) !== '' && credit === null)) {
    return `"${cellString(debit === null && cellString(debitCell) !== '' ? debitCell : creditCell)}" is not an amount`
  }
  const debitPart = debit === null || debit === 0 ? null : debit
  const creditPart = credit === null || credit === 0 ? null : credit
  if (debitPart !== null && creditPart !== null) {
    return 'both the debit and the credit column hold an amount'
  }
  if (debitPart === null && creditPart === null) {
    return debit === null && credit === null ? 'no amount in the debit or the credit column' : 'an amount of zero'
  }
  if (creditPart !== null && creditPart < 0) {
    return `the credit "${cellString(creditCell)}" is negative, so whether the money came in or went out is unclear`
  }
  return debitPart !== null ? negateMoney(Math.abs(debitPart) as Money) : creditPart!
}

/** Oldest first. A file listing newest first is turned round whole, so a day's rows keep the bank's order. */
function inBookingOrder(rows: readonly ReadRow[], fileName: string): readonly ReadRow[] {
  const dates = rows.map((row) => row.date)
  const ascending = dates.every((date, index) => index === 0 || dates[index - 1]! <= date)
  const descending = dates.every((date, index) => index === 0 || dates[index - 1]! >= date)
  if (!ascending && !descending) {
    throw new StatementRefused(`The dates in ${fileName} run neither oldest first nor newest first, so the rows cannot be put in booking order.`)
  }
  return ascending ? rows : [...rows].reverse()
}

/** With a balance column, each row's balance is the one before plus its amount, as the bank's own chain. */
function checkBalances(rows: readonly ReadRow[]): void {
  rows.forEach((row, index) => {
    const previous = rows[index - 1]
    if (previous === undefined || previous.balance === null || row.balance === null) return
    const expected = addMoney(previous.balance, row.amount)
    if (expected !== row.balance) {
      throw new StatementRefused(
        `Row ${row.fileRow} says the balance is ${plainAmount(row.balance)}, but row ${previous.fileRow}'s ${plainAmount(previous.balance)} plus ${plainAmount(row.amount)} is ${plainAmount(expected)}. The rows may be out of order or one may be missing.`,
      )
    }
  })
}

/** A text date in the profile's format, or a date cell's serial number. */
export function dateOf(cell: StatementCell | undefined, format: DateFormat): CivilDate | null {
  if (typeof cell === 'number') {
    return Number.isFinite(cell) && cell > 0 && cell < 2_958_466 ? civilDateFromSerial(cell) : null
  }
  const text = cellString(cell)
  const patterns: Record<DateFormat, { readonly pattern: RegExp; readonly order: readonly [number, number, number] }> = {
    'dd.mm.yyyy': { pattern: /^(\d{1,2})\.\s?(\d{1,2})\.\s?(\d{4})\.?(?:\s.*)?$/, order: [3, 2, 1] },
    'dd/mm/yyyy': { pattern: /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s.*)?$/, order: [3, 2, 1] },
    'mm/dd/yyyy': { pattern: /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s.*)?$/, order: [3, 1, 2] },
    'yyyy-mm-dd': { pattern: /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/, order: [1, 2, 3] },
  }
  const { pattern, order } = patterns[format]
  const match = pattern.exec(text)
  if (match === null) return null
  try {
    return civilDate(Number(match[order[0]]), Number(match[order[1]]), Number(match[order[2]]))
  } catch {
    return null
  }
}

/** A text amount by its decimal mark: a sign before or after, whole groups of three between grouping marks, at most two decimals. */
const TEXT_AMOUNT: Record<DecimalMark, RegExp> = {
  comma: /^([+-]?)(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?(-?)$/,
  point: /^([+-]?)(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?(-?)$/,
}

/**
 * A number cell, or text such as `1.234,56`, `-80,00` or `1,234.56 EUR` by the decimal mark. Null
 * for anything else, such as `12.50` read with a decimal comma, which is not a grouped thousand.
 */
export function moneyOf(cell: StatementCell | undefined, decimal: DecimalMark): Money | null {
  if (typeof cell === 'number') {
    return Number.isFinite(cell) ? moneyFromAmount(cell) : null
  }
  const grouping = decimal === 'comma' ? '.' : ','
  const text = cellString(cell)
    .replace(/^[A-Za-z]{3}\s*|\s*[A-Za-z]{3}$/g, '')
    .replace(/^([+-])\s+/, '$1')
    .replace(/[\s']/g, grouping)
  const match = TEXT_AMOUNT[decimal].exec(text)
  if (match === null || (match[1] === '-' && match[4] === '-')) return null
  const cents = Number(match[2]!.split(grouping).join('')) * 100 + Number((match[3] ?? '').padEnd(2, '0'))
  return (match[1] === '-' || match[4] === '-' ? -cents : cents) as Money
}

/** Sixteen hex digits from two 32-bit FNV-1a passes over the row's facts, so a key from another export of the same row matches. */
function rowKey(account: string, row: ReadRow): string {
  const facts = [account, row.date, row.amount, row.balance ?? '', fold(row.description), fold(row.counterparty), normaliseIban(row.counterpartyIban)].join('|')
  return `${fnv(facts, 0x811c9dc5)}${fnv(facts, 0x01000193)}`
}

function fnv(text: string, seed: number): string {
  let hash = seed >>> 0
  for (const character of text) {
    hash ^= character.codePointAt(0)!
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

function cellString(cell: StatementCell | undefined): string {
  return cell === undefined ? '' : String(cell).trim()
}

function headerKey(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase()
}

