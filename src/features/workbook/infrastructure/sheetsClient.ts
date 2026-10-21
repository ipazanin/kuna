import { googleFetch } from './googleApi'
import type { CellValue } from './workbookSnapshot'

const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets'

/** A tab's name as A1 notation takes it: quoted, unless it is letters, digits and underscores only, such as `ledger`. */
export function sheetNameInRange(tab: string): string {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(tab) ? tab : `'${tab.replace(/'/g, "''")}'`
}

export interface ValueRange {
  readonly range: string
  readonly values: CellValue[][]
}

/**
 * Reads several ranges in one call. Numbers stay numbers and dates arrive as serial days, so no
 * locale formatting ever reaches the parser.
 */
async function batchGetValues(
  accessToken: string,
  spreadsheetId: string,
  ranges: readonly string[],
): Promise<ValueRange[]> {
  const query = new URLSearchParams({
    majorDimension: 'ROWS',
    valueRenderOption: 'UNFORMATTED_VALUE',
    dateTimeRenderOption: 'SERIAL_NUMBER',
  })
  for (const range of ranges) {
    query.append('ranges', range)
  }
  const response = await googleFetch(
    `${SHEETS_API}/${encodeURIComponent(spreadsheetId)}/values:batchGet?${query}`,
    accessToken,
  )
  const body = (await response.json()) as { valueRanges?: { range: string; values?: CellValue[][] }[] }
  return (body.valueRanges ?? []).map((valueRange) => ({
    range: valueRange.range,
    values: valueRange.values ?? [],
  }))
}

/** A range of whole rows of one tab, 0-based and end-exclusive, as `spreadsheets.batchUpdate` takes it. */
export interface RowSpan {
  readonly sheetId: number
  readonly startIndex: number
  readonly endIndex: number
}

/**
 * A cell's value as `spreadsheets.batchUpdate` writes it. Text goes in as `stringValue`, which Sheets
 * stores as given and never parses into a number, a date or a formula. An empty object clears the cell.
 */
export type CellData = { readonly userEnteredValue?: { readonly stringValue: string } | { readonly numberValue: number } | { readonly boolValue: boolean } }

/** One row of cells from the first column a request names. */
export interface RowData {
  readonly values: readonly CellData[]
}

/** Where an update starts: a 0-based row and column of one tab. */
export interface GridCoordinate {
  readonly sheetId: number
  readonly rowIndex: number
  readonly columnIndex: number
}

/** How a cell shows a number or text: a date as `yyyy-mm-dd`, or text as typed. */
export interface NumberFormat {
  readonly type: 'DATE' | 'TEXT'
  readonly pattern: string
}

/** The requests the app sends: a new tab, rows put in or taken out, the formats and dropdowns copied onto new rows, cell values and cell number formats. */
export type SpreadsheetRequest =
  | { readonly addSheet: { readonly properties: { readonly sheetId: number; readonly title: string } } }
  | { readonly insertDimension: { readonly range: RowSpan & { readonly dimension: 'ROWS' }; readonly inheritFromBefore: boolean } }
  | { readonly deleteDimension: { readonly range: RowSpan & { readonly dimension: 'ROWS' } } }
  | {
      readonly copyPaste: {
        readonly source: GridSpan
        readonly destination: GridSpan
        readonly pasteType: 'PASTE_FORMAT' | 'PASTE_DATA_VALIDATION'
        readonly pasteOrientation: 'NORMAL'
      }
    }
  | { readonly updateCells: { readonly start: GridCoordinate; readonly rows: readonly RowData[]; readonly fields: 'userEnteredValue' } }
  | { readonly appendCells: { readonly sheetId: number; readonly rows: readonly RowData[]; readonly fields: 'userEnteredValue' } }
  | {
      readonly repeatCell: {
        readonly range: GridSpan
        readonly cell: { readonly userEnteredFormat: { readonly numberFormat: NumberFormat } }
        readonly fields: 'userEnteredFormat.numberFormat'
      }
    }

export interface GridSpan {
  readonly sheetId: number
  readonly startRowIndex: number
  readonly endRowIndex: number
  readonly startColumnIndex: number
  readonly endColumnIndex: number
}

/** Sends the requests in one call, which Sheets applies in order, and not at all when any of them is not valid. */
async function updateSpreadsheetOf(accessToken: string, spreadsheetId: string, requests: readonly SpreadsheetRequest[]): Promise<void> {
  await googleFetch(`${SHEETS_API}/${encodeURIComponent(spreadsheetId)}:batchUpdate`, accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests }),
  })
}

/** Each tab's numeric id by its title, which a link to a row on that tab needs as its `gid`. */
async function getSheetIds(accessToken: string, spreadsheetId: string): Promise<ReadonlyMap<string, number>> {
  const query = new URLSearchParams({ fields: 'sheets.properties(title,sheetId)' })
  const response = await googleFetch(`${SHEETS_API}/${encodeURIComponent(spreadsheetId)}?${query}`, accessToken)
  const body = (await response.json()) as { sheets?: { properties?: { title?: string; sheetId?: number } }[] }
  return new Map(
    (body.sheets ?? []).flatMap((sheet) => {
      const { title, sheetId } = sheet.properties ?? {}
      return title === undefined || sheetId === undefined ? [] : [[title, sheetId] as const]
    }),
  )
}

/** The Sheets API for one spreadsheet, as the read and write paths use it. */
export interface SheetsValues {
  sheetIds(): Promise<ReadonlyMap<string, number>>
  batchGet(ranges: readonly string[]): Promise<ValueRange[]>
  updateSpreadsheet(requests: readonly SpreadsheetRequest[]): Promise<void>
}

export function sheetsValuesFor(accessToken: string, spreadsheetId: string): SheetsValues {
  return {
    sheetIds: () => getSheetIds(accessToken, spreadsheetId),
    batchGet: (ranges) => batchGetValues(accessToken, spreadsheetId, ranges),
    updateSpreadsheet: (requests) => updateSpreadsheetOf(accessToken, spreadsheetId, requests),
  }
}
