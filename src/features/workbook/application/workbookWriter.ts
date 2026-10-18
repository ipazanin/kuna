import { RULE_COLUMNS } from '../../rules/domain/rule'
import type { CellValue, SheetRow, WorkbookTab } from '../infrastructure/workbookSnapshot'

/** One tab as it stands right before or right after a write. */
export interface TabRead {
  /** The header row as written, one entry per column from A. */
  readonly header: readonly string[]
  readonly rows: readonly SheetRow[]
  /** The last row with anything in it, the header being row 1. */
  readonly lastRow: number
}

export type FreshTabs = Partial<Record<WorkbookTab, TabRead>>

/**
 * The tabs the app writes. Of `categories` it writes only a bucket, which the Apps Script accepts
 * from the tab's own dropdown, and `accounts` it never writes.
 */
export type WritableTab = 'ledger' | 'rules' | 'settings' | 'categories' | 'owner-advances'

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

export interface TabEdits {
  readonly cells: readonly CellEdit[]
  readonly appends: readonly RowAppend[]
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

/** The columns each tab lets the app write. Anything else is a bug and fails before a request is sent. */
export const WRITABLE_COLUMNS: Readonly<Record<WritableTab, ReadonlySet<string>>> = {
  ledger: new Set(['category', 'flagged_by']),
  rules: new Set(RULE_COLUMNS),
  settings: new Set(['key', 'value']),
  categories: new Set(['bucket']),
  'owner-advances': new Set(['date', 'amount', 'description', 'category']),
}

