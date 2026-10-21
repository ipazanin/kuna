/** A cell as a tab holds it: text, a number (dates as serial days) or a checkbox. An empty string is a blank cell. */
type Cell = string | number | boolean

/** A row's cells in the columns the app writes on its tab, keyed by header, a blank as an empty string. */
export type RowCells = Readonly<Record<string, Cell>>

export interface RowAt {
  readonly sheetRow: number
  readonly cells: RowCells
}

/** One row changed in place: what it held and what it is to hold. */
export interface RowChange {
  readonly sheetRow: number
  readonly before: RowCells
  readonly after: RowCells
}

/**
 * Rows added at the foot of one tab, changed in place and deleted, as one write. A row to change or
 * delete carries what the app read on it, so the write can find it again and refuse when it moved
 * on since. A deleted row is taken out, so the rows below it move up.
 */
export interface TabRowsChange {
  readonly added: readonly RowCells[]
  readonly changed: readonly RowChange[]
  readonly removed: readonly RowAt[]
  /** Rows put back on the row each stood on, the rows from there down moving down, as Undo puts back deleted rows. */
  readonly restored?: readonly RowAt[]
}

/** What a write did, each row where it is now, a deleted row where it stood, which Undo turns around. */
export interface TabRowsReceipt {
  readonly added: readonly RowAt[]
  readonly changed: readonly RowChange[]
  readonly removed: readonly RowAt[]
}

/** The change that puts back what a write did: its added rows taken out again, its deleted rows put back where they stood, its changed rows as they were. */
export function undoOfRows(receipt: TabRowsReceipt): TabRowsChange {
  return {
    added: [],
    changed: receipt.changed.map((change) => ({ sheetRow: change.sheetRow, before: change.after, after: change.before })),
    removed: receipt.added,
    restored: receipt.removed,
  }
}
