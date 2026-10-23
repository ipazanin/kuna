import type { CopyMeta } from '../application/workbookPorts'

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
  'dismissed',
] as const

export type WorkbookTab = (typeof WORKBOOK_TABS)[number]

/** The tabs the pack's records live on, which the pack maps and core keeps in the workbook format. */
export type PackTab = Extract<WorkbookTab, 'owner-advances' | 'assets' | 'grants' | 'year-end' | 'plan' | 'scenarios'>

/** The tabs core maps itself. */
export type CoreTab = Exclude<WorkbookTab, PackTab>

export type WorkbookTabs = { readonly [tab in WorkbookTab]: readonly SheetRow[] }

/** A workbook copy's meta, with the tabs a Google Sheet lacks. A workbook kept in this browser has every tab, since an export writes them all. */
export interface WorkbookMeta extends CopyMeta {
  readonly missingTabs: readonly WorkbookTab[]
  /**
   * The template columns other than the id that a tab of a Google Sheet lacks, by tab. A tab
   * missing here lacks none the app knows of, as every tab of a workbook kept in this browser.
   */
  readonly missingColumns?: Readonly<Partial<Record<WorkbookTab, readonly string[]>>>
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
  dismissed: [],
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
