import { RULE_COLUMNS } from '../../rules/domain/rule'
import { BILLING_PLAN_COLUMNS } from '../infrastructure/billingPlanTabReader'
import type { CellValue, SheetRow, WorkbookTab } from '../infrastructure/workbookSnapshot'
import { TEMPLATE_COLUMNS } from '../infrastructure/workbookTemplate'

/** One tab as it stands right before or right after a write. */
export interface TabRead {
  /** The header row as written, one entry per column from A. */
  readonly header: readonly string[]
  readonly rows: readonly SheetRow[]
  /** The last row with anything in it, the header being row 1. */
  readonly lastRow: number
}

export type FreshTabs = Partial<Record<WorkbookTab, TabRead>>

/** The tabs whose rows the Workbook, Transactions, Owner, Receivables, Billing plan, Forecast, Pay scenarios and Import screens add, change and delete. */
export type RowTab =
  | 'ledger'
  | 'categories'
  | 'accounts'
  | 'clients'
  | 'invoices'
  | 'outgoing-plan'
  | 'owner-advances'
  | 'assets'
  | 'grants'
  | 'year-end'
  | 'plan'
  | 'scenarios'
  | 'splits'

/** The tabs the app writes. */
export type WritableTab = 'rules' | 'settings' | RowTab

/** One cell set on an existing row, found by its header. An empty string clears the cell. */
export interface CellEdit {
  readonly tab: WritableTab
  readonly sheetRow: number
  readonly column: string
  readonly value: CellValue
}

/** A new row, its cells keyed by header: below the last one, or put in above row `before` of the read. */
export interface RowAppend {
  readonly tab: WritableTab
  readonly cells: Readonly<Record<string, CellValue>>
  readonly before?: number
}

/** A row taken out of its tab, the rows below it moving up, numbered as the read numbers it. */
export interface RowDeletion {
  readonly tab: WritableTab
  readonly sheetRow: number
}

/** A tab the workbook lacks, added with the template's header before anything is written to it. */
export interface NewTab {
  readonly tab: RowTab
  readonly header: readonly string[]
}

export interface TabEdits {
  readonly cells: readonly CellEdit[]
  readonly appends: readonly RowAppend[]
  /** Rows taken out whole, never together with cell edits or rows put in on the same tab. */
  readonly deletions?: readonly RowDeletion[]
  /** Only ever a tab the template defines, and only when the person asked for it. */
  readonly newTabs?: readonly NewTab[]
}

/** Where a write goes: the picked Google Sheet, or the workbook kept in this browser. */
export interface WorkbookWriter {
  /** The tabs as they stand now. A tab the workbook lacks is left out, and a plan that needs it refuses. */
  read(tabs: readonly WorkbookTab[]): Promise<FreshTabs>
  /** Writes the edits. `before` is the read the edits were planned on, whose headers place them. */
  write(edits: TabEdits, before: FreshTabs): Promise<void>
}

/** A write the app will not make, with the reason in words a person can act on. Nothing was written. */
export class WorkbookWriteRefused extends Error {
  constructor(reason: string) {
    super(reason)
    this.name = 'WorkbookWriteRefused'
  }
}

function templateColumns(tab: WorkbookTab): ReadonlySet<string> {
  return new Set(TEMPLATE_COLUMNS[tab].map((column) => column.name))
}

/** Whether the edits change anything at all. */
export function hasEdits(edits: TabEdits): boolean {
  return edits.cells.length > 0 || edits.appends.length > 0 || (edits.deletions ?? []).length > 0
}

/** Of a ledger row already on the tab the app changes only its verdict. A new row it writes whole. */
export const LEDGER_VERDICT_COLUMNS: ReadonlySet<string> = new Set(['category', 'flagged_by'])

/** The columns a cell edit may set on an existing row of the tab. */
export function editableColumns(tab: WritableTab): ReadonlySet<string> {
  return tab === 'ledger' ? LEDGER_VERDICT_COLUMNS : WRITABLE_COLUMNS[tab]
}

/**
 * The columns each tab lets the app write: the template's own columns, never a column the Sheet
 * keeps beside them. Anything else is a bug and fails before a request is sent.
 */
export const WRITABLE_COLUMNS: Readonly<Record<WritableTab, ReadonlySet<string>>> = {
  ledger: templateColumns('ledger'),
  rules: new Set(RULE_COLUMNS),
  settings: new Set(['key', 'value']),
  'owner-advances': templateColumns('owner-advances'),
  'outgoing-plan': new Set(BILLING_PLAN_COLUMNS),
  categories: templateColumns('categories'),
  accounts: templateColumns('accounts'),
  clients: templateColumns('clients'),
  invoices: templateColumns('invoices'),
  assets: templateColumns('assets'),
  grants: templateColumns('grants'),
  'year-end': templateColumns('year-end'),
  plan: templateColumns('plan'),
  scenarios: templateColumns('scenarios'),
  splits: templateColumns('splits'),
}


/** The row each row put in lands on once all of them are in, given the row of the read each goes above. Rows sharing a place keep their order. */
export function insertedRowNumbers(befores: readonly number[]): number[] {
  return befores.map((before, index) => before + befores.filter((other, otherIndex) => other < before || (other === before && otherIndex < index)).length)
}

/** The row a row of the read moves to once rows are put in above these rows. */
export function shiftedRowNumber(sheetRow: number, befores: readonly number[]): number {
  return sheetRow + befores.filter((before) => before <= sheetRow).length
}
