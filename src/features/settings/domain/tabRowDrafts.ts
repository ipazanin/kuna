import { civilDateFromSerial, parseCivilDate, serialFromCivilDate } from '../../../shared/calendar/civilDate'
import { cellText } from '../../../shared/text/cellText'
import { normaliseIban } from '../../../shared/text/fold'
import type { RowCells, TabRowsChange } from '../../workbook/domain/rowChanges'

type Cell = string | number | boolean
type Cells = Readonly<Record<string, Cell>>

/**
 * What an editor field holds and how its text becomes a cell. A word is stored in lower case, a
 * date as a date cell, a percent typed as 10 as 0.1, a flag as TRUE or blank, an IBAN without its
 * grouping spaces, and `amount-or-word` takes a number or a keyword such as whole.
 */
export type DraftCellKind = 'text' | 'word' | 'date' | 'amount' | 'whole-number' | 'percent' | 'flag' | 'amount-or-word' | 'iban'

/** Reads another field of the same row as lower-case text, so a field's kind can follow it. */
export type FieldReader = (column: string) => string

export interface DraftColumn {
  readonly name: string
  readonly kind: DraftCellKind
  /** Overrides `kind` for a column whose cell type depends on the rest of the row. */
  readonly kindOf?: (fieldOf: FieldReader) => DraftCellKind
}

/** One row of a tab editor, as the text in its fields. */
export interface TabRowDraft {
  /** The row number this draft was read from, or null for a row added in the editor. */
  readonly sheetRow: number | null
  readonly fields: Readonly<Record<string, string>>
}

export function kindOfColumn(column: DraftColumn, fieldOf: FieldReader): DraftCellKind {
  return column.kindOf?.(fieldOf) ?? column.kind
}

/** The drafts of a tab's rows, in tab order. */
export function draftsOfRows(rows: readonly { readonly sheetRow: number; readonly cells: Cells }[], columns: readonly DraftColumn[]): TabRowDraft[] {
  return [...rows]
    .sort((upper, lower) => upper.sheetRow - lower.sheetRow)
    .map((row) => {
      const fieldOf: FieldReader = (column) => String(row.cells[column] ?? '').trim().toLowerCase()
      const fields = Object.fromEntries(columns.map((column) => [column.name, draftTextOf(row.cells[column.name], kindOfColumn(column, fieldOf))]))
      return { sheetRow: row.sheetRow, fields }
    })
}

/** The tab's cells for the drafts. Cells of other columns on a saved row are kept, and a blank field clears its cell. */
export function cellsOfDrafts(drafts: readonly TabRowDraft[], columns: readonly DraftColumn[], savedCells: ReadonlyMap<number, Cells>): Record<string, Cell>[] {
  return drafts.map((draft) => {
    const fieldOf: FieldReader = (column) => (draft.fields[column] ?? '').trim().toLowerCase()
    return {
      ...(draft.sheetRow === null ? {} : (savedCells.get(draft.sheetRow) ?? {})),
      ...Object.fromEntries(columns.map((column) => [column.name, cellOfDraftText(draft.fields[column.name] ?? '', kindOfColumn(column, fieldOf))])),
    }
  })
}

export function draftTextOf(cell: Cell | undefined, kind: DraftCellKind): string {
  if (cell === undefined) return ''
  switch (kind) {
    case 'date':
      return typeof cell === 'number' && Number.isFinite(cell) ? civilDateFromSerial(cell) : String(cell)
    case 'percent':
      return typeof cell === 'number' ? String(Math.round(cell * 1_000_000) / 10_000) : String(cell)
    case 'flag':
      return cell === true || String(cell).trim().toLowerCase() === 'true' ? 'TRUE' : ''
    default:
      return String(cell)
  }
}

/**
 * The cell a field's text becomes. Text that does not fit the kind is kept as text, so the tab's
 * reader reports it the way it would report it in the file.
 */
export function cellOfDraftText(text: string, kind: DraftCellKind): Cell {
  const trimmed = text.trim()
  if (trimmed === '') return ''
  const number = Number(trimmed)
  switch (kind) {
    case 'date': {
      const date = parseCivilDate(trimmed)
      return date === null ? trimmed : serialFromCivilDate(date)
    }
    case 'amount':
    case 'whole-number':
      return Number.isFinite(number) ? number : trimmed
    case 'percent':
      return Number.isFinite(number) ? number / 100 : trimmed
    case 'flag':
      return trimmed === 'TRUE'
    case 'amount-or-word':
      return Number.isFinite(number) ? number : trimmed.toLowerCase()
    case 'word':
      return trimmed.toLowerCase()
    case 'iban':
      return normaliseIban(trimmed)
    case 'text':
      return trimmed
  }
}

/**
 * The change an editor's drafts make to the tab's rows. A field left as it was keeps the cell the
 * tab holds, so a formula is never written over with its own value. A draft without a row is added
 * at the foot, and a row no draft holds any more is deleted. `opened` is the cells each row's draft
 * gave when the editor opened, by row.
 */
export function rowsChangeOf(
  rows: readonly { readonly sheetRow: number; readonly cells: Cells }[],
  columns: readonly string[],
  drafted: readonly { readonly sheetRow: number | null; readonly cells: Cells }[],
  opened: ReadonlyMap<number, Cells>,
): TabRowsChange {
  const inColumns = (cells: Cells): RowCells => Object.fromEntries(columns.map((column) => [column, cells[column] ?? '']))
  const kept = new Set(drafted.flatMap((draft) => (draft.sheetRow === null ? [] : [draft.sheetRow])))
  return {
    added: drafted.filter((draft) => draft.sheetRow === null).map((draft) => inColumns(draft.cells)),
    changed: drafted.flatMap((draft) => {
      const row = draft.sheetRow === null ? undefined : rows.find((candidate) => candidate.sheetRow === draft.sheetRow)
      if (row === undefined) return []
      const before = inColumns(row.cells)
      const original = opened.get(row.sheetRow) ?? {}
      const after = Object.fromEntries(columns.map((column) => [column, cellText(draft.cells[column]) === cellText(original[column]) ? before[column]! : (draft.cells[column] ?? '')]))
      return columns.some((column) => cellText(after[column]) !== cellText(before[column])) ? [{ sheetRow: row.sheetRow, before, after }] : []
    }),
    removed: rows.filter((row) => !kept.has(row.sheetRow)).map((row) => ({ sheetRow: row.sheetRow, cells: inColumns(row.cells) })),
  }
}
