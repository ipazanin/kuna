/** A cell as the Sheets API returns it with UNFORMATTED_VALUE and SERIAL_NUMBER dates. */
export type CellValue = string | number | boolean

/** One data row of a tab, keyed by header name. `sheetRow` is the 1-based row in the Sheet. */
export interface SheetRow {
  readonly sheetRow: number
  readonly cells: Readonly<Record<string, CellValue>>
}

export const CACHED_TABS = ['ledger', 'categories', 'accounts'] as const

export type CachedTab = (typeof CACHED_TABS)[number]

export interface WorkbookMeta {
  readonly spreadsheetId: string
  readonly title: string
  /** ISO timestamp of the read that produced this copy. */
  readonly syncedAt: string
  /** The `ledger` tab's numeric id, for links to its rows. Null when Google did not say. */
  readonly ledgerSheetId: number | null
}

export type WorkbookSnapshot = { readonly meta: WorkbookMeta } & {
  readonly [tab in CachedTab]: readonly SheetRow[]
}

/**
 * Turns a tab's value grid (header row first) into rows keyed by header. The API drops trailing
 * empty cells and rows, so a short row simply lacks the later headers.
 */
export function sheetRowsFromValues(values: readonly (readonly CellValue[])[]): SheetRow[] {
  const [header = [], ...dataRows] = values
  const headerNames = header.map((name) => String(name).trim())
  return dataRows
    .map((cells, index) => ({
      sheetRow: index + 2,
      cells: Object.fromEntries(
        headerNames
          .map((name, column) => [name, cells[column]] as const)
          .filter((pair): pair is readonly [string, CellValue] => pair[0] !== '' && pair[1] !== undefined && pair[1] !== ''),
      ),
    }))
    .filter((row) => Object.keys(row.cells).length > 0)
}
