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
  /** Where the row this draft was read from stands among the rows the editor opened with, or null for a row added in the editor. */
  readonly saved: number | null
  readonly fields: Readonly<Record<string, string>>
}

export function kindOfColumn(column: DraftColumn, fieldOf: FieldReader): DraftCellKind {
  return column.kindOf?.(fieldOf) ?? column.kind
}

/** The drafts of a tab's rows, in the order the rows are given. */
export function draftsOfRows(rows: readonly { readonly cells: Cells }[], columns: readonly DraftColumn[]): TabRowDraft[] {
  return rows.map((row, saved) => {
    const fieldOf: FieldReader = (column) => String(row.cells[column] ?? '').trim().toLowerCase()
    const fields = Object.fromEntries(columns.map((column) => [column.name, draftTextOf(row.cells[column.name], kindOfColumn(column, fieldOf))]))
    return { saved, fields }
  })
}

/** The tab's cells for the drafts. Cells of other columns on a saved row are kept, and a blank field clears its cell. */
export function cellsOfDrafts(drafts: readonly TabRowDraft[], columns: readonly DraftColumn[], savedCells: ReadonlyMap<number, Cells>): Record<string, Cell>[] {
  return drafts.map((draft) => {
    const fieldOf: FieldReader = (column) => (draft.fields[column] ?? '').trim().toLowerCase()
    return {
      ...(draft.saved === null ? {} : (savedCells.get(draft.saved) ?? {})),
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
 * at the foot, and a row no draft holds any more is deleted. A changed or deleted row carries every
 * cell it was read with, its id among them, so the write finds it by its key or id. `opened` is the
 * cells each row's draft gave when the editor opened, by the row's place among `rows`.
 */
export function rowsChangeOf(
  rows: readonly { readonly cells: Cells }[],
  columns: readonly string[],
  drafted: readonly { readonly saved: number | null; readonly cells: Cells }[],
  opened: ReadonlyMap<number, Cells>,
): TabRowsChange {
  const inColumns = (cells: Cells): RowCells => Object.fromEntries(columns.map((column) => [column, cells[column] ?? '']))
  const kept = new Set(drafted.flatMap((draft) => (draft.saved === null ? [] : [draft.saved])))
  return {
    added: drafted.filter((draft) => draft.saved === null).map((draft) => inColumns(draft.cells)),
    changed: drafted.flatMap((draft) => {
      const row = draft.saved === null ? undefined : rows[draft.saved]
      if (row === undefined || draft.saved === null) return []
      const before = { ...row.cells, ...inColumns(row.cells) }
      const original = opened.get(draft.saved) ?? {}
      const after = Object.fromEntries(columns.map((column) => [column, cellText(draft.cells[column]) === cellText(original[column]) ? before[column]! : (draft.cells[column] ?? '')]))
      return columns.some((column) => cellText(after[column]) !== cellText(before[column])) ? [{ before, after }] : []
    }),
    removed: rows.filter((_, saved) => !kept.has(saved)).map((row) => ({ ...row.cells, ...inColumns(row.cells) })),
  }
}
