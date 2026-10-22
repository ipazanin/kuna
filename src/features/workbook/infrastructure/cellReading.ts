import { civilDateFromSerial } from '../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../shared/calendar/civilDate'
import type { DateRange } from '../../../shared/calendar/dateRange'
import { moneyFromAmount } from '../../../shared/money/money'
import type { Money } from '../../../shared/money/money'
import type { RecordId } from '../domain/recordId'
import { sharedKeys } from '../domain/sharedKeys'
import type { RecordProblem } from '../domain/workbook'
import { labelOfRow, readRecordId, recordIdOfRow } from './tabRecords'
import type { CellValue, SheetRow, WorkbookTab } from './workbookSnapshot'
import { ID_COLUMN } from './workbookTemplate'
import type { TABS_WITH_IDS } from './workbookTemplate'

type Cells = SheetRow['cells']

/** Why a reader left out or doubts a row, by the row it was found on. */
export interface RowProblem {
  readonly sheetRow: number
  readonly reason: string
}

/** What a tab reader made of its rows: the facts it could read, and why it left out or doubted the rest, each by its record. */
export interface TabReading<Fact> {
  readonly facts: readonly Fact[]
  readonly problems: readonly RecordProblem[]
}

/** The reading of a tab, each problem naming the record of the row it was found on, in the order the rows are given. */
export function tabReading<Fact>(tab: WorkbookTab, rows: readonly SheetRow[], facts: readonly Fact[], problems: readonly RowProblem[]): TabReading<Fact> {
  return { facts, problems: recordProblems(tab, rows, problems) }
}

/** Row problems as problems of the records the rows hold, in the order the rows are given. */
export function recordProblems(tab: WorkbookTab, rows: readonly SheetRow[], problems: readonly RowProblem[]): RecordProblem[] {
  const placeOf = new Map(rows.map((row, place) => [row.sheetRow, place]))
  return [...problems]
    .sort((upper, lower) => (placeOf.get(upper.sheetRow) ?? 0) - (placeOf.get(lower.sheetRow) ?? 0))
    .map((problem) => {
      const cells = rows[placeOf.get(problem.sheetRow) ?? -1]?.cells ?? {}
      return { id: recordIdOfRow(tab, cells), label: labelOfRow(tab, cells), reason: problem.reason }
    })
}

/**
 * What a reading says of the record a row's cells hold: whether it was read, and every reason given
 * for it. A record is found by its key or id, and one without either by its label.
 */
export function recordOutcome(tab: WorkbookTab, reading: TabReading<{ readonly id: RecordId }>, cells: Cells): { readonly kept: boolean; readonly reasons: readonly string[] } {
  const id = recordIdOfRow(tab, cells)
  const label = labelOfRow(tab, cells)
  const ofRecord = reading.problems.filter((problem) => (id === null ? problem.id === null && problem.label === label : problem.id === id))
  return { kept: id !== null && reading.facts.some((fact) => fact.id === id), reasons: [...new Set(ofRecord.map((problem) => problem.reason))] }
}

/** Why a row cannot be read. The cell helpers below throw it, and `readRow` turns it into the reason. */
class UnreadableRow extends Error {}

export function refuse(reason: string): never {
  throw new UnreadableRow(reason)
}

/** The fact one row holds, or the reason it cannot be read. */
export function readRow<Fact>(read: () => Fact): Fact | { readonly unreadable: string } {
  try {
    return read()
  } catch (failure) {
    if (failure instanceof UnreadableRow) {
      return { unreadable: failure.message }
    }
    throw failure
  }
}

export function isUnreadable<Fact>(reading: Fact | { readonly unreadable: string }): reading is { readonly unreadable: string } {
  return typeof reading === 'object' && reading !== null && 'unreadable' in reading
}

export function textOf(cell: CellValue | undefined): string {
  return cell === undefined ? '' : String(cell).trim()
}

export function slugOf(cell: CellValue | undefined): string {
  return textOf(cell).toLowerCase()
}

/** The ids more than one row of the tab holds, whether or not those rows read. */
export function sharedIds(rows: readonly SheetRow[]): ReadonlySet<string> {
  return sharedKeys(
    rows.map((row) => textOf(row.cells[ID_COLUMN])).filter((id) => id !== ''),
    (id) => id,
  )
}

/**
 * The row's record id, once the rest of the row has read. Refused when the row has no id, or holds
 * one another row of the tab holds too, as a copied row does.
 */
export function ownIdOf(tab: (typeof TABS_WITH_IDS)[number], row: SheetRow, shared: ReadonlySet<string>): RecordId {
  const id = textOf(row.cells[ID_COLUMN])
  if (id === '') {
    refuse('no id, so it is left out until "Add ids" on Overview gives it one')
  }
  if (shared.has(id)) {
    refuse('the same id as another row, so it is left out. Clear the id cell of the copied row, and "Add ids" on Overview gives it its own')
  }
  return readRecordId(tab, row.cells)
}

/** A comma-separated list in lower case, such as `revenue, watched`. */
export function slugListOf(cell: CellValue | undefined): string[] {
  return textOf(cell)
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry !== '')
}

/** A date cell, as the Sheets API and an xlsx give it: a serial number. */
export function dateOf(cell: CellValue | undefined): CivilDate | null {
  return typeof cell === 'number' && Number.isFinite(cell) ? civilDateFromSerial(cell) : null
}

export function moneyOf(cell: CellValue | undefined): Money | null {
  return typeof cell === 'number' && Number.isFinite(cell) ? moneyFromAmount(cell) : null
}

/** A whole number, from a number cell or from text such as `7`. */
export function wholeNumberOf(cell: CellValue | undefined): number | null {
  const number = typeof cell === 'number' ? cell : typeof cell === 'string' && cell.trim() !== '' ? Number(cell.trim()) : Number.NaN
  return Number.isInteger(number) ? number : null
}

/** TRUE or FALSE, from a checkbox cell or from text. Null for anything else. */
export function booleanOf(cell: CellValue): boolean | null {
  if (typeof cell === 'boolean') return cell
  const text = String(cell).trim().toLowerCase()
  if (['true', 'yes', 'on', '1'].includes(text)) return true
  if (['false', 'no', 'off', '0'].includes(text)) return false
  return null
}

export function optionalDate(cells: Cells, column: string): CivilDate | null {
  const cell = cells[column]
  if (cell === undefined) return null
  return dateOf(cell) ?? refuse(`${column} "${textOf(cell)}" is not a date cell`)
}

export function requiredDate(cells: Cells, column: string): CivilDate {
  return optionalDate(cells, column) ?? refuse(`no ${column} date`)
}

/** Two optional date columns that together make a period. Both blank is no period. */
export function optionalPeriod(cells: Cells, fromColumn: string, toColumn: string): DateRange | null {
  const from = optionalDate(cells, fromColumn)
  const to = optionalDate(cells, toColumn)
  if (from === null && to === null) return null
  if (from === null || to === null) refuse(`${fromColumn} and ${toColumn} go together, and only one is filled`)
  if (to < from) refuse(`${toColumn} ${to} is before ${fromColumn} ${from}`)
  return { from, to }
}

export function optionalMoney(cells: Cells, column: string): Money | null {
  const cell = cells[column]
  if (cell === undefined) return null
  return moneyOf(cell) ?? refuse(`${column} "${textOf(cell)}" is not a number`)
}

export function requiredMoney(cells: Cells, column: string): Money {
  return optionalMoney(cells, column) ?? refuse(`no ${column}`)
}

export function positiveMoney(cells: Cells, column: string): Money {
  const money = requiredMoney(cells, column)
  return money > 0 ? money : refuse(`${column} must be more than zero`)
}

/** A year such as 2026, from a number cell or text. */
export function requiredYear(cells: Cells, column: string): number {
  const year = wholeNumberOf(cells[column])
  if (year === null || year < 1900 || year > 2100) {
    refuse(cells[column] === undefined ? `no ${column}` : `${column} "${textOf(cells[column])}" is not a year`)
  }
  return year
}

/** One of a fixed set of lower-case words. `noun` names what the word is, the column's name by default. */
export function requiredChoice<Choice extends string>(cells: Cells, column: string, choices: readonly Choice[], noun = column): Choice {
  const word = slugOf(cells[column])
  if (word === '') refuse(`no ${noun}`)
  return (choices as readonly string[]).includes(word) ? (word as Choice) : refuse(`"${word}" is not a ${noun}. Use ${choices.join(', ')}`)
}
