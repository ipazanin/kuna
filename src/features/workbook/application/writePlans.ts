import { serialFromCivilDate } from '../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../shared/calendar/civilDate'
import { amountOf } from '../../../shared/money/money'
import type { Money } from '../../../shared/money/money'
import { cellText } from '../../../shared/text/cellText'
import type { LedgerVerdictChange, VerdictReceipt } from '../../review/domain/verdictChanges'
import { rulesTabAfter, sameCells } from '../../rules/domain/rulesTabChange'
import type { RulesTabChange } from '../../rules/domain/rulesTabChange'
import { rulesTabRefusals } from '../../rules/domain/rulesTabRefusals'
import { parseSettings } from '../../settings/domain/settings'
import type { DefinedBucket } from '../domain/bucket'
import { isSameLedgerRow } from '../domain/ledgerRowKey'
import { ADVANCE_BUCKETS } from '../domain/workbook'
import type { LedgerRowKey } from '../domain/ledgerRowKey'
import { definedCategories, definedCategorySlugs, ledgerRowKeyOfRow } from '../infrastructure/workbookReader'
import type { CellValue, SheetRow, WorkbookTab } from '../infrastructure/workbookSnapshot'
import { WorkbookWriteRefused } from './workbookWriter'
import type { CellEdit, FreshTabs, RowAppend, TabEdits, TabRead } from './workbookWriter'

/** A ledger write planned on a read taken just before it, the same way for a Google Sheet and for the workbook kept in this browser. */
export interface VerdictPlan {
  readonly edits: TabEdits
  /** What the rows held before, exactly, for Undo. */
  readonly receipt: VerdictReceipt
  /** The row each change was written to, in the order of the changes. */
  readonly sheetRows: readonly number[]
}

/**
 * Finds each row again by its key, refuses on no match, several matches, a row that changed since
 * the app read it, or a category the categories tab does not define, and sets only `category` and
 * `flagged_by`, each only where it changes.
 */
export function planVerdicts(fresh: FreshTabs, changes: readonly LedgerVerdictChange[]): VerdictPlan {
  const ledger = requireTab(fresh, 'ledger')
  const definedCategories = definedCategorySlugs(requireTab(fresh, 'categories').rows)
  for (const column of ['category', 'flagged_by']) {
    if (!ledger.header.some((name) => name.trim() === column)) {
      throw new WorkbookWriteRefused(`The ledger tab has no "${column}" column, so nothing was written.`)
    }
  }
  const keyed = keyedLedgerRows(ledger.rows)
  const refusals: string[] = []
  const cells: CellEdit[] = []
  const receiptChanges: LedgerVerdictChange[] = []
  const sheetRows: number[] = []
  for (const change of changes) {
    const located = locate(keyed, change.key)
    if (typeof located === 'string') {
      refusals.push(located)
      continue
    }
    if (sheetRows.includes(located.sheetRow)) {
      refusals.push(`Row ${located.sheetRow} is asked to change twice in one write.`)
      continue
    }
    const current = { category: cellText(located.cells.category), flaggedBy: cellText(located.cells.flagged_by) }
    if (comparable(current.category) !== comparable(change.from.category) || comparable(current.flaggedBy) !== comparable(change.from.flaggedBy)) {
      refusals.push(
        `Row ${located.sheetRow} changed since the app read it: it now says ${current.category || 'no category'}, flagged by ${current.flaggedBy || 'nobody'}.`,
      )
      continue
    }
    if (!change.undoes && !definedCategories.has(comparable(change.to.category))) {
      refusals.push(`"${change.to.category}" is not a category on the categories tab.`)
      continue
    }
    if (comparable(current.category) !== comparable(change.to.category)) {
      cells.push({ tab: 'ledger', sheetRow: located.sheetRow, column: 'category', value: change.to.category })
    }
    if (comparable(current.flaggedBy) !== comparable(change.to.flaggedBy)) {
      cells.push({ tab: 'ledger', sheetRow: located.sheetRow, column: 'flagged_by', value: change.to.flaggedBy })
    }
    receiptChanges.push({ ...change, from: current })
    sheetRows.push(located.sheetRow)
  }
  refuseOn(refusals)
  return { edits: { cells, appends: [] }, receipt: { changes: receiptChanges }, sheetRows }
}

/** After the write: every changed row is where it was written and reads as written. */
export function verifyVerdicts(after: FreshTabs, plan: VerdictPlan): void {
  const keyed = keyedLedgerRows(requireTab(after, 'ledger').rows)
  plan.receipt.changes.forEach((change, index) => {
    const written = plan.sheetRows[index]
    const located = locate(keyed, change.key)
    const holds =
      typeof located !== 'string' &&
      located.sheetRow === written &&
      comparable(cellText(located.cells.category)) === comparable(change.to.category) &&
      comparable(cellText(located.cells.flagged_by)) === comparable(change.to.flaggedBy)
    if (!holds) {
      throw new Error(
        `The write reached the workbook, but row ${written} does not read back as written. Rows may have moved while it was sent. Check row ${written} and the version history.`,
      )
    }
  })
}

/**
 * The rules tab with the change made must pass every check the Apps Script's `parseRules` makes,
 * against the categories and clients tabs as they are now, or nothing is written. Edited rows
 * change only the cells that differ.
 */
export function planRulesChange(fresh: FreshTabs, change: RulesTabChange): TabEdits {
  const rules = requireTab(fresh, 'rules')
  const header = rules.header.map((name) => name.trim())
  const after = rulesTabAfter(rules.rows, change, rules.lastRow)
  refuseOn(after.refusals.map(sentence))
  const missing = [change.appended, ...change.edited.map((edit) => edit.cells)]
    .flatMap((cells) => (cells === null ? [] : Object.keys(cells)))
    .filter((column, index, columns) => !header.includes(column) && columns.indexOf(column) === index)
  if (missing.length > 0) {
    throw new WorkbookWriteRefused(`The rules tab has no ${missing.map((column) => `"${column}"`).join(', ')} column, which this rule needs.`)
  }
  const refusals = rulesTabRefusals(rules.header, after.rows, definedCategorySlugs(requireTab(fresh, 'categories').rows), clientsTabAnswers(fresh.clients))
  if (refusals.length > 0) {
    throw new WorkbookWriteRefused(`The rules tab would not pass the Apps Script's check, so nothing was written: ${refusals.join('. ')}.`)
  }
  const cells: CellEdit[] = []
  for (const edit of change.edited) {
    const row = rules.rows.find((candidate) => cellText(candidate.cells.rule).toLowerCase() === edit.id.trim().toLowerCase())
    if (row === undefined) {
      continue
    }
    for (const column of header.filter((name) => name !== '')) {
      if (cellText(row.cells[column]) !== cellText(edit.cells[column])) {
        cells.push({ tab: 'rules', sheetRow: row.sheetRow, column, value: edit.cells[column] ?? '' })
      }
    }
  }
  const appends: RowAppend[] = change.appended === null ? [] : [{ tab: 'rules', cells: change.appended }]
  return { cells, appends }
}

/** Whether `requireClientIbans` in the Apps Script can read the tab: it exists, with a client and an iban column. */
function clientsTabAnswers(clients: TabRead | undefined): boolean {
  const header = clients?.header.map((name) => name.trim().toLowerCase()) ?? []
  return clients !== undefined && header.includes('client') && header.includes('iban')
}

/** After the write: the new row and every edited row read back as written, each id once. */
export function verifyRulesChange(after: FreshTabs, change: RulesTabChange): void {
  const rows = requireTab(after, 'rules').rows
  for (const cells of [change.appended, ...change.edited.map((edit) => edit.cells)]) {
    if (cells === null) {
      continue
    }
    const id = cellText(cells.rule)
    const matches = rows.filter((row) => cellText(row.cells.rule).toLowerCase() === id.toLowerCase())
    if (matches.length !== 1 || !sameCells(matches[0]!.cells, cells)) {
      throw new Error(`The write reached the workbook, but rule "${id}" does not read back as written. Check the rules tab and its version history.`)
    }
  }
}

/** One setting written: `expected` is the value the app read, or null when the tab had no row for the key. */
export interface SettingChange {
  readonly key: string
  readonly expected: CellValue | null
  readonly value: CellValue
}

/**
 * Sets each key's value in place, or adds a row for a key the tab lacks. Refused on a key written
 * twice, a value that changed since the app read it, or a value the settings reader would not use.
 */
export function planSettingsChange(fresh: FreshTabs, changes: readonly SettingChange[]): TabEdits {
  const settings = requireTab(fresh, 'settings')
  const header = settings.header.map((name) => name.trim().toLowerCase())
  if (!header.includes('key') || !header.includes('value')) {
    throw new WorkbookWriteRefused('The settings tab needs a "key" and a "value" column, as the Apps Script reads it, so nothing was written.')
  }
  const refusals: string[] = []
  const cells: CellEdit[] = []
  const appends: RowAppend[] = []
  const values = new Map<number, CellValue>()
  const added: SheetRow[] = []
  for (const change of changes) {
    const key = change.key.trim().toLowerCase()
    const matches = settings.rows.filter((row) => cellText(row.cells.key).toLowerCase() === key)
    if (matches.length > 1) {
      refusals.push(`The settings tab sets "${key}" on ${matches.length} rows. Keep one of them in the Sheet first.`)
      continue
    }
    const [row] = matches
    if (row === undefined) {
      if (change.expected !== null) {
        refusals.push(`The "${key}" row left the settings tab since the app read it.`)
      } else if (cellText(change.value) !== '') {
        appends.push({ tab: 'settings', cells: { key, value: change.value } })
        added.push({ sheetRow: settings.lastRow + 1 + added.length, cells: { key, value: change.value } })
      }
      continue
    }
    if (cellText(row.cells.value) !== cellText(change.expected)) {
      refusals.push(`"${key}" changed since the app read it: it now says "${cellText(row.cells.value)}".`)
      continue
    }
    if (cellText(row.cells.value) !== cellText(change.value)) {
      cells.push({ tab: 'settings', sheetRow: row.sheetRow, column: 'value', value: change.value })
      values.set(row.sheetRow, change.value)
    }
  }
  refuseOn(refusals)
  const before = new Set(settingProblems(settings.rows))
  const afterRows = [
    ...settings.rows.map((row) => {
      const value = values.get(row.sheetRow)
      return value === undefined ? row : { sheetRow: row.sheetRow, cells: { ...row.cells, value } }
    }),
    ...added,
  ]
  const introduced = settingProblems(afterRows).filter((problem) => !before.has(problem))
  if (introduced.length > 0) {
    throw new WorkbookWriteRefused(`The settings would not read cleanly, so nothing was written: ${introduced.join('. ')}.`)
  }
  return { cells, appends }
}

/** After the write: each key is on one row and reads as written. */
export function verifySettingsChange(after: FreshTabs, changes: readonly SettingChange[]): void {
  const rows = requireTab(after, 'settings').rows
  for (const change of changes) {
    const key = change.key.trim().toLowerCase()
    const matches = rows.filter((row) => cellText(row.cells.key).toLowerCase() === key)
    const reads = matches.length === 0 ? '' : cellText(matches[0]!.cells.value)
    if (matches.length > 1 || reads !== cellText(change.value)) {
      throw new Error(`The write reached the workbook, but "${key}" does not read back as written. Check the settings tab.`)
    }
  }
}

/** A cost the owner paid privately, as the Add advance form gives it. */
export interface OwnerAdvanceDraft {
  readonly date: CivilDate
  /** Positive. */
  readonly amount: Money
  readonly description: string
  readonly category: string
}

export const OWNER_ADVANCE_COLUMNS = ['date', 'amount', 'description', 'category'] as const

/** An advance appended, which Undo clears again. */
export interface OwnerAdvanceReceipt {
  readonly cells: Readonly<Record<(typeof OWNER_ADVANCE_COLUMNS)[number], CellValue>>
  /** The row it was written to. */
  readonly sheetRow: number
}

export interface OwnerAdvancePlan {
  readonly edits: TabEdits
  readonly cells: OwnerAdvanceReceipt['cells']
  /** Rows that already held exactly these cells, so the new one can be told apart after the write. */
  readonly alreadyThere: readonly number[]
}

/**
 * Appends one advance. Refused unless the tab has the four columns, the amount is a positive
 * figure in cents, and the category is on the categories tab as it is now, in the operating or
 * taxes bucket. The date is a serial number, so the cell is a date cell like one typed in the Sheet.
 */
export function planOwnerAdvanceAppend(fresh: FreshTabs, draft: OwnerAdvanceDraft): OwnerAdvancePlan {
  const advances = requireTab(fresh, 'owner-advances')
  const missing = OWNER_ADVANCE_COLUMNS.filter((column) => !advances.header.some((name) => name.trim() === column))
  if (missing.length > 0) {
    throw new WorkbookWriteRefused(`The owner-advances tab has no ${missing.map((column) => `"${column}"`).join(', ')} column, so nothing was written.`)
  }
  if (!Number.isInteger(draft.amount) || draft.amount <= 0) {
    throw new WorkbookWriteRefused('An advance is a positive amount, so nothing was written.')
  }
  const slug = comparable(draft.category)
  const category = definedCategories(requireTab(fresh, 'categories').rows).find((candidate) => candidate.slug === slug)
  if (category === undefined) {
    throw new WorkbookWriteRefused(`"${draft.category}" is not a category on the categories tab, so nothing was written.`)
  }
  if (!(ADVANCE_BUCKETS as readonly string[]).includes(category.bucket)) {
    throw new WorkbookWriteRefused(`"${slug}" is in the ${category.bucket} bucket now, and an advance counts as an operating cost or a tax. Nothing was written.`)
  }
  const cells = { date: serialFromCivilDate(draft.date), amount: amountOf(draft.amount), description: draft.description.trim(), category: slug }
  return {
    edits: { cells: [], appends: [{ tab: 'owner-advances', cells }] },
    cells,
    alreadyThere: advances.rows.filter((row) => holdsAdvance(row, cells)).map((row) => row.sheetRow),
  }
}

/** After the write: one more row holds the advance than before. Returns what Undo clears. */
export function verifyOwnerAdvanceAppend(after: FreshTabs, plan: OwnerAdvancePlan): OwnerAdvanceReceipt {
  const added = requireTab(after, 'owner-advances').rows.filter((row) => holdsAdvance(row, plan.cells) && !plan.alreadyThere.includes(row.sheetRow))
  if (added.length !== 1) {
    throw new Error('The write reached the workbook, but the advance does not read back as written. Check the owner-advances tab.')
  }
  return { cells: plan.cells, sheetRow: added[0]!.sheetRow }
}

/**
 * Clears an appended advance again: its row if it still holds exactly what was written, else the
 * one row that does. Refused when none or several do.
 */
export function planOwnerAdvanceRemoval(fresh: FreshTabs, receipt: OwnerAdvanceReceipt): TabEdits {
  const rows = requireTab(fresh, 'owner-advances').rows
  const holding = rows.filter((row) => holdsAdvance(row, receipt.cells))
  const row = holding.find((candidate) => candidate.sheetRow === receipt.sheetRow) ?? (holding.length === 1 ? holding[0] : undefined)
  if (row === undefined) {
    throw new WorkbookWriteRefused(
      holding.length === 0
        ? 'The advance is no longer on the owner-advances tab as it was written, so nothing was cleared.'
        : `${holding.length} rows of the owner-advances tab hold this advance, so the app cannot tell which to clear. Delete it in the Sheet.`,
    )
  }
  return {
    cells: Object.keys(row.cells)
      .filter((column) => (OWNER_ADVANCE_COLUMNS as readonly string[]).includes(column))
      .map((column): CellEdit => ({ tab: 'owner-advances', sheetRow: row.sheetRow, column, value: '' })),
    appends: [],
  }
}

/** After the write: the cleared row holds nothing of the advance. */
export function verifyOwnerAdvanceRemoval(after: FreshTabs, edits: TabEdits): void {
  const cleared = new Set(edits.cells.map((edit) => edit.sheetRow))
  const leftOver = requireTab(after, 'owner-advances').rows.filter(
    (row) => cleared.has(row.sheetRow) && OWNER_ADVANCE_COLUMNS.some((column) => cellText(row.cells[column]) !== ''),
  )
  if (leftOver.length > 0) {
    throw new Error(`The write reached the workbook, but row ${leftOver[0]!.sheetRow} of the owner-advances tab still holds the advance. Check it in the Sheet.`)
  }
}

function holdsAdvance(row: SheetRow, cells: OwnerAdvanceReceipt['cells']): boolean {
  return OWNER_ADVANCE_COLUMNS.every((column) =>
    column === 'category' ? comparable(cellText(row.cells[column])) === comparable(cellText(cells[column])) : cellText(row.cells[column]) === cellText(cells[column]),
  )
}

/** A category's bucket as the app read it, and the bucket it is to have. */
export interface BucketChange {
  readonly category: string
  readonly expected: DefinedBucket
  readonly bucket: DefinedBucket
}

/**
 * Sets the bucket of each category on its row of the categories tab. Refused when a category is on
 * no row or on several, or its bucket changed since the app read it.
 */
export function planBucketChanges(fresh: FreshTabs, changes: readonly BucketChange[]): TabEdits {
  const categories = requireTab(fresh, 'categories')
  for (const column of ['category', 'bucket']) {
    if (!categories.header.some((name) => name.trim() === column)) {
      throw new WorkbookWriteRefused(`The categories tab has no "${column}" column, so nothing was written.`)
    }
  }
  const refusals: string[] = []
  const cells: CellEdit[] = []
  for (const change of changes) {
    const slug = comparable(change.category)
    const rows = categories.rows.filter((row) => comparable(cellText(row.cells.category)) === slug)
    if (rows.length !== 1) {
      refusals.push(
        rows.length === 0
          ? `"${slug}" is no longer on the categories tab.`
          : `"${slug}" is on ${rows.length} rows of the categories tab (rows ${rows.map((row) => row.sheetRow).join(', ')}), so the app cannot tell which to change.`,
      )
      continue
    }
    const row = rows[0]!
    const current = comparable(cellText(row.cells.bucket))
    if (current !== change.expected) {
      refusals.push(`"${slug}" changed since the app read it: its bucket is now ${current || 'blank'}.`)
      continue
    }
    if (current !== change.bucket) {
      cells.push({ tab: 'categories', sheetRow: row.sheetRow, column: 'bucket', value: change.bucket })
    }
  }
  refuseOn(refusals)
  return { cells, appends: [] }
}

/** After the write: each category is defined once, with the bucket written. */
export function verifyBucketChanges(after: FreshTabs, changes: readonly BucketChange[]): void {
  const defined = definedCategories(requireTab(after, 'categories').rows)
  for (const change of changes) {
    if (defined.find((category) => category.slug === comparable(change.category))?.bucket !== change.bucket) {
      throw new Error(`The write reached the workbook, but "${change.category}" does not read back in the ${change.bucket} bucket. Check the categories tab.`)
    }
  }
}

function settingProblems(rows: readonly SheetRow[]): string[] {
  return parseSettings(rows.map((row) => ({ key: cellText(row.cells.key), value: row.cells.value, sheetRow: row.sheetRow }))).problems.map(
    (problem) => problem.reason,
  )
}

interface KeyedLedgerRow extends SheetRow {
  readonly key: LedgerRowKey | null
}

function keyedLedgerRows(rows: readonly SheetRow[]): KeyedLedgerRow[] {
  return rows.map((row) => ({ ...row, key: ledgerRowKeyOfRow(row) }))
}

/** The one row the key names, or why there is not exactly one. */
function locate(rows: readonly KeyedLedgerRow[], key: LedgerRowKey): KeyedLedgerRow | string {
  const matches = rows.filter((row) => row.key !== null && isSameLedgerRow(key, row.key))
  const described = key.reference === '' ? `the ${key.account} row of ${key.date} without a reference` : `the ${key.account} row with reference ${key.reference}`
  if (matches.length === 0) {
    return `No ledger row matches ${described} any more. Sync and look again.`
  }
  if (matches.length > 1) {
    return `${matches.length} ledger rows match ${described} (rows ${matches.map((row) => row.sheetRow).join(', ')}), so the app cannot tell which to change. Set it in the Sheet.`
  }
  return matches[0]!
}

function requireTab(fresh: FreshTabs, tab: WorkbookTab): TabRead {
  const read = fresh[tab]
  if (read === undefined) {
    throw new WorkbookWriteRefused(`The workbook has no ${tab} tab, so nothing was written.`)
  }
  return read
}

function refuseOn(refusals: readonly string[]): void {
  if (refusals.length > 0) {
    throw new WorkbookWriteRefused(`Nothing was written. ${refusals.join(' ')}`)
  }
}

function comparable(text: string): string {
  return text.trim().toLowerCase()
}

function sentence(text: string): string {
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}.`
}
