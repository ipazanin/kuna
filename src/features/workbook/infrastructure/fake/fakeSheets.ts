import type { GoogleSheet } from '../../application/readFromGoogle'
import type { CellData, RowData, SheetsValues, SpreadsheetRequest, ValueRange } from '../sheetsClient'
import type { CellValue, WorkbookTab } from '../workbookSnapshot'
import { FAKE_SHEET_LACKS, FAKE_SPREADSHEET_ID, FAKE_WORKBOOK_TITLE, fakeWorkbookValues } from './fakeWorkbook'

export type RecordedSheetsRequest =
  | { readonly kind: 'sheetIds' }
  | { readonly kind: 'batchGet'; readonly ranges: readonly string[] }
  | { readonly kind: 'updateSpreadsheet'; readonly requests: readonly SpreadsheetRequest[] }

/** A Google Sheet held in memory that answers reads and `spreadsheets.batchUpdate` as Google does and records every request. */
export interface FakeSheets extends SheetsValues {
  /** Each tab's cells, row 1 first. Tests change them to play the ingest or a person in the Sheet. */
  readonly grids: Record<string, (CellValue | null)[][]>
  /** Each tab's number formats, such as `yyyy-mm-dd`, in the same rows and columns as its cells. A cell without one is null or missing. */
  readonly formats: Record<string, (string | null)[][]>
  readonly requests: RecordedSheetsRequest[]
  /** The tab a sheet id names, as a request gives it. */
  tabWithId(sheetId: number): string | undefined
}

export function createFakeSheets(
  tabs: Readonly<Record<string, readonly (readonly CellValue[])[]>>,
  numberFormats: Readonly<Record<string, readonly (readonly (string | null)[])[]>> = {},
): FakeSheets {
  const grids: Record<string, (CellValue | null)[][]> = Object.fromEntries(Object.entries(tabs).map(([tab, rows]) => [tab, rows.map((row) => [...row])]))
  const formats: Record<string, (string | null)[][]> = Object.fromEntries(Object.keys(grids).map((tab) => [tab, (numberFormats[tab] ?? []).map((row) => [...row])]))
  const requests: RecordedSheetsRequest[] = []
  const ids = new Map(Object.keys(grids).map((tab, index) => [tab, index]))

  /** A tab by its name in a range, where a name with a hyphen arrives quoted. */
  function gridOf(rangeName: string): (CellValue | null)[][] {
    const tab = rangeName.replace(/^'(.*)'$/, '$1')
    const grid = grids[tab]
    if (grid === undefined) {
      throw new Error(`400 from the fake Sheet: Unable to parse range: ${tab}`)
    }
    return grid
  }

  return {
    grids,
    formats,
    requests,

    tabWithId(sheetId) {
      return [...ids].find(([, id]) => id === sheetId)?.[0]
    },

    async sheetIds() {
      requests.push({ kind: 'sheetIds' })
      return new Map(ids)
    },

    async batchGet(ranges) {
      requests.push({ kind: 'batchGet', ranges: [...ranges] })
      return ranges.map((range): ValueRange => ({ range, values: trimmed(gridOf(range)) }))
    },

    async updateSpreadsheet(changes) {
      requests.push({ kind: 'updateSpreadsheet', requests: changes })
      // Sheets applies all of the requests or none, so the fake works on copies and keeps them only when every request went through.
      const working: Record<string, (CellValue | null)[][]> = Object.fromEntries(Object.entries(grids).map(([tab, grid]) => [tab, grid.map((row) => [...row])]))
      const workingFormats: Record<string, (string | null)[][]> = Object.fromEntries(Object.entries(formats).map(([tab, grid]) => [tab, grid.map((row) => [...row])]))
      const workingIds = new Map(ids)
      const tabNameOf = (sheetId: number): string => {
        const tab = [...workingIds].find(([, id]) => id === sheetId)?.[0]
        if (tab === undefined) throw new Error(`400 from the fake Sheet: No grid with id: ${sheetId}`)
        return tab
      }
      const tabOf = (sheetId: number): (CellValue | null)[][] => working[tabNameOf(sheetId)]!
      /** The tab's formats, padded to at least this many rows, so a row put in or taken out lines up with the cells. */
      const formatsOf = (sheetId: number, rows: number): (string | null)[][] => {
        const grid = (workingFormats[tabNameOf(sheetId)] ??= [])
        while (grid.length < rows) grid.push([])
        return grid
      }
      for (const change of changes) {
        if ('addSheet' in change) {
          const { title, sheetId } = change.addSheet.properties
          if (working[title] !== undefined || [...workingIds.values()].includes(sheetId)) {
            throw new Error(`400 from the fake Sheet: A sheet with the name "${title}" or the id ${sheetId} already exists.`)
          }
          working[title] = []
          workingFormats[title] = []
          workingIds.set(title, sheetId)
        } else if ('insertDimension' in change) {
          const { sheetId, startIndex, endIndex } = change.insertDimension.range
          const grid = tabOf(sheetId)
          while (grid.length < startIndex) grid.push([])
          grid.splice(startIndex, 0, ...Array.from({ length: endIndex - startIndex }, () => []))
          formatsOf(sheetId, startIndex).splice(startIndex, 0, ...Array.from({ length: endIndex - startIndex }, () => []))
        } else if ('deleteDimension' in change) {
          const { sheetId, startIndex, endIndex } = change.deleteDimension.range
          tabOf(sheetId).splice(startIndex, endIndex - startIndex)
          formatsOf(sheetId, endIndex).splice(startIndex, endIndex - startIndex)
        } else if ('updateCells' in change) {
          const { start, rows } = change.updateCells
          writeRows(tabOf(start.sheetId), start.rowIndex, start.columnIndex, rows)
        } else if ('appendCells' in change) {
          const grid = tabOf(change.appendCells.sheetId)
          // New cells go right after the last row with anything in it.
          writeRows(grid, trimmed(grid).length, 0, change.appendCells.rows)
        } else if ('repeatCell' in change) {
          const { range, cell } = change.repeatCell
          const grid = formatsOf(range.sheetId, range.endRowIndex)
          for (let row = range.startRowIndex; row < range.endRowIndex; row += 1) {
            for (let column = range.startColumnIndex; column < range.endColumnIndex; column += 1) grid[row]![column] = cell.userEnteredFormat.numberFormat.pattern
          }
        } else if ('copyPaste' in change && change.copyPaste.pasteType === 'PASTE_FORMAT') {
          const { source, destination } = change.copyPaste
          const grid = formatsOf(source.sheetId, Math.max(source.endRowIndex, destination.endRowIndex))
          for (let row = destination.startRowIndex; row < destination.endRowIndex; row += 1) {
            const from = source.startRowIndex + ((row - destination.startRowIndex) % (source.endRowIndex - source.startRowIndex))
            for (let column = destination.startColumnIndex; column < destination.endColumnIndex; column += 1) grid[row]![column] = grid[from]![column] ?? null
          }
        }
        // A copied dropdown leaves no value or number format behind, so the fake has nothing to do for it.
      }
      for (const tab of Object.keys(working)) {
        grids[tab] = working[tab]!
        formats[tab] = workingFormats[tab] ?? []
      }
      ids.clear()
      for (const [tab, id] of workingIds) ids.set(tab, id)
    },
  }
}

function writeRows(grid: (CellValue | null)[][], rowIndex: number, columnIndex: number, rows: readonly RowData[]): void {
  rows.forEach((row, offset) => {
    while (grid.length <= rowIndex + offset) grid.push([])
    const cells = grid[rowIndex + offset]!
    row.values.forEach((cell, column) => {
      while (cells.length <= columnIndex + column) cells.push(null)
      cells[columnIndex + column] = valueOf(cell)
    })
  })
}

function valueOf(cell: CellData): CellValue | null {
  const value = cell.userEnteredValue
  if (value === undefined) return null
  return 'stringValue' in value ? value.stringValue : 'numberValue' in value ? value.numberValue : value.boolValue
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

export const fakeGoogleSheet: GoogleSheet = { id: FAKE_SPREADSHEET_ID, name: FAKE_WORKBOOK_TITLE }

let session: FakeSheets | null = null
let leftOut: readonly WorkbookTab[] = []

/** The tabs the fake build's Google Sheet lacks for this page, as its `?fake=` variant says. Set before the first sync or write. */
export function leaveOutOfFakeSheet(tabs: readonly WorkbookTab[]): void {
  leftOut = tabs
}

/** The fake build's Google Sheet, the same one for every sync and write until the page reloads. */
export function fakeSheetsSession(): FakeSheets {
  session ??= createFakeSheets(Object.fromEntries(Object.entries(fakeWorkbookValues('google')).filter(([tab]) => ![...FAKE_SHEET_LACKS, ...leftOut].includes(tab as WorkbookTab))))
  return session
}
