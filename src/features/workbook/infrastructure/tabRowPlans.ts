import { cellText } from '../../../shared/text/cellText'
import { rowCellsOf } from '../application/tabRowWrites'
import type { RowEdit, TabRowRules } from '../application/tabRowWrites'
import { WorkbookWriteRefused } from '../application/workbookWriteRefused'
import { newRecordId } from '../domain/recordId'
import type { RowCells, RowChange, TabRowsChange, TabRowsReceipt } from '../domain/rowChanges'
import { recordOutcome } from './cellReading'
import { placeLedgerRows } from './ledgerPlacement'
import { labelOfRow, recordIdOfRow } from './tabRecords'
import type { SheetRow, WorkbookTab } from './workbookSnapshot'
import { ID_COLUMN, TABS_WITH_IDS, TEMPLATE_COLUMNS } from './workbookTemplate'
import type { CellEdit, FreshTabs, RowAppend, TabEdits, TabRead } from './workbookWriter'

/** A change planned on a read taken just before it, with each row found where it is now. */
export interface RowsPlan {
  readonly edits: TabEdits
  /** What the write does, which Undo turns around. */
  readonly receipt: TabRowsReceipt
  /** The tab's rows as read just before the write. */
  readonly before: readonly SheetRow[]
}

function carriesIds(tab: WorkbookTab): boolean {
  return (TABS_WITH_IDS as readonly WorkbookTab[]).includes(tab)
}

/** "the invoice "1-1-26"", as a refusal names a record. */
function named(rules: TabRowRules, cells: RowCells): string {
  return `the ${rules.kind.noun.one} "${labelOfRow(rules.tab, cells)}"`
}

function capitalised(text: string): string {
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`
}

/**
 * Finds every row to change or delete again by the key or id it held when the app read it, and
 * refuses when none or several rows hold it, or the row found no longer holds what the app read. A
 * row without its key is found by what it held. The tab as the change would leave it must read as
 * cleanly as it does now by the tab's own reader, and pass the tab's checks. A changed row writes
 * only the cells that differ, so a formula left alone stays a formula. A deleted row is taken out
 * whole, so no blank row is left. Added rows go below the last row, and on the ledger where their
 * dates put them.
 * On a tab whose rows carry an id, an added row without one gets a new one, a changed or deleted row
 * keeps its id for Undo, and a tab without the id column gets it in the same write.
 * With `addMissingTab`, which the person must have agreed to, a tab the workbook lacks is added with
 * the template's header first.
 */
export function planRowsChange(fresh: FreshTabs, rules: TabRowRules, change: TabRowsChange, addMissingTab = false): RowsPlan {
  const added = carriesIds(rules.tab) ? change.added.map((cells) => (cellText(cells[ID_COLUMN]) === '' ? { ...cells, [ID_COLUMN]: newRecordId() } : cells)) : change.added
  const newTab = addMissingTab && fresh[rules.tab] === undefined ? { tab: rules.tab, header: TEMPLATE_COLUMNS[rules.tab].map((column) => column.name) } : null
  const tab = newTab === null ? requireRowTab(fresh, rules) : { header: newTab.header, rows: [], lastRow: 1 }
  const header = new Set(tab.header.map((name) => name.trim()))
  const refusals: string[] = []
  const taken = new Set<SheetRow>()
  const locateEach = <Target>(targets: readonly Target[], cellsOf: (target: Target) => RowCells) =>
    targets.flatMap((target) => {
      const row = locate(tab, rules, cellsOf(target))
      if (typeof row === 'string') {
        refusals.push(row)
        return []
      }
      if (taken.has(row)) {
        refusals.push(`${capitalised(named(rules, cellsOf(target)))} is asked to change twice in one write.`)
        return []
      }
      taken.add(row)
      return [{ row, target }]
    })
  const changed = locateEach(change.changed, (target) => target.before).map(({ row, target }) => ({ row, after: { ...rowCellsOf(row, rules), ...target.after } }))
  const removed = locateEach(change.removed, (cells) => cells).map(({ row }) => row)
  const written = [...added, ...change.changed.map((target) => target.after)]
  const missing = [...new Set(written.flatMap((cells) => rules.columns.filter((column) => !header.has(column) && cellText(cells[column]) !== '')))]
  const newColumn = carriesIds(rules.tab) && !header.has(ID_COLUMN) && written.some((cells) => cellText(cells[ID_COLUMN]) !== '') ? { tab: rules.tab, column: ID_COLUMN } : null
  if (missing.length > 0) {
    refusals.push(`The ${rules.tab} tab has no ${quotedList(missing)} column for what this change writes. Add the column to row 1 in the Sheet, or leave the field blank.`)
  }
  refuseOn(refusals)

  const foot = tab.lastRow + 1
  const placed = rules.tab === 'ledger' ? placeLedgerRows(tab.rows, added, tab.lastRow) : added.map((_, index) => ({ index, before: foot }))
  const inPlace = placed.filter((place) => place.before !== foot)
  const atFoot = placed.filter((place) => place.before === foot)
  const deleted = removed.map((row) => row.sheetRow)
  // The rows move in the order the writers carry out a write: deletions first, then the placed rows.
  const closedUp = (sheetRow: number): number => sheetRow - deleted.filter((other) => other < sheetRow).length
  const insertedAt = insertedRowNumbers(inPlace.map((place) => closedUp(place.before)))

  const afterOf = new Map(changed.map(({ row, after }) => [row, after]))
  const untouched = tab.rows.filter((row) => !taken.has(row))
  const afterRows: SheetRow[] = [
    ...tab.rows
      .filter((row) => !removed.includes(row))
      .map((row) => {
        const after = afterOf.get(row)
        return after === undefined ? row : { sheetRow: row.sheetRow, cells: withCells(row.cells, rules.columns, after) }
      }),
    ...added.map((cells, index) => ({ sheetRow: foot + index, cells: filledCells(cells) })),
  ]
  const edits: RowEdit[] = [
    ...changed.map(({ row, after }) => ({ id: recordIdOfRow(rules.tab, row.cells), before: rowCellsOf(row, rules), after })),
    ...removed.map((row) => ({ id: recordIdOfRow(rules.tab, row.cells), before: rowCellsOf(row, rules), after: null })),
    ...added.map((cells) => ({ id: recordIdOfRow(rules.tab, cells), before: null, after: cells })),
  ]
  // The tab's own checks name the cause, so the reader's account of the same row is held back until they pass.
  refuseOn(rules.refusals({ before: tab.rows, after: afterRows, edits, untouched }, fresh))
  refuseOn(readerRefusals(rules, tab.rows, afterRows, untouched, changed, added, fresh))

  const cells: CellEdit[] = changed.flatMap(({ row, after }) =>
    rules.columns
      .filter((column) => cellText(row.cells[column]) !== cellText(after[column]))
      .map((column): CellEdit => ({ tab: rules.tab, sheetRow: row.sheetRow, column, value: after[column] ?? '' })),
  )
  const appends: RowAppend[] = [
    ...inPlace.map(({ index }, order) => ({ tab: rules.tab, cells: filledCells(added[index]!), at: insertedAt[order]! })),
    ...atFoot.map(({ index }) => ({ tab: rules.tab, cells: filledCells(added[index]!) })),
  ]
  const deletions = deleted.map((sheetRow) => ({ tab: rules.tab, sheetRow }))
  return {
    edits: {
      cells,
      appends,
      ...(deletions.length === 0 ? {} : { deletions }),
      ...(newTab === null ? {} : { newTabs: [newTab] }),
      ...(newColumn === null ? {} : { newColumns: [newColumn] }),
    },
    receipt: {
      added,
      changed: changed.map(({ row, after }): RowChange => ({ before: rowCellsOf(row, rules), after })),
      removed: removed.map((row) => rowCellsOf(row, rules)),
    },
    before: tab.rows,
  }
}

/** The row each row put in lands on once all of them are in, given the row each goes above. Rows sharing a place keep their order. */
function insertedRowNumbers(befores: readonly number[]): number[] {
  return befores.map((before, index) => before + befores.filter((other, otherIndex) => other < before || (other === before && otherIndex < index)).length)
}

/**
 * After the write: each changed row holds what was written, each deleted row is gone, and each added
 * row is on the tab, each by as many rows as the write leaves holding its cells. Returns the receipt.
 */
export function verifyRowsChange(after: FreshTabs, rules: TabRowRules, plan: RowsPlan): TabRowsReceipt {
  const rows = requireRowTab(after, rules).rows
  const { receipt } = plan
  const holdingNow = (cells: RowCells): number => rows.filter((row) => holds(row, cells, rules)).length
  const expected = (cells: RowCells): number =>
    plan.before.filter((row) => holds(row, cells, rules)).length +
    receipt.added.filter((other) => sameCells(other, cells, rules)).length -
    receipt.removed.filter((other) => sameCells(other, cells, rules)).length
  for (const change of receipt.changed) {
    if (holdingNow(change.after) === 0) {
      throw new Error(`The write reached the workbook, but ${named(rules, change.after)} does not read back as written. Check the ${rules.tab} tab.`)
    }
  }
  for (const cells of receipt.removed) {
    if (holdingNow(cells) > expected(cells)) {
      throw new Error(`The write reached the workbook, but the ${rules.tab} tab still holds ${named(rules, cells)}. Check it in the Sheet.`)
    }
  }
  for (const cells of receipt.added) {
    if (holdingNow(cells) < expected(cells)) {
      throw new Error(`The write reached the workbook, but ${named(rules, cells)} does not read back as written. Check the ${rules.tab} tab.`)
    }
  }
  return receipt
}

/**
 * What the reader would say once the change is made: a problem on a record the change writes that
 * it did not have before, and a record it leaves alone that is read today and would be left out.
 */
function readerRefusals(
  rules: TabRowRules,
  before: readonly SheetRow[],
  after: readonly SheetRow[],
  untouched: readonly SheetRow[],
  changed: readonly { readonly row: SheetRow; readonly after: RowCells }[],
  added: readonly RowCells[],
  fresh: FreshTabs,
): string[] {
  const readBefore = rules.read(before, fresh)
  const readAfter = rules.read(after, fresh)
  const refusals: string[] = []
  const written = [
    ...changed.map(({ row, after: cells }) => ({ was: row.cells, is: withCells(row.cells, rules.columns, cells) })),
    ...added.map((cells) => ({ was: null, is: cells })),
  ]
  for (const { was, is } of written) {
    const where = was === null ? `The new ${rules.kind.noun.one} "${labelOfRow(rules.tab, is)}"` : capitalised(named(rules, is))
    const outcome = recordOutcome(rules.tab, readAfter, is)
    if (!outcome.kept) {
      refusals.push(`${where} would be left out: ${outcome.reasons.join(', ')}.`)
      continue
    }
    const known = was === null ? [] : recordOutcome(rules.tab, readBefore, was).reasons
    const introduced = outcome.reasons.filter((reason) => !known.includes(reason))
    if (introduced.length > 0) {
      refusals.push(`${where} would read with a problem: ${introduced.join(', ')}.`)
    }
  }
  for (const row of untouched) {
    const outcome = recordOutcome(rules.tab, readAfter, row.cells)
    if (recordOutcome(rules.tab, readBefore, row.cells).kept && !outcome.kept) {
      refusals.push(`${capitalised(named(rules, row.cells))} would then be left out: ${outcome.reasons.join(', ')}.`)
    }
  }
  return refusals
}

function requireRowTab(fresh: FreshTabs, rules: TabRowRules): TabRead {
  const tab = fresh[rules.tab]
  if (tab === undefined) {
    throw new WorkbookWriteRefused(`The workbook has no ${rules.tab} tab, so nothing was written.`)
  }
  const missing = rules.required.filter((column) => !tab.header.some((name) => name.trim() === column))
  if (missing.length > 0) {
    throw new WorkbookWriteRefused(`The ${rules.tab} tab has no ${quotedList(missing)} column, so nothing was written.`)
  }
  return tab
}

/**
 * The one row holding the record the cells name, by their key or id, and still holding the cells,
 * or why there is not exactly one. Cells without a key are found by what they hold.
 */
function locate(tab: TabRead, rules: TabRowRules, cells: RowCells): SheetRow | string {
  const record = named(rules, cells)
  const id = recordIdOfRow(rules.tab, cells)
  if (carriesIds(rules.tab) && id === null) {
    return `${capitalised(record)} has no id yet, so the app cannot find it. Press "Add ids" on Overview, then try again.`
  }
  const candidates = id === null ? tab.rows : tab.rows.filter((row) => recordIdOfRow(rules.tab, row.cells) === id)
  if (carriesIds(rules.tab) && candidates.length > 1) {
    return `${candidates.length} rows of the ${rules.tab} tab hold the id of ${record}, so the app cannot tell which one is meant. Clear the id cell of the copied row in the Sheet.`
  }
  const holding = candidates.filter((row) => holds(row, cells, rules))
  if (holding.length === 1) {
    return holding[0]!
  }
  if (holding.length > 1) {
    return `${holding.length} rows of the ${rules.tab} tab hold ${record}, so the app cannot tell which one is meant. Change it in the Sheet.`
  }
  return `${capitalised(record)} is no longer on the ${rules.tab} tab as the app read it. Sync and look again.`
}

function sameCells(left: RowCells, right: RowCells, rules: TabRowRules): boolean {
  return holds({ sheetRow: 0, cells: left }, right, rules)
}

function holds(row: SheetRow, cells: RowCells, rules: TabRowRules): boolean {
  return rules.columns.every((column) => {
    const read = cellText(row.cells[column])
    const wanted = cellText(cells[column])
    return rules.caseless.includes(column) ? read.toLowerCase() === wanted.toLowerCase() : read === wanted
  })
}

/** A row's cells with the rule's columns replaced by these, a blank one taken out, as a read would give the row. */
function withCells(current: SheetRow['cells'], columns: readonly string[], cells: RowCells): SheetRow['cells'] {
  const others = Object.fromEntries(Object.entries(current).filter(([column]) => !columns.includes(column)))
  return { ...others, ...filledCells(cells) }
}

function filledCells(cells: RowCells): RowCells {
  return Object.fromEntries(Object.entries(cells).filter(([, cell]) => cellText(cell) !== ''))
}

function quotedList(columns: readonly string[]): string {
  return columns.map((column) => `"${column}"`).join(', ')
}

function refuseOn(refusals: readonly string[]): void {
  if (refusals.length > 0) {
    throw new WorkbookWriteRefused(`Nothing was written. ${refusals.join(' ')}`)
  }
}
