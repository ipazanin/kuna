import { RULE_COLUMNS } from '../../rules/domain/rule'
import type { CellValue, SheetRow, WorkbookTab } from './workbookSnapshot'
import { OWNER_SHARE_COLUMN, templateColumnNames } from './workbookTemplate'

/** One tab as it stands right before or right after a write. */
export interface TabRead {
  /** The header row as written, one entry per column from A. */
  readonly header: readonly string[]
  readonly rows: readonly SheetRow[]
  /** The last row with anything in it, the header being row 1. */
  readonly lastRow: number
}

export type FreshTabs = Partial<Record<WorkbookTab, TabRead>>

/** The tabs whose rows the Settings, Transactions, Review, Owner, Invoicing and Year screens add, change and delete. */
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
  | 'dismissed'

/** The tabs the app writes. */
export type WritableTab = 'rules' | 'settings' | RowTab

/** One cell set on an existing row, found by its header. An empty string clears the cell. */
export interface CellEdit {
  readonly tab: WritableTab
  readonly sheetRow: number
  readonly column: string
  readonly value: CellValue
}

/** A new row, its cells keyed by header: below the last one, or put in so that it stands on row `at` once the write is done. */
export interface RowAppend {
  readonly tab: WritableTab
  readonly cells: Readonly<Record<string, CellValue>>
  readonly at?: number
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

/** A template column the tab lacks, headed in row 1 after the last column in use before anything is written to it. */
export interface NewColumn {
  readonly tab: RowTab
  readonly column: string
}

/**
 * One write, carried out in this order: the tabs added, the columns added, the cells set on rows as
 * the read numbers them, the rows taken out, the rows put in on their `at` rows from the top down,
 * then the rows added below the last one.
 */
export interface TabEdits {
  readonly cells: readonly CellEdit[]
  readonly appends: readonly RowAppend[]
  readonly deletions?: readonly RowDeletion[]
  /** Only ever a tab the template defines, and only when the person asked for it. */
  readonly newTabs?: readonly NewTab[]
  readonly newColumns?: readonly NewColumn[]
}

/** Where a write goes: the picked Google Sheet, or the workbook kept in this browser. */
export interface WorkbookWriter {
  /** The tabs as they stand now. A tab the workbook lacks is left out, and a plan that needs it refuses. */
  read(tabs: readonly WorkbookTab[]): Promise<FreshTabs>
  /** Writes the edits. `before` is the read the edits were planned on, whose headers place them. */
  write(edits: TabEdits, before: FreshTabs): Promise<void>
}

/** Of a ledger row already on the tab the app changes only its verdict and the owner share filed with it. A new row it writes whole. */
export const LEDGER_VERDICT_COLUMNS: ReadonlySet<string> = new Set(['category', 'flagged_by', OWNER_SHARE_COLUMN])

/** The columns a cell edit may set on an existing row of the tab. */
export function editableColumns(tab: WritableTab): ReadonlySet<string> {
  return tab === 'ledger' ? LEDGER_VERDICT_COLUMNS : writableColumns(tab)
}

/**
 * The columns a tab lets the app write: the template's own columns, never a column the Sheet keeps
 * beside them. Anything else is a bug and fails before a request is sent.
 */
export function writableColumns(tab: WritableTab): ReadonlySet<string> {
  switch (tab) {
    case 'rules':
      return new Set(RULE_COLUMNS)
    case 'settings':
      return new Set(['key', 'value'])
    default:
      return new Set(templateColumnNames(tab))
  }
}
