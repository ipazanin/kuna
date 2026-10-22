/** A cell as a tab holds it: text, a number (dates as serial days) or a checkbox. An empty string is a blank cell. */
type Cell = string | number | boolean

/** A row's cells in the columns the app writes on its tab, keyed by header, a blank as an empty string. */
export type RowCells = Readonly<Record<string, Cell>>

/** One row changed in place: what it held as the app read it and what it is to hold. */
export interface RowChange {
  readonly before: RowCells
  readonly after: RowCells
}

/**
 * Rows added to one tab, changed in place and deleted, as one write. A row to change or delete
 * carries what the app read on it. The write finds it by the key or id those cells hold, and
 * refuses when it no longer holds them.
 */
export interface TabRowsChange {
  readonly added: readonly RowCells[]
  readonly changed: readonly RowChange[]
  readonly removed: readonly RowCells[]
}

/** What a write did, which Undo turns around: rows added with the ids they were given, rows changed, and rows deleted with every cell they held. */
export type TabRowsReceipt = TabRowsChange

/** The change that puts back what a write did: its added rows taken out again, its deleted rows added back with the same key or id, its changed rows as they were. */
export function undoOfRows(receipt: TabRowsReceipt): TabRowsChange {
  return {
    added: receipt.removed,
    changed: receipt.changed.map((change) => ({ before: change.after, after: change.before })),
    removed: receipt.added,
  }
}
