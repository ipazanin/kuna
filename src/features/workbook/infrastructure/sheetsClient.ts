import { googleFetch } from './googleApi'
import type { CellValue } from './workbookSnapshot'

const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets'

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

/** RAW: Sheets stores each value as given and never parses a string into a number, a date or a formula. */
export type ValueInputOption = 'RAW'

export interface BatchUpdateRequest {
  readonly valueInputOption: ValueInputOption
  readonly data: readonly ValueRange[]
}

async function batchUpdateValues(accessToken: string, spreadsheetId: string, request: BatchUpdateRequest): Promise<void> {
  await googleFetch(`${SHEETS_API}/${encodeURIComponent(spreadsheetId)}/values:batchUpdate`, accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })
}

export interface AppendRequest {
  readonly valueInputOption: ValueInputOption
  /** INSERT_ROWS writes into new rows, so nothing below the table is overwritten. */
  readonly insertDataOption: 'INSERT_ROWS'
  readonly values: readonly (readonly CellValue[])[]
}

/** Adds rows after the table the range finds, starting at the table's first column. */
async function appendValues(accessToken: string, spreadsheetId: string, range: string, request: AppendRequest): Promise<void> {
  const query = new URLSearchParams({ valueInputOption: request.valueInputOption, insertDataOption: request.insertDataOption })
  await googleFetch(`${SHEETS_API}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}:append?${query}`, accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ majorDimension: 'ROWS', values: request.values }),
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

/** The Sheets values API for one spreadsheet, as the read and write paths use it. */
export interface SheetsValues {
  sheetIds(): Promise<ReadonlyMap<string, number>>
  batchGet(ranges: readonly string[]): Promise<ValueRange[]>
  batchUpdate(request: BatchUpdateRequest): Promise<void>
  append(range: string, request: AppendRequest): Promise<void>
}

export function sheetsValuesFor(accessToken: string, spreadsheetId: string): SheetsValues {
  return {
    sheetIds: () => getSheetIds(accessToken, spreadsheetId),
    batchGet: (ranges) => batchGetValues(accessToken, spreadsheetId, ranges),
    batchUpdate: (request) => batchUpdateValues(accessToken, spreadsheetId, request),
    append: (range, request) => appendValues(accessToken, spreadsheetId, range, request),
  }
}
