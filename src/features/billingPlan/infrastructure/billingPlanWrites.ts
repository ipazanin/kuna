import { civilDateFromSerial, serialFromCivilDate } from '../../../shared/calendar/civilDate'
import { amountOf } from '../../../shared/money/money'
import { cellText } from '../../../shared/text/cellText'
import { WorkbookWriteRefused } from '../../workbook/application/workbookWriter'
import type { CellEdit, FreshTabs, TabEdits, TabRead } from '../../workbook/application/workbookWriter'
import { BILLING_PLAN_COLUMNS, readBillingPlan } from '../../workbook/infrastructure/billingPlanTabReader'
import { definedClientSlugs } from '../../workbook/infrastructure/workbookReader'
import type { CellValue, SheetRow } from '../../workbook/infrastructure/workbookSnapshot'
import type { BillingItemDraft } from '../domain/fillRestOfYear'

type BillingColumn = (typeof BILLING_PLAN_COLUMNS)[number]

/** The five cells of one `outgoing-plan` row, a blank cell as an empty string. */
export type BillingCells = Readonly<Record<BillingColumn, CellValue>>

/** A row of the tab as the app read it or wrote it. */
export interface BillingRowCells {
  readonly sheetRow: number
  readonly cells: BillingCells
}

/** Rows written or cleared, which Undo clears or writes again. */
export interface BillingRowsReceipt {
  readonly rows: readonly BillingRowCells[]
}

/** One row changed in place: what it held and what it holds now. */
export interface BillingRowChange {
  readonly sheetRow: number
  readonly before: BillingCells
  readonly after: BillingCells
}

export interface BillingRowsAppendPlan {
  readonly edits: TabEdits
  readonly rows: readonly BillingCells[]
  /** Rows that already held one of the new rows' cells, so the new ones can be told apart after the write. */
  readonly alreadyThere: readonly number[]
}

/** A row to add, as the tab holds it: the date as a serial number, so the cell is a date cell like one typed in the Sheet. */
export function billingCellsOf(draft: BillingItemDraft): BillingCells {
  return {
    item: draft.item.trim(),
    date: serialFromCivilDate(draft.date),
    amount: amountOf(draft.amount),
    client: draft.client.trim().toLowerCase(),
    description: draft.description.trim(),
  }
}

/** The five cells of a row read from the tab, raw, so a formula's value is compared as the Sheet gives it. */
export function billingCellsOfRow(row: SheetRow): BillingCells {
  return Object.fromEntries(BILLING_PLAN_COLUMNS.map((column) => [column, row.cells[column] ?? ''])) as BillingCells
}

/**
 * Appends the rows below the last one. Refused unless the tab has the five columns and each row
 * reads cleanly by the tab's own reader, against the clients tab as it is now.
 */
export function planBillingRowsAppend(fresh: FreshTabs, rows: readonly BillingCells[]): BillingRowsAppendPlan {
  const tab = requireBillingTab(fresh)
  refuseOn(rows.flatMap((cells) => rowProblems(fresh, cells).map((problem) => `${describe(cells)}: ${problem}.`)))
  return {
    edits: { cells: [], appends: rows.map((cells) => ({ tab: 'outgoing-plan', cells })) },
    rows,
    alreadyThere: tab.rows.filter((row) => rows.some((cells) => holds(row, cells))).map((row) => row.sheetRow),
  }
}

/** After the write: each new row is on the tab as many times more as it was written. Returns what Undo clears. */
export function verifyBillingRowsAppend(after: FreshTabs, plan: BillingRowsAppendPlan): BillingRowsReceipt {
  const rows = requireBillingTab(after).rows
  const taken = new Set<number>()
  const written = plan.rows.map((cells): BillingRowCells => {
    const row = rows.find((candidate) => holds(candidate, cells) && !plan.alreadyThere.includes(candidate.sheetRow) && !taken.has(candidate.sheetRow))
    if (row === undefined) {
      throw new Error(`The write reached the workbook, but ${describe(cells)} does not read back as written. Check the outgoing-plan tab.`)
    }
    taken.add(row.sheetRow)
    return { sheetRow: row.sheetRow, cells }
  })
  return { rows: written }
}

/**
 * Clears the five cells of each row: on its own row if that still holds what the app read, else
 * on the one row that does. Refused when none or several do. Cells beside them, such as the Sheet's
 * own formulas, are left alone.
 */
export function planBillingRowsRemoval(fresh: FreshTabs, receipt: BillingRowsReceipt): { readonly edits: TabEdits; readonly receipt: BillingRowsReceipt } {
  const tab = requireBillingTab(fresh)
  const refusals: string[] = []
  const located: SheetRow[] = []
  for (const target of receipt.rows) {
    const row = locate(tab, target)
    if (typeof row === 'string') {
      refusals.push(row)
    } else if (located.some((earlier) => earlier.sheetRow === row.sheetRow)) {
      refusals.push(`Row ${row.sheetRow} is asked to be cleared twice in one write.`)
    } else {
      located.push(row)
    }
  }
  refuseOn(refusals)
  return {
    edits: {
      cells: located.flatMap((row) =>
        BILLING_PLAN_COLUMNS.filter((column) => cellText(row.cells[column]) !== '').map((column): CellEdit => ({ tab: 'outgoing-plan', sheetRow: row.sheetRow, column, value: '' })),
      ),
      appends: [],
    },
    receipt: { rows: located.map((row) => ({ sheetRow: row.sheetRow, cells: billingCellsOfRow(row) })) },
  }
}

/** After the write: the cleared rows hold none of the five cells. */
export function verifyBillingRowsRemoval(after: FreshTabs, receipt: BillingRowsReceipt): void {
  const cleared = new Set(receipt.rows.map((row) => row.sheetRow))
  const leftOver = requireBillingTab(after).rows.find((row) => cleared.has(row.sheetRow) && BILLING_PLAN_COLUMNS.some((column) => cellText(row.cells[column]) !== ''))
  if (leftOver !== undefined) {
    throw new Error(`The write reached the workbook, but row ${leftOver.sheetRow} of the outgoing-plan tab still holds the plan row. Check it in the Sheet.`)
  }
}

/**
 * Changes one row in place, found as the removal finds it, writing only the cells that differ.
 * Refused unless the row afterwards reads cleanly by the tab's own reader.
 */
export function planBillingRowChange(fresh: FreshTabs, change: BillingRowChange): { readonly edits: TabEdits; readonly change: BillingRowChange } {
  const tab = requireBillingTab(fresh)
  const row = locate(tab, { sheetRow: change.sheetRow, cells: change.before })
  if (typeof row === 'string') {
    throw new WorkbookWriteRefused(`Nothing was written. ${row}`)
  }
  refuseOn(rowProblems(fresh, change.after).map((problem) => `Row ${row.sheetRow} would not read: ${problem}.`))
  const cells = BILLING_PLAN_COLUMNS.filter((column) => cellText(row.cells[column]) !== cellText(change.after[column])).map(
    (column): CellEdit => ({ tab: 'outgoing-plan', sheetRow: row.sheetRow, column, value: change.after[column] }),
  )
  return { edits: { cells, appends: [] }, change: { sheetRow: row.sheetRow, before: billingCellsOfRow(row), after: change.after } }
}

/** After the write: the row holds what was written. */
export function verifyBillingRowChange(after: FreshTabs, change: BillingRowChange): void {
  const row = requireBillingTab(after).rows.find((candidate) => candidate.sheetRow === change.sheetRow)
  if (row === undefined || !holds(row, change.after)) {
    throw new Error(`The write reached the workbook, but row ${change.sheetRow} of the outgoing-plan tab does not read back as written. Check it in the Sheet.`)
  }
}

function requireBillingTab(fresh: FreshTabs): TabRead {
  const tab = fresh['outgoing-plan']
  if (tab === undefined) {
    throw new WorkbookWriteRefused('The workbook has no outgoing-plan tab, so nothing was written.')
  }
  const missing = BILLING_PLAN_COLUMNS.filter((column) => !tab.header.some((name) => name.trim() === column))
  if (missing.length > 0) {
    throw new WorkbookWriteRefused(`The outgoing-plan tab has no ${missing.map((column) => `"${column}"`).join(', ')} column, so nothing was written.`)
  }
  return tab
}

/** Why the tab's reader would leave the row out, against the clients tab as it is now. */
function rowProblems(fresh: FreshTabs, cells: BillingCells): string[] {
  const filled = Object.fromEntries(Object.entries(cells).filter(([, cell]) => cellText(cell) !== ''))
  return readBillingPlan([{ sheetRow: 0, cells: filled }], definedClientSlugs(fresh.clients?.rows ?? [])).problems.map((problem) => problem.reason)
}

/** The row the target names, or why there is not exactly one. */
function locate(tab: TabRead, target: BillingRowCells): SheetRow | string {
  const holding = tab.rows.filter((row) => holds(row, target.cells))
  const row = holding.find((candidate) => candidate.sheetRow === target.sheetRow) ?? (holding.length === 1 ? holding[0] : undefined)
  if (row !== undefined) {
    return row
  }
  return holding.length === 0
    ? `${describe(target.cells)} is no longer on the outgoing-plan tab as the app read it. Sync and look again.`
    : `${holding.length} rows of the outgoing-plan tab hold ${describe(target.cells)} (rows ${holding.map((candidate) => candidate.sheetRow).join(', ')}), so the app cannot tell which one is meant. Change it in the Sheet.`
}

function holds(row: SheetRow, cells: BillingCells): boolean {
  return BILLING_PLAN_COLUMNS.every((column) =>
    column === 'client' ? cellText(row.cells[column]).toLowerCase() === cellText(cells[column]).toLowerCase() : cellText(row.cells[column]) === cellText(cells[column]),
  )
}

function describe(cells: BillingCells): string {
  const date = typeof cells.date === 'number' && Number.isFinite(cells.date) ? ` dated ${civilDateFromSerial(cells.date)}` : ''
  return `The "${cellText(cells.item) || 'blank'}" row of ${cellText(cells.client) || 'no client'}${date}`
}

function refuseOn(refusals: readonly string[]): void {
  if (refusals.length > 0) {
    throw new WorkbookWriteRefused(`Nothing was written. ${refusals.join(' ')}`)
  }
}
