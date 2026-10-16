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
export async function batchGetValues(
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

export interface BatchUpdateResult {
  readonly totalUpdatedCells: number
}

/** Writes values exactly as given. RAW means Sheets never parses a string into a number or date. */
export async function batchUpdateValues(
  accessToken: string,
  spreadsheetId: string,
  writes: readonly ValueRange[],
): Promise<BatchUpdateResult> {
  const response = await googleFetch(
    `${SHEETS_API}/${encodeURIComponent(spreadsheetId)}/values:batchUpdate`,
    accessToken,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ valueInputOption: 'RAW', data: writes }),
    },
  )
  const body = (await response.json()) as { totalUpdatedCells?: number }
  return { totalUpdatedCells: body.totalUpdatedCells ?? 0 }
}

/** Each tab's numeric id by its title, which a link to a row on that tab needs as its `gid`. */
export async function getSheetIds(accessToken: string, spreadsheetId: string): Promise<ReadonlyMap<string, number>> {
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
