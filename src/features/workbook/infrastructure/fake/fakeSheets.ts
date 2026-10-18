import type { GoogleSheet } from '../../application/readFromGoogle'
import { columnLetter } from '../../../../shared/text/columnLetter'
import type { AppendRequest, BatchUpdateRequest, SheetsValues, ValueRange } from '../sheetsClient'
import type { CellValue } from '../workbookSnapshot'
import { FAKE_SPREADSHEET_ID, FAKE_WORKBOOK_TITLE, fakeWorkbookValues } from './fakeWorkbook'

export type RecordedSheetsRequest =
  | { readonly kind: 'sheetIds' }
  | { readonly kind: 'batchGet'; readonly ranges: readonly string[] }
  | { readonly kind: 'batchUpdate'; readonly request: BatchUpdateRequest }
  | { readonly kind: 'append'; readonly range: string; readonly request: AppendRequest }

/** A Google Sheet held in memory that answers the values API as Google does and records every request. */
export interface FakeSheets extends SheetsValues {
  /** Each tab's cells, row 1 first. Tests change them to play the ingest or a person in the Sheet. */
  readonly grids: Record<string, (CellValue | null)[][]>
  readonly requests: RecordedSheetsRequest[]
}

const SINGLE_CELL = /^([a-z_-]+)!([A-Z]+)(\d+)$/
const WHOLE_COLUMNS = /^([a-z_-]+)!A:([A-Z]+)$/

export function createFakeSheets(tabs: Readonly<Record<string, readonly (readonly CellValue[])[]>>): FakeSheets {
  const grids: Record<string, (CellValue | null)[][]> = Object.fromEntries(Object.entries(tabs).map(([tab, rows]) => [tab, rows.map((row) => [...row])]))
  const requests: RecordedSheetsRequest[] = []

  function gridOf(tab: string): (CellValue | null)[][] {
    const grid = grids[tab]
    if (grid === undefined) {
      throw new Error(`400 from the fake Sheet: Unable to parse range: ${tab}`)
    }
    return grid
  }

  return {
    grids,
    requests,

    async sheetIds() {
      requests.push({ kind: 'sheetIds' })
      return new Map(Object.keys(grids).map((tab, index) => [tab, index]))
    },

    async batchGet(ranges) {
      requests.push({ kind: 'batchGet', ranges: [...ranges] })
      return ranges.map((range): ValueRange => ({ range, values: trimmed(gridOf(range)) }))
    },

    async batchUpdate(request) {
      requests.push({ kind: 'batchUpdate', request })
      for (const write of request.data) {
        const match = SINGLE_CELL.exec(write.range)
        if (match === null) {
          throw new Error(`The fake Sheet writes single cells only, not ${write.range}`)
        }
        const [, tab, letters, row] = match as unknown as [string, string, string, string]
        const grid = gridOf(tab)
        const rowIndex = Number(row) - 1
        const columnIndex = columnIndexOf(letters)
        while (grid.length <= rowIndex) grid.push([])
        const cells = grid[rowIndex]!
        while (cells.length <= columnIndex) cells.push(null)
        cells[columnIndex] = write.values[0]?.[0] ?? null
      }
    },

    async append(range, request) {
      requests.push({ kind: 'append', range, request })
      const match = WHOLE_COLUMNS.exec(range)
      if (match === null) {
        throw new Error(`The fake Sheet appends to whole columns from A only, not ${range}`)
      }
      const grid = gridOf(match[1]!)
      // The table ends at the last row with anything in it, and INSERT_ROWS adds rows right below it.
      grid.splice(trimmed(grid).length, 0, ...request.values.map((row) => [...row]))
    },
  }
}

/** As the API returns a range: no trailing empty cells on a row and no trailing empty rows. */
function trimmed(grid: readonly (readonly (CellValue | null)[])[]): CellValue[][] {
  const rows = grid.map((row) => {
    const cells = row.map((cell) => cell ?? '')
    while (cells.length > 0 && cells[cells.length - 1] === '') cells.pop()
    return cells
  })
  while (rows.length > 0 && rows[rows.length - 1]!.length === 0) rows.pop()
  return rows
}

function columnIndexOf(letters: string): number {
  for (let column = 1; column <= 18_278; column += 1) {
    if (columnLetter(column) === letters) {
      return column - 1
    }
  }
  throw new Error(`${letters} is not a column`)
}

export const fakeGoogleSheet: GoogleSheet = { id: FAKE_SPREADSHEET_ID, name: FAKE_WORKBOOK_TITLE }

let session: FakeSheets | null = null

/** The fake build's Google Sheet, the same one for every sync and write until the page reloads. */
export function fakeSheetsSession(): FakeSheets {
  session ??= createFakeSheets(fakeWorkbookValues('google'))
  return session
}
