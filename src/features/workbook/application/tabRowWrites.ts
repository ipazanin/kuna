import { cellText } from '../../../shared/text/cellText'
import type { RowAt, RowCells, RowChange, TabRowsChange, TabRowsReceipt } from '../domain/rowChanges'
import type { TabReading } from '../infrastructure/cellReading'
import type { SheetRow, WorkbookTab } from '../infrastructure/workbookSnapshot'
import { TEMPLATE_COLUMNS } from '../infrastructure/workbookTemplate'
import { WorkbookWriteRefused } from './workbookWriter'
import type { CellEdit, FreshTabs, RowAppend, RowTab, TabEdits, TabRead } from './workbookWriter'

/** What one row is called in a sentence, such as "an invoice" and "3 invoices". */
export interface RowNoun {
  readonly one: string
  readonly many: string
  readonly article: 'a' | 'an'
}

/** A touched row: what it held and what it is to hold. `before` is null for an added row, `after` for a deleted one. `sheetRow` is the row as read for a row already on the tab, and where an added row will stand. */
export interface RowEdit {
  readonly sheetRow: number
  readonly before: RowCells | null
  readonly after: RowCells | null
}

/** The tab before and after a change, as the checks see it. Added rows sit where they will, below the last row unless the rules place them. */
export interface RowsChangeCheck {
  readonly before: readonly SheetRow[]
  readonly after: readonly SheetRow[]
  readonly edits: readonly RowEdit[]
}

/** How one tab's rows are written: which columns, which other tabs the checks read, and what keeps the Sheet and its Apps Script valid. */
export interface TabRowRules {
  readonly tab: RowTab
  readonly noun: RowNoun
  /** The columns the app writes on the tab. A row is found again by them. */
  readonly columns: readonly string[]
  /** The columns the tab needs before anything is written. */
  readonly required: readonly string[]
  /** Columns compared without regard to case when a row is found again, as the readers read them. */
  readonly caseless: readonly string[]
  /** Columns holding dates as serial days, so a person reads them as dates. */
  readonly dates: readonly string[]
  /** The other tabs the reader and the checks need. */
  readonly reads: readonly WorkbookTab[]
  /** The tab's own reader, against the other tabs as they are now. */
  read(rows: readonly SheetRow[], fresh: FreshTabs): TabReading<{ readonly sheetRow: number }>
  /** Why the change would break the Sheet or what reads it, each a sentence. Empty when it may go ahead. */
  refusals(check: RowsChangeCheck, fresh: FreshTabs): readonly string[]
  /** What names a row for a person, such as its category or its invoice number. */
  label(cells: RowCells): string
  /**
   * For a tab kept in an order of its own, every added row by its index in the change, top to
   * bottom as they will stand, each with the row of the read it goes above, the last row plus one
   * for below it. Without it every added row goes below the last row, in the change's order.
   */
  place?(rows: readonly SheetRow[], added: readonly RowCells[], lastRow: number): readonly AddedPlace[]
}

/** The touched rows as a tab's checks take them: what each held and holds, picked from its cells, with no row number for an added row. */
export function editsOf<Picked>(
  check: RowsChangeCheck,
  pick: (cells: RowCells) => Picked,
): { readonly sheetRow: number | null; readonly before: Picked | null; readonly after: Picked | null }[] {
  return check.edits.map((edit) => ({
    sheetRow: edit.before === null ? null : edit.sheetRow,
    before: edit.before === null ? null : pick(edit.before),
    after: edit.after === null ? null : pick(edit.after),
  }))
}

/** The rows a change leaves alone, picked from their cells. */
export function untouchedOf<Picked>(check: RowsChangeCheck, pick: (cells: SheetRow['cells']) => Picked): ({ readonly sheetRow: number } & Picked)[] {
  const touched = new Set(check.edits.filter((edit) => edit.before !== null).map((edit) => edit.sheetRow))
  return check.before.filter((row) => !touched.has(row.sheetRow)).map((row) => ({ sheetRow: row.sheetRow, ...pick(row.cells) }))
}

/** Where an added row goes: above row `before` of the read. */
export interface AddedPlace {
  readonly index: number
  readonly before: number
}

/** A change planned on a read taken just before it, with each row found where it is now. */
export interface RowsPlan {
  readonly edits: TabEdits
  readonly added: readonly RowCells[]
  /** Each changed row where it stands after the write. */
  readonly changed: readonly RowChange[]
  /** Each deleted row where it stood. */
  readonly removed: readonly RowAt[]
  /** Rows that already held an added or restored row's cells, where they stand after the write, so the new ones can be told apart. */
  readonly alreadyThere: readonly number[]
  /** For each deleted row, how many rows held its cells before, so it can be checked gone. */
  readonly heldBefore: readonly number[]
}

/** A row's cells in the rule's columns, raw, a missing cell as blank, so a formula's value is compared as the Sheet gives it. */
export function rowCellsOf(row: SheetRow, columns: readonly string[]): RowCells {
  return Object.fromEntries(columns.map((column) => [column, row.cells[column] ?? '']))
}

/**
 * Finds every row to change or delete again, on its own row if that still holds what the app read,
 * else on the one row that does, and refuses when none or several do. The tab as the change would
 * leave it must read as cleanly as it does now by the tab's own reader, and pass the tab's checks. A changed row writes
 * only the cells that differ, so a formula left alone stays a formula. A deleted row is taken out
 * whole, so no blank row is left. Added rows go below the last row unless the rules place them, and
 * restored rows go back on the rows they stood on.
 * With `addMissingTab`, which the person must have agreed to, a tab the workbook lacks is added with
 * the template's header first.
 */
export function planRowsChange(fresh: FreshTabs, rules: TabRowRules, change: TabRowsChange, addMissingTab = false): RowsPlan {
  const newTab = addMissingTab && fresh[rules.tab] === undefined ? { tab: rules.tab, header: TEMPLATE_COLUMNS[rules.tab].map((column) => column.name) } : null
  const tab = newTab === null ? requireRowTab(fresh, rules) : { header: newTab.header, rows: [], lastRow: 1 }
  const header = new Set(tab.header.map((name) => name.trim()))
  const refusals: string[] = []
  const takenRows = new Set<number>()
  const locateEach = <Target extends { readonly sheetRow: number }>(targets: readonly Target[], cellsOf: (target: Target) => RowCells) =>
    targets.flatMap((target) => {
      const row = locate(tab, rules, target.sheetRow, cellsOf(target))
      if (typeof row === 'string') {
        refusals.push(row)
        return []
      }
      if (takenRows.has(row.sheetRow)) {
        refusals.push(`Row ${row.sheetRow} is asked to change twice in one write.`)
        return []
      }
      takenRows.add(row.sheetRow)
      return [{ row, target }]
    })
  const changed = locateEach(change.changed, (target) => target.before).map(({ row, target }) => ({ row, after: { ...rowCellsOf(row, rules.columns), ...target.after } }))
  const removed = locateEach(change.removed, (target) => target.cells)
  const restored = [...(change.restored ?? [])].sort((upper, lower) => upper.sheetRow - lower.sheetRow)
  const written = [...change.added, ...restored.map((row) => row.cells), ...change.changed.map((target) => target.after)]
  const missing = [...new Set(written.flatMap((cells) => rules.columns.filter((column) => !header.has(column) && cellText(cells[column]) !== '')))]
  if (missing.length > 0) {
    refusals.push(`The ${rules.tab} tab has no ${quotedList(missing)} column for what this change writes. Add the column to row 1 in the Sheet, or leave the field blank.`)
  }
  refuseOn(refusals)

  const foot = tab.lastRow + 1
  const placed = rules.place?.(tab.rows, change.added, tab.lastRow) ?? change.added.map((_, index) => ({ index, before: foot }))
  const inPlace = placed.filter((place) => place.before !== foot)
  const atFoot = placed.filter((place) => place.before === foot)
  const deleted = removed.map(({ row }) => row.sheetRow)
  // The rows move in the order the writers carry out a write: deletions, then placed rows, then restored rows.
  const closedUp = (sheetRow: number): number => sheetRow - deleted.filter((other) => other < sheetRow).length
  const befores = inPlace.map((place) => closedUp(place.before))
  const restoredAbove = (position: number): number => restored.reduce((moved, row) => (row.sheetRow <= moved ? moved + 1 : moved), position)
  const finalOf = (sheetRow: number): number => restoredAbove(shiftedRowNumber(closedUp(sheetRow), befores))
  const insertedAt = insertedRowNumbers(befores).map(restoredAbove)
  const kept = tab.rows.filter((row) => !deleted.includes(row.sheetRow))
  const footRow = Math.max(1, ...kept.map((row) => finalOf(row.sheetRow)), ...insertedAt, ...restored.map((row) => row.sheetRow)) + 1
  const addedAt: number[] = []
  inPlace.forEach((place, order) => {
    addedAt[place.index] = insertedAt[order]!
  })
  atFoot.forEach((place, order) => {
    addedAt[place.index] = footRow + order
  })

  const afterOf = new Map(changed.map(({ row, after }) => [row.sheetRow, after]))
  const afterRows: AfterRow[] = [
    ...kept.map((row): AfterRow => {
      const after = afterOf.get(row.sheetRow)
      return { sheetRow: finalOf(row.sheetRow), cells: after === undefined ? row.cells : withCells(row.cells, rules.columns, after), readAs: row.sheetRow }
    }),
    ...change.added.map((cells, index) => ({ sheetRow: addedAt[index]!, cells: filledCells(cells), readAs: null })),
    ...restored.map((row) => ({ sheetRow: row.sheetRow, cells: filledCells(row.cells), readAs: null })),
  ].sort((upper, lower) => upper.sheetRow - lower.sheetRow)
  const edits: RowEdit[] = [
    ...changed.map(({ row, after }) => ({ sheetRow: row.sheetRow, before: rowCellsOf(row, rules.columns), after })),
    ...removed.map(({ row }) => ({ sheetRow: row.sheetRow, before: rowCellsOf(row, rules.columns), after: null })),
    ...change.added.map((cells, index) => ({ sheetRow: addedAt[index]!, before: null, after: cells })),
    ...restored.map((row) => ({ sheetRow: row.sheetRow, before: null, after: row.cells })),
  ]
  // The tab's own checks name the cause, so the reader's account of the same row is held back until they pass.
  refuseOn(rules.refusals({ before: tab.rows, after: afterRows, edits }, fresh))
  refuseOn(readerRefusals(rules, tab.rows, afterRows, edits, fresh))

  const cells: CellEdit[] = changed.flatMap(({ row, after }) =>
    rules.columns
      .filter((column) => cellText(row.cells[column]) !== cellText(after[column]))
      .map((column): CellEdit => ({ tab: rules.tab, sheetRow: row.sheetRow, column, value: after[column] ?? '' })),
  )
  const appends: RowAppend[] = [
    ...inPlace.map(({ index }) => ({ tab: rules.tab, cells: filledCells(change.added[index]!), at: addedAt[index]! })),
    ...restored.map((row) => ({ tab: rules.tab, cells: filledCells(row.cells), at: row.sheetRow })),
    ...atFoot.map(({ index }) => ({ tab: rules.tab, cells: filledCells(change.added[index]!) })),
  ]
  const deletions = deleted.map((sheetRow) => ({ tab: rules.tab, sheetRow }))
  const tabEdits: TabEdits = deletions.length === 0 ? { cells, appends } : { cells, appends, deletions }
  const verified = [...change.added, ...restored.map((row) => row.cells)]
  return {
    edits: newTab === null ? tabEdits : { ...tabEdits, newTabs: [newTab] },
    added: verified,
    changed: changed.map(({ row, after }) => ({ sheetRow: finalOf(row.sheetRow), before: rowCellsOf(row, rules.columns), after })),
    removed: removed.map(({ row }) => ({ sheetRow: row.sheetRow, cells: rowCellsOf(row, rules.columns) })),
    alreadyThere: kept.filter((row) => verified.some((cells) => holds(row, cells, rules))).map((row) => finalOf(row.sheetRow)),
    heldBefore: removed.map(({ row }) => tab.rows.filter((candidate) => holds(candidate, rowCellsOf(row, rules.columns), rules)).length),
  }
}

/** The row each row put in lands on once all of them are in, given the row each goes above. Rows sharing a place keep their order. */
function insertedRowNumbers(befores: readonly number[]): number[] {
  return befores.map((before, index) => before + befores.filter((other, otherIndex) => other < before || (other === before && otherIndex < index)).length)
}

/** The row a row moves to once rows are put in above these rows. */
function shiftedRowNumber(sheetRow: number, befores: readonly number[]): number {
  return sheetRow + befores.filter((before) => before <= sheetRow).length
}

/** A row of the tab as the change would leave it, with the row it was read as, or null for an added one. */
interface AfterRow extends SheetRow {
  readonly readAs: number | null
}

/** After the write: each changed row holds what was written, each deleted row is gone, and each added or restored row is on the tab once more. */
export function verifyRowsChange(after: FreshTabs, rules: TabRowRules, plan: RowsPlan): TabRowsReceipt {
  const rows = requireRowTab(after, rules).rows
  const rowAt = (sheetRow: number): SheetRow | undefined => rows.find((row) => row.sheetRow === sheetRow)
  for (const change of plan.changed) {
    const row = rowAt(change.sheetRow)
    if (row === undefined || !holds(row, change.after, rules)) {
      throw new Error(`The write reached the workbook, but row ${change.sheetRow} of the ${rules.tab} tab does not read back as written. Check it in the Sheet.`)
    }
  }
  plan.removed.forEach((removed, index) => {
    const holding = rows.filter((candidate) => holds(candidate, removed.cells, rules)).length
    const expected = plan.heldBefore[index]! - plan.removed.filter((other) => sameCells(other.cells, removed.cells, rules)).length + plan.added.filter((cells) => sameCells(cells, removed.cells, rules)).length
    if (holding > expected) {
      throw new Error(`The write reached the workbook, but row ${removed.sheetRow} of the ${rules.tab} tab still holds the ${rules.noun.one}. Check it in the Sheet.`)
    }
  })
  const taken = new Set<number>()
  const added = plan.added.map((cells): RowAt => {
    const row = rows.find((candidate) => holds(candidate, cells, rules) && !plan.alreadyThere.includes(candidate.sheetRow) && !taken.has(candidate.sheetRow))
    if (row === undefined) {
      throw new Error(`The write reached the workbook, but the ${rules.noun.one} "${rules.label(cells)}" does not read back as written. Check the ${rules.tab} tab.`)
    }
    taken.add(row.sheetRow)
    return { sheetRow: row.sheetRow, cells }
  })
  return { added, changed: plan.changed, removed: plan.removed }
}

/**
 * What the reader would say once the change is made: a problem on a row the change writes that the
 * row did not have before, and a row it leaves alone that is read today and would be left out.
 */
function readerRefusals(rules: TabRowRules, before: readonly SheetRow[], after: readonly AfterRow[], edits: readonly RowEdit[], fresh: FreshTabs): string[] {
  const readBefore = rules.read(before, fresh)
  const keptBefore = new Set(readBefore.facts.map((fact) => fact.sheetRow))
  const readAfter = rules.read(after, fresh)
  const keptAfter = new Set(readAfter.facts.map((fact) => fact.sheetRow))
  const reasonsOf = (reading: typeof readAfter, sheetRow: number): string[] => reading.problems.filter((problem) => problem.sheetRow === sheetRow).map((problem) => problem.reason)
  const touched = new Set(edits.filter((edit) => edit.before !== null).map((edit) => edit.sheetRow))
  const refusals: string[] = []
  for (const edit of edits) {
    if (edit.after === null) {
      continue
    }
    const where = edit.before === null ? `The new ${rules.noun.one}` : `Row ${edit.sheetRow}`
    const standsOn = edit.before === null ? edit.sheetRow : after.find((row) => row.readAs === edit.sheetRow)!.sheetRow
    const reasons = reasonsOf(readAfter, standsOn)
    if (!keptAfter.has(standsOn)) {
      refusals.push(`${where} would be left out: ${reasons.join(', ')}.`)
    } else {
      const known = edit.before === null ? [] : reasonsOf(readBefore, edit.sheetRow)
      const introduced = reasons.filter((reason) => !known.includes(reason))
      if (introduced.length > 0) {
        refusals.push(`${where} would read with a problem: ${introduced.join(', ')}.`)
      }
    }
  }
  for (const row of after) {
    if (row.readAs !== null && !touched.has(row.readAs) && keptBefore.has(row.readAs) && !keptAfter.has(row.sheetRow)) {
      refusals.push(`Row ${row.readAs} would then be left out: ${reasonsOf(readAfter, row.sheetRow).join(', ')}.`)
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

/** The row the target names, or why there is not exactly one. */
function locate(tab: TabRead, rules: TabRowRules, sheetRow: number, cells: RowCells): SheetRow | string {
  const holding = tab.rows.filter((row) => holds(row, cells, rules))
  const row = holding.find((candidate) => candidate.sheetRow === sheetRow) ?? (holding.length === 1 ? holding[0] : undefined)
  if (row !== undefined) {
    return row
  }
  const named = `the ${rules.noun.one} "${rules.label(cells)}"`
  return holding.length === 0
    ? `${named.charAt(0).toUpperCase()}${named.slice(1)} is no longer on the ${rules.tab} tab as the app read it. Sync and look again.`
    : `${holding.length} rows of the ${rules.tab} tab hold ${named} (rows ${holding.map((candidate) => candidate.sheetRow).join(', ')}), so the app cannot tell which one is meant. Change it in the Sheet.`
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
