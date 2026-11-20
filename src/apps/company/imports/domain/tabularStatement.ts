import { civilDate, civilDateFromSerial } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { decimalOfMarkedText, inEuros, roundedDecimal } from '../../../../shared/money/decimal'
import { absMoney, addMoney, moneyFromAmount, negateMoney, subtractMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import { HEADER_SEARCH_ROWS, headerKey, headerRowOf } from '../../../../shared/recipes/domain/headerRow'
import { occurrenceKeys } from '../../../../shared/text/factKey'
import { fold, normaliseIban } from '../../../../shared/text/fold'
import { profileColumns } from './importProfile'
import type { DateFormat, DecimalMark, ImportProfile } from './importProfile'
import { NO_SIGNALS, StatementRefused } from './importedStatement'
import type { ImportedRow, ImportedStatement, StatementReading } from './importedStatement'
import { words } from './words'

/** A cell of a bank's statement file: text, a number, a date as a serial number, or a flag. */
export type StatementCell = string | number | boolean

/** A sheet's cells from A1, row by row, as a spreadsheet file holds them. */
export type CellGrid = readonly (readonly (StatementCell | undefined)[])[]

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
  const headerIndex = headerRowOf(grid, profileColumns(profile))
  if (headerIndex === null) {
    throw new StatementRefused(words.table.noHeader(HEADER_SEARCH_ROWS, fileName, profile.name, profileColumns(profile)))
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
      notes.push(words.table.noDate(fileRow))
      return
    }
    const date = dateOf(dateCell, profile.dateFormat)
    if (date === null) {
      // A label such as a total holds no digit where the date goes. Anything else is a date the profile misreads.
      if (typeof dateCell === 'string' && !/\d/.test(dateCell)) {
        notes.push(words.table.labelForDate(fileRow, cellString(dateCell)))
      } else {
        problems.push(words.table.notADate(fileRow, cellString(dateCell), profile.dateFormat))
      }
      return
    }
    const amount = amountOfRow(cells, profile, cellAt)
    if (typeof amount === 'string') {
      problems.push(words.table.rowProblem(fileRow, amount))
      return
    }
    let balance: Money | null = null
    if (profile.balance !== '') {
      balance = moneyOf(cellAt(cells, profile.balance), profile.decimal)
      if (balance === null) {
        problems.push(words.table.balanceNotAmount(fileRow, cellString(cellAt(cells, profile.balance))))
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
    throw new StatementRefused(words.table.unreadable(fileName, profile.name, problems.slice(0, 5), Math.max(0, problems.length - 5)))
  }
  if (rows.length === 0) {
    throw new StatementRefused(words.table.noRows(fileName))
  }
  const ordered = inBookingOrder(rows, fileName)
  checkBalances(ordered)
  const withoutReference = ordered.filter((row) => row.reference === '')
  const keys = occurrenceKeys(withoutReference.map((row) => rowFacts(profile.account, row)))
  const keyOfRow = new Map(withoutReference.map((row, index) => [row, keys[index]]))
  const imported: ImportedRow[] = ordered.map((row) => {
    const reference = row.reference === '' ? `row-${keyOfRow.get(row)}` : row.reference
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
    return moneyOf(cell, profile.decimal) ?? (cellString(cell) === '' ? words.table.noAmount : words.table.amountNotAmount(cellString(cell)))
  }
  const debitCell = cellAt(cells, profile.amount.debit)
  const creditCell = cellAt(cells, profile.amount.credit)
  const debit = cellString(debitCell) === '' ? null : moneyOf(debitCell, profile.decimal)
  const credit = cellString(creditCell) === '' ? null : moneyOf(creditCell, profile.decimal)
  if ((cellString(debitCell) !== '' && debit === null) || (cellString(creditCell) !== '' && credit === null)) {
    return words.table.notAnAmount(cellString(debit === null && cellString(debitCell) !== '' ? debitCell : creditCell))
  }
  const debitPart = debit === null || debit === 0 ? null : debit
  const creditPart = credit === null || credit === 0 ? null : credit
  if (debitPart !== null && creditPart !== null) {
    return words.table.bothColumns
  }
  if (debitPart === null && creditPart === null) {
    return debit === null && credit === null ? words.table.neitherColumn : words.table.zero
  }
  if (creditPart !== null && creditPart < 0) {
    return words.table.negativeCredit(cellString(creditCell))
  }
  return debitPart !== null ? negateMoney(absMoney(debitPart)) : creditPart!
}

/** Oldest first. A file listing newest first is turned round whole, so a day's rows keep the bank's order. */
function inBookingOrder(rows: readonly ReadRow[], fileName: string): readonly ReadRow[] {
  const dates = rows.map((row) => row.date)
  const ascending = dates.every((date, index) => index === 0 || dates[index - 1]! <= date)
  const descending = dates.every((date, index) => index === 0 || dates[index - 1]! >= date)
  if (!ascending && !descending) {
    throw new StatementRefused(words.table.unordered(fileName))
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
      throw new StatementRefused(words.table.balanceBreak(row.fileRow, row.balance, previous.fileRow, previous.balance, row.amount, expected))
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

/**
 * A number cell, or text such as `1.234,56`, `-80,00` or `1,234.56 EUR` by the decimal mark, in whole cents. Null for
 * anything else, such as `12.50` read with a decimal comma, which is not a grouped thousand, or `1.234,567`.
 */
export function moneyOf(cell: StatementCell | undefined, decimal: DecimalMark): Money | null {
  if (typeof cell === 'number') {
    return Number.isFinite(cell) ? moneyFromAmount(cell) : null
  }
  const amount = decimalOfMarkedText(cellString(cell), decimal)
  return amount === null || roundedDecimal(amount, 2) !== amount ? null : inEuros(amount, null)
}

/** The facts that tell a row from every other row of its account, so a key from another export of the same row matches. */
function rowFacts(account: string, row: ReadRow): string[] {
  return [account, row.date, String(row.amount), String(row.balance ?? ''), fold(row.description), fold(row.counterparty), normaliseIban(row.counterpartyIban)]
}

function cellString(cell: StatementCell | undefined): string {
  return cell === undefined ? '' : String(cell).trim()
}
