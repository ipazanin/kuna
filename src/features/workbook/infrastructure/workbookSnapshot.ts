import type { WorkbookSource } from '../domain/workbook'

/** A cell as the Sheets API returns it with UNFORMATTED_VALUE and SERIAL_NUMBER dates, and as an xlsx holds it. */
export type CellValue = string | number | boolean

/** One data row of a tab, keyed by header name. `sheetRow` is the 1-based row in the Sheet. */
export interface SheetRow {
  readonly sheetRow: number
  readonly cells: Readonly<Record<string, CellValue>>
}

/** The tabs of the workbook format. Only `ledger` is required. A missing tab reads as empty. */
export const WORKBOOK_TABS = [
  'ledger',
  'categories',
  'accounts',
  'settings',
  'rules',
  'invoices',
  'clients',
  'outgoing-plan',
  'owner-advances',
  'assets',
  'grants',
  'year-end',
  'plan',
  'scenarios',
  'splits',
] as const

export type WorkbookTab = (typeof WORKBOOK_TABS)[number]

export type WorkbookTabs = { readonly [tab in WorkbookTab]: readonly SheetRow[] }

export interface WorkbookMeta {
  /** The Google spreadsheet id, or the id of the workbook kept in this browser. */
  readonly id: string
  readonly source: WorkbookSource
  readonly title: string
  /** ISO timestamp of the read that produced this copy, or of the last change kept in this browser. */
  readonly syncedAt: string
  /** The `ledger` tab's numeric id, for links to its rows. Null when Google did not say, and in Excel mode. */
  readonly ledgerSheetId: number | null
  /** ISO timestamp of the last export to an xlsx file, or null. */
  readonly lastExportedAt: string | null
  /** When the oldest change not yet in an exported file was made. Null when every change is exported. */
  readonly unexportedSince: string | null
  /** The tabs a Google Sheet lacks. A workbook kept in this browser has every tab, since an export writes them all. */
  readonly missingTabs: readonly WorkbookTab[]
}

export type WorkbookSnapshot = { readonly meta: WorkbookMeta } & WorkbookTabs

export const EMPTY_TABS: WorkbookTabs = {
  ledger: [],
  categories: [],
  accounts: [],
  settings: [],
  rules: [],
  invoices: [],
  clients: [],
  'outgoing-plan': [],
  'owner-advances': [],
  assets: [],
  grants: [],
  'year-end': [],
  plan: [],
  scenarios: [],
  splits: [],
}

/**
 * Turns a tab's value grid (header row first) into rows keyed by header. The API drops trailing
 * empty cells and rows, so a short row simply lacks the later headers.
 */
export function sheetRowsFromValues(values: readonly (readonly (CellValue | null | undefined)[])[]): SheetRow[] {
  const [header = [], ...dataRows] = values
  const headerNames = header.map((name) => String(name ?? '').trim())
  return dataRows
    .map((cells, index) => ({
      sheetRow: index + 2,
      cells: Object.fromEntries(
        headerNames
          .map((name, column) => [name, cells?.[column]] as const)
          .filter(
            (pair): pair is readonly [string, CellValue] =>
              pair[0] !== '' && pair[1] !== undefined && pair[1] !== null && pair[1] !== '',
          ),
      ),
    }))
    .filter((row) => Object.keys(row.cells).length > 0)
}
