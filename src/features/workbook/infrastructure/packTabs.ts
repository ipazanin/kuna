import type { SpreadsheetTab } from './spreadsheetTab'
import type { CellValue, PackTab } from './workbookSnapshot'
import type { TemplateColumn } from './workbookTemplate'

/** A tab a pack's records live on: its mapping, its columns with their notes, and the number formats its cells take. */
export interface PackSpreadsheetTab<R> extends SpreadsheetTab<R> {
  readonly tab: PackTab
  readonly columns: readonly TemplateColumn[]
  /** The number format a number in the column takes, or null for a column the template keeps as typed. */
  numberFormat(column: string, cellOf: (column: string) => CellValue | undefined): string | null
}

let installed: readonly PackSpreadsheetTab<unknown>[] = []

/** Called once by main.ts with the pack's tabs, before the first workbook is read. */
export function installPackTabs(tabs: readonly PackSpreadsheetTab<unknown>[]): void {
  installed = tabs
}

/** The installed pack's tabs. */
export function installedPackTabs(): readonly PackSpreadsheetTab<unknown>[] {
  return installed
}

/** The installed pack's mapping of a tab, or null for a core tab or a pack tab no installed pack maps. */
export function packTabOf(tab: string): PackSpreadsheetTab<unknown> | null {
  return installed.find((mapping) => mapping.tab === tab) ?? null
}
