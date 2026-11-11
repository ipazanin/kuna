import { KEY_SHAPE } from '../domain/keyShape'
import { ACCOUNT_TAGGED, KEY_REMOVED, cutCell, holdsIdentifier, namesIdentifiers } from '../domain/fileCells'
import type { CellSheet, ReadRange } from '../domain/chatAttachments'
import type { ChatReads } from './chatReads'

/** A file's rows as they leave, and how many cells shaped like a key went as `[key removed]`. */
export interface CellsLeaving {
  readonly rows: readonly (readonly string[])[]
  readonly keysRemoved: number
}

/** How far down a sheet Kuna looks for the row that heads its columns, past a bank's lines about the account. */
const HEADER_WITHIN = 30

/** The row that heads a table's columns: the one with the most filled cells near the top, so a title line such as `Izvod po računu` never counts. */
function headerRowOf(sheet: CellSheet): number {
  let best = -1
  let mostFilled = 0
  sheet.rows.slice(0, HEADER_WITHIN).forEach((row, at) => {
    const filled = row.filter((cell) => cell !== '').length
    if (filled > mostFilled) {
      best = at
      mostFilled = filled
    }
  })
  return best
}

/**
 * Which cells of a row go whole under a token: in a table, those under a header that names identifiers. In `path, value`
 * rows, the value whose own path names one. In lines, none, as the account's tag marks it inside the line.
 */
function identifierCells(sheet: CellSheet, row: readonly string[], rowAt: number, identifierColumns: ReadonlySet<number>, headerAt: number): ReadonlySet<number> {
  switch (sheet.layout) {
    case 'table':
      return rowAt > headerAt ? identifierColumns : new Set()
    case 'paths':
      return namesIdentifiers(row[0] ?? '') ? new Set([1]) : new Set()
    default:
      return new Set()
  }
}

/**
 * One row as it leaves. A key's shape replaces the whole cell. An identifier's cell goes whole under one token. Every
 * other cell has each IBAN and OIB under a token Kuna can restore and each card and domestic account number masked.
 * While Anonymise is on, each person Kuna knows goes under their alias, employees too, even when the name is split
 * across cells. Then each cell is cut.
 */
function rowLeaving(row: readonly string[], identifiers: ReadonlySet<number>, reads: ChatReads): { readonly cells: readonly string[]; readonly keysRemoved: number } {
  let keysRemoved = 0
  const tokened = row.map((cell, column) => {
    if (cell === '') return cell
    if (KEY_SHAPE.test(cell)) {
      keysRemoved += 1
      return KEY_REMOVED
    }
    if (identifiers.has(column) && holdsIdentifier(cell)) return reads.pseudonyms.identifierToken(cell)
    return cell.replace(ACCOUNT_TAGGED, (_tagged, tag: string, account: string) => `${tag}${reads.pseudonyms.identifierToken(account)}`)
  })
  const aliased = reads.anonymising() ? reads.pseudonyms.pseudonymisedRow(tokened) : tokened.map((cell) => reads.pseudonyms.identifiersTokened(cell, 'written'))
  return { cells: aliased.map(cutCell), keysRemoved }
}

/** A text of a file outside its rows, such as a sheet's name, as it leaves: as a row of one cell that names no identifier. */
export function fileTextLeaving(text: string, reads: ChatReads): string {
  return rowLeaving([text], new Set(), reads).cells[0] ?? ''
}

/** The rows of a sheet from `first` to `last`, counted from 1, as they leave, cell by cell. */
export function cellsLeaving(sheet: CellSheet, range: ReadRange, reads: ChatReads): CellsLeaving {
  if (reads.anonymising()) reads.pseudonyms.know(reads.persons().map((person) => person.name))
  const headerAt = sheet.layout === 'table' ? headerRowOf(sheet) : -1
  const identifierColumns = new Set((sheet.rows[headerAt] ?? []).flatMap((name, column) => (namesIdentifiers(name) ? [column] : [])))
  let keysRemoved = 0
  const rows = sheet.rows.slice(range.first - 1, range.last).map((row, offset) => {
    const leaving = rowLeaving(row, identifierCells(sheet, row, range.first - 1 + offset, identifierColumns, headerAt), reads)
    keysRemoved += leaving.keysRemoved
    return leaving.cells
  })
  return { rows, keysRemoved }
}
