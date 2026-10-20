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

/** The tabs whose rows the Workbook, Receivables, Billing plan and Pay scenarios screens add, change and delete. */
export type RowTab = 'categories' | 'accounts' | 'clients' | 'invoices' | 'outgoing-plan' | 'assets' | 'grants' | 'year-end' | 'scenarios'

/** The tabs the app writes. Of the ledger it writes only the verdict of a row. */
export type WritableTab = 'ledger' | 'rules' | 'settings' | 'owner-advances' | RowTab

/** One cell set on an existing row, found by its header. An empty string clears the cell. */
export interface CellEdit {
  readonly tab: WritableTab
  readonly sheetRow: number
  readonly column: string
  readonly value: CellValue
}

/** A new row below the last one, its cells keyed by header. */
export interface RowAppend {
  readonly tab: WritableTab
  readonly cells: Readonly<Record<string, CellValue>>
}

/** A tab the workbook lacks, added with the template's header before anything is written to it. */
export interface NewTab {
  readonly tab: RowTab
  readonly header: readonly string[]
}

export interface TabEdits {
  readonly cells: readonly CellEdit[]
  readonly appends: readonly RowAppend[]
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

/**
 * The columns each tab lets the app write: the template's own columns, never a column the Sheet
 * keeps beside them. Anything else is a bug and fails before a request is sent.
 */
export const WRITABLE_COLUMNS: Readonly<Record<WritableTab, ReadonlySet<string>>> = {
  ledger: new Set(['category', 'flagged_by']),
  rules: new Set(RULE_COLUMNS),
  settings: new Set(['key', 'value']),
  'owner-advances': new Set(['date', 'amount', 'description', 'category']),
  'outgoing-plan': new Set(BILLING_PLAN_COLUMNS),
  categories: templateColumns('categories'),
  accounts: templateColumns('accounts'),
  clients: templateColumns('clients'),
  invoices: templateColumns('invoices'),
  assets: templateColumns('assets'),
  grants: templateColumns('grants'),
  'year-end': templateColumns('year-end'),
  scenarios: templateColumns('scenarios'),
}

