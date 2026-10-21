import { cellText } from '../../../shared/text/cellText'
import { WRITABLE_COLUMNS, WorkbookWriteRefused, editableColumns } from '../application/workbookWriter'
import type { FreshTabs, RowAppend, TabRead, WorkbookWriter, WritableTab } from '../application/workbookWriter'
import { sheetNameInRange } from './sheetsClient'
import type { CellData, RowData, SheetsValues, SpreadsheetRequest } from './sheetsClient'
import { sheetRowsFromValues } from './workbookSnapshot'
import type { CellValue } from './workbookSnapshot'

/**
 * Writes to the picked Google Sheet in one `spreadsheets.batchUpdate`, which Sheets applies whole or
 * not at all, so a failed write never leaves half of itself behind. Every request is worked out
 * before it is sent. A cell edit names one cell by its header's column and its row, so nothing else
 * on the row is touched.
 *
 * The requests run in the order `TabEdits` gives: a new tab with its header, the cell edits, the
 * rows taken out from the bottom up, the rows put in from the top down, each block with the format
 * and the dropdowns of the row below copied onto it the way the shadow-accounting Apps Script
 * inserts a batch, and last the rows added below the last one.
 */
export function googleWorkbookWriter(sheets: SheetsValues): WorkbookWriter {
  let sheetIds: ReadonlyMap<string, number> | null = null
  return {
    async read(tabs) {
      // A batchGet fails whole on a tab that does not exist, so it asks only for the tabs the Sheet has.
      sheetIds = await sheets.sheetIds()
      const present = tabs.filter((tab) => sheetIds!.has(tab))
      const ranges = await sheets.batchGet(present.map(sheetNameInRange))
      return Object.fromEntries(present.map((tab, index) => [tab, tabReadOf(ranges[index]?.values ?? [])]))
    },

    async write(edits, before) {
      if (sheetIds === null) {
        throw new Error('A write was planned before the Sheet was read.')
      }
      const ids = new Map(sheetIds)
      const newTabs = edits.newTabs ?? []
      for (const { tab } of newTabs) {
        if (before[tab] !== undefined || ids.has(tab)) {
          throw new Error(`The ${tab} tab is already in the Sheet, so it is not added again.`)
        }
        ids.set(tab, unusedSheetId(ids))
      }
      // A tab added here reads as its template header, so the edits below place their cells the same way.
      const read: FreshTabs = { ...before, ...Object.fromEntries(newTabs.map(({ tab, header }) => [tab, { header, rows: [], lastRow: 1 }])) }
      const sheetIdOf = (tab: WritableTab): number => {
        const sheetId = ids.get(tab)
        if (sheetId === undefined) {
          throw new WorkbookWriteRefused(`The Sheet has no ${tab} tab, so nothing was written.`)
        }
        return sheetId
      }
      const deletions = edits.deletions ?? []
      const placed = edits.appends.filter((append) => append.at !== undefined)
      const atFoot = edits.appends.filter((append) => append.at === undefined)
      const requests: SpreadsheetRequest[] = [
        ...newTabs.flatMap(({ tab, header }): SpreadsheetRequest[] => [
          { addSheet: { properties: { sheetId: sheetIdOf(tab), title: tab } } },
          { updateCells: { start: { sheetId: sheetIdOf(tab), rowIndex: 0, columnIndex: 0 }, rows: [{ values: header.map(cellData) }], fields: 'userEnteredValue' } },
        ]),
        ...edits.cells.map((edit): SpreadsheetRequest => {
          if (!editableColumns(edit.tab).has(edit.column)) {
            throw new Error(`The app never changes the ${edit.column} column of a row already on the ${edit.tab} tab.`)
          }
          const start = { sheetId: sheetIdOf(edit.tab), rowIndex: edit.sheetRow - 1, columnIndex: columnOf(read, edit.tab, edit.column) - 1 }
          return { updateCells: { start, rows: [{ values: [cellData(edit.value)] }], fields: 'userEnteredValue' } }
        }),
        ...[...deletions]
          .sort((upper, lower) => lower.sheetRow - upper.sheetRow)
          .map((deletion): SpreadsheetRequest => ({
            deleteDimension: { range: { sheetId: sheetIdOf(deletion.tab), dimension: 'ROWS', startIndex: deletion.sheetRow - 1, endIndex: deletion.sheetRow } },
          })),
        ...[...new Set(placed.map((append) => append.tab))].flatMap((tab) => insertedBlocks(read, tab, sheetIdOf(tab), placed.filter((append) => append.tab === tab))),
        ...[...new Set(atFoot.map((append) => append.tab))].map((tab): SpreadsheetRequest => ({
          appendCells: { sheetId: sheetIdOf(tab), rows: atFoot.filter((append) => append.tab === tab).map((append) => rowData(read, tab, append)), fields: 'userEnteredValue' },
        })),
      ]
      if (requests.length > 0) {
        await sheets.updateSpreadsheet(requests)
      }
    },
  }
}

/** The smallest id no tab of the Sheet holds, for a tab added in the same request that writes to it. */
function unusedSheetId(ids: ReadonlyMap<string, number>): number {
  const taken = new Set(ids.values())
  let candidate = 1
  while (taken.has(candidate)) candidate += 1
  return candidate
}

/**
 * The rows put in on one tab, each run of rows that land one under another as one block, from the
 * top down. Each block takes the format and the dropdowns of the row below it, then its cells.
 */
function insertedBlocks(read: FreshTabs, tab: WritableTab, sheetId: number, appends: readonly RowAppend[]): SpreadsheetRequest[] {
  const width = lineUpHeader(read, tab).length
  const sorted = [...appends].sort((upper, lower) => upper.at! - lower.at!)
  const blocks: RowAppend[][] = []
  for (const append of sorted) {
    const block = blocks[blocks.length - 1]
    if (block !== undefined && block[block.length - 1]!.at! + 1 === append.at) {
      block.push(append)
    } else {
      blocks.push([append])
    }
  }
  return blocks.flatMap((block): SpreadsheetRequest[] => {
    const start = block[0]!.at! - 1
    const end = start + block.length
    const below = { sheetId, startRowIndex: end, endRowIndex: end + 1, startColumnIndex: 0, endColumnIndex: width }
    const placed = { sheetId, startRowIndex: start, endRowIndex: end, startColumnIndex: 0, endColumnIndex: width }
    return [
      { insertDimension: { range: { sheetId, dimension: 'ROWS', startIndex: start, endIndex: end }, inheritFromBefore: false } },
      { copyPaste: { source: below, destination: placed, pasteType: 'PASTE_FORMAT', pasteOrientation: 'NORMAL' } },
      { copyPaste: { source: below, destination: placed, pasteType: 'PASTE_DATA_VALIDATION', pasteOrientation: 'NORMAL' } },
      { updateCells: { start: { sheetId, rowIndex: start, columnIndex: 0 }, rows: block.map((append) => rowData(read, tab, append)), fields: 'userEnteredValue' } },
    ]
  })
}

function cellData(value: CellValue): CellData {
  if (typeof value === 'number') return { userEnteredValue: { numberValue: value } }
  if (typeof value === 'boolean') return { userEnteredValue: { boolValue: value } }
  return cellText(value) === '' ? {} : { userEnteredValue: { stringValue: value } }
}

/** The tab's header, refused when column A has none, since a new row would then not line up. */
function lineUpHeader(read: FreshTabs, tab: WritableTab): readonly string[] {
  const header = headerOf(read, tab)
  if (header[0] === undefined || header[0].trim() === '') {
    throw new WorkbookWriteRefused(`Column A of the ${tab} tab has no header, so a new row would not line up. Nothing was written.`)
  }
  return header
}

/** A new row's cells under the tab's header from A, every column it fills checked first. */
function rowData(read: FreshTabs, tab: WritableTab, append: RowAppend): RowData {
  for (const column of Object.keys(append.cells)) {
    columnOf(read, tab, column)
  }
  return { values: lineUpHeader(read, tab).map((name) => cellData(append.cells[name.trim()] ?? '')) }
}

function tabReadOf(values: readonly (readonly CellValue[])[]): TabRead {
  return {
    header: (values[0] ?? []).map((cell) => String(cell ?? '').trim()),
    rows: sheetRowsFromValues(values),
    lastRow: values.length,
  }
}

function headerOf(before: FreshTabs, tab: WritableTab): readonly string[] {
  const read = before[tab]
  if (read === undefined) {
    throw new Error(`A write to the ${tab} tab was planned without reading it first.`)
  }
  return read.header
}

/** The 1-based column of a header that appears exactly once, and only for a column the app may write. */
function columnOf(before: FreshTabs, tab: WritableTab, column: string): number {
  if (!WRITABLE_COLUMNS[tab].has(column)) {
    throw new Error(`The app never writes the ${column} column of the ${tab} tab.`)
  }
  const positions = headerOf(before, tab).flatMap((name, index) => (name.trim() === column ? [index + 1] : []))
  if (positions.length !== 1) {
    throw new WorkbookWriteRefused(
      positions.length === 0
        ? `The ${tab} tab has no "${column}" column, so nothing was written.`
        : `The ${tab} tab has ${positions.length} columns headed "${column}", so nothing was written.`,
    )
  }
  return positions[0]!
}
