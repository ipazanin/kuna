import { cellText } from '../../../shared/text/cellText'
import { newRecordId } from '../domain/recordId'
import type { SheetRow, WorkbookTab } from '../infrastructure/workbookSnapshot'
import { ID_COLUMN, TABS_WITH_IDS } from '../infrastructure/workbookTemplate'
import type { CellEdit, FreshTabs, NewColumn, TabEdits } from './workbookWriter'

/** How many rows of one tab have no id yet. */
export interface RowsWithoutIds {
  readonly tab: (typeof TABS_WITH_IDS)[number]
  readonly rows: number
}

/** Each tab whose rows carry an id and that holds rows without one, in the template's order. */
export function rowsWithoutIds(tabs: Partial<Record<WorkbookTab, readonly SheetRow[]>>): RowsWithoutIds[] {
  return TABS_WITH_IDS.flatMap((tab) => {
    const rows = (tabs[tab] ?? []).filter(lacksId).length
    return rows === 0 ? [] : [{ tab, rows }]
  })
}

/** The ids one write gives, each on the row of the read it was planned on. */
export interface IdsPlan {
  readonly edits: TabEdits
  readonly given: readonly CellEdit[]
  /** The rows without an id the read found, which the write gives one. */
  readonly lacking: readonly RowsWithoutIds[]
}

/**
 * A new id on every row of these tabs that has none, and the id column on a tab that lacks it, all
 * in one write. Rows that already carry an id keep it.
 */
export function planMissingIds(fresh: FreshTabs): IdsPlan {
  const lacking = rowsWithoutIds(Object.fromEntries(Object.entries(fresh).map(([tab, read]) => [tab, read.rows])))
  const given = lacking.flatMap(({ tab }) =>
    fresh[tab]!.rows.filter(lacksId).map((row): CellEdit => ({ tab, sheetRow: row.sheetRow, column: ID_COLUMN, value: newRecordId() })),
  )
  const newColumns = lacking.filter(({ tab }) => !fresh[tab]!.header.some((name) => name.trim() === ID_COLUMN)).map(({ tab }): NewColumn => ({ tab, column: ID_COLUMN }))
  return { edits: { cells: given, appends: [], newColumns }, given, lacking }
}

/** After the write: every row given an id holds it. */
export function verifyMissingIds(after: FreshTabs, plan: IdsPlan): void {
  for (const edit of plan.given) {
    const row = after[edit.tab]?.rows.find((candidate) => candidate.sheetRow === edit.sheetRow)
    if (row === undefined || cellText(row.cells[ID_COLUMN]) !== edit.value) {
      throw new Error(`The write reached the workbook, but row ${edit.sheetRow} of the ${edit.tab} tab does not hold the id written to it. Check the tab and its version history.`)
    }
  }
}

function lacksId(row: SheetRow): boolean {
  return cellText(row.cells[ID_COLUMN]) === ''
}
