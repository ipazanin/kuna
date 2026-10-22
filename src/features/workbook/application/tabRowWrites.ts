import type { RecordId } from '../domain/recordId'
import type { RecordKind } from '../domain/recordKind'
import type { RowCells } from '../domain/rowChanges'
import type { TabReading } from '../infrastructure/cellReading'
import { recordIdOfRow } from '../infrastructure/tabRecords'
import type { FreshTabs, RowTab } from '../infrastructure/workbookWriter'
import type { SheetRow, WorkbookTab } from '../infrastructure/workbookSnapshot'
import { ID_COLUMN, TABS_WITH_IDS } from '../infrastructure/workbookTemplate'

/** A touched row: what it held and what it is to hold. `before` is null for an added row, `after` for a deleted one. */
export interface RowEdit {
  /** The record the row holds, by the key or id of what it held, or of what an added row is to hold. Null when those cells lack it. */
  readonly id: RecordId | null
  readonly before: RowCells | null
  readonly after: RowCells | null
}

/** The tab before and after a change, as the checks see it. */
export interface RowsChangeCheck {
  readonly before: readonly SheetRow[]
  readonly after: readonly SheetRow[]
  readonly edits: readonly RowEdit[]
  /** The rows of the tab the change leaves alone. */
  readonly untouched: readonly SheetRow[]
}

/** How one tab's rows are written: which columns, which other tabs the checks read, and what keeps the Sheet and its Apps Script valid. */
export interface TabRowRules {
  readonly tab: RowTab
  readonly kind: RecordKind
  /** The columns the app writes on the tab, its id aside. A row is checked against them before it is changed. */
  readonly columns: readonly string[]
  /** The columns the tab needs before anything is written. */
  readonly required: readonly string[]
  /** Columns compared without regard to case when a row is found again, as the readers read them. */
  readonly caseless: readonly string[]
  /** The other tabs the reader and the checks need. */
  readonly reads: readonly WorkbookTab[]
  /** The tab's own reader, against the other tabs as they are now. */
  read(rows: readonly SheetRow[], fresh: FreshTabs): TabReading<{ readonly id: RecordId }>
  /** Why the change would break the Sheet or what reads it, each a sentence. Empty when it may go ahead. */
  refusals(check: RowsChangeCheck, fresh: FreshTabs): readonly string[]
}

/** The touched rows as a tab's checks take them: what each held and holds, picked from its cells. */
export function editsOf<Picked>(
  check: RowsChangeCheck,
  pick: (cells: RowCells) => Picked,
): { readonly before: Picked | null; readonly after: Picked | null }[] {
  return check.edits.map((edit) => ({
    before: edit.before === null ? null : pick(edit.before),
    after: edit.after === null ? null : pick(edit.after),
  }))
}

/** The rows a change leaves alone, picked from their cells. */
export function untouchedOf<Picked>(check: RowsChangeCheck, pick: (cells: SheetRow['cells']) => Picked): Picked[] {
  return check.untouched.map((row) => pick(row.cells))
}

/**
 * A row's cells in the rule's columns, raw, a missing cell as blank, so a formula's value is compared
 * as the Sheet gives it. On a tab whose rows carry ids the row's id comes too, which a write finds it by.
 */
export function rowCellsOf(row: SheetRow, rules: TabRowRules): RowCells {
  const columns = (TABS_WITH_IDS as readonly WorkbookTab[]).includes(rules.tab) ? [...rules.columns, ID_COLUMN] : rules.columns
  return Object.fromEntries(columns.map((column) => [column, row.cells[column] ?? '']))
}

/** The cells the app read for a record, as a change or delete of it carries them, or null when the tab on screen no longer holds it once. */
export function storedCellsOf(rows: readonly SheetRow[], rules: TabRowRules, id: RecordId): RowCells | null {
  const holding = rows.filter((row) => recordIdOfRow(rules.tab, row.cells) === id)
  return holding.length === 1 ? rowCellsOf(holding[0]!, rules) : null
}
