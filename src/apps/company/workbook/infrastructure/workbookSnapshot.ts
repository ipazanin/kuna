import type { CopyMeta } from '../../../../shared/storage/application/workbookPorts'

/** A cell as an xlsx holds it, a date as its serial number. */
export type CellValue = string | number | boolean

/** One data row of a tab, keyed by header name. `sheetRow` is the 1-based row in the tab. */
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
  'employees',
  'splits',
  'dismissed',
] as const

export type WorkbookTab = (typeof WORKBOOK_TABS)[number]

/** The tabs the pack's records live on, which the pack maps and core keeps in the workbook format. */
export type PackTab = Extract<WorkbookTab, 'owner-advances' | 'assets' | 'grants' | 'year-end' | 'plan' | 'scenarios' | 'employees'>

/** The tabs core maps itself. */
export type CoreTab = Exclude<WorkbookTab, PackTab>

export type WorkbookTabs = { readonly [tab in WorkbookTab]: readonly SheetRow[] }

/** A workbook read from the tabs of an xlsx file, with what names it. */
export type WorkbookSnapshot = { readonly meta: CopyMeta } & WorkbookTabs

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
  employees: [],
  splits: [],
  dismissed: [],
}

/** Turns a tab's value grid, header row first, into rows keyed by header. A short row lacks the later headers. */
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
