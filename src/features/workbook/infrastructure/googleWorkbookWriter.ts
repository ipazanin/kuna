import { cellText } from '../../../shared/text/cellText'
import { WorkbookWriteRefused } from '../application/workbookWriteRefused'
import { DATE_FORMAT, isDateCell } from './cellFormats'
import { sheetNameInRange } from './sheetsClient'
import type { CellData, NumberFormat, RowData, SheetGrid, SheetsValues, SpreadsheetRequest } from './sheetsClient'
import { sheetRowsFromValues } from './workbookSnapshot'
import type { CellValue } from './workbookSnapshot'
import { editableColumns, writableColumns } from './workbookWriter'
import type { CellEdit, FreshTabs, RowAppend, TabRead, WorkbookWriter, WritableTab } from './workbookWriter'

/**
 * Writes to the picked Google Sheet in one `spreadsheets.batchUpdate`, which Sheets applies whole or
 * not at all, so a failed write never leaves half of itself behind. Every request is worked out
 * before it is sent. A cell edit names one cell by its header's column and its row, so nothing else
 * on the row is touched.
 *
 * The requests run in the order `TabEdits` gives: a new tab with its header, each new column's
 * header after the last column in use, with columns added to the grid first when it has none free, the
 * cell edits, the rows taken out from the bottom up, the rows put in from the top down, each block
 * with the format and the dropdowns of the row below copied onto it the way the shadow-accounting
 * Apps Script inserts a batch, and last the rows added below the last one. Every date the write
 * puts in a cell gets the date format in the same batch, since a tab without one would show its
 * serial number.
 */
export function googleWorkbookWriter(sheets: SheetsValues): WorkbookWriter {
  let grids: ReadonlyMap<string, SheetGrid> | null = null
  /** Each tab's columns in use as last read, up to the last cell of its widest row, header or not. */
  let widths: ReadonlyMap<string, number> = new Map()
  return {
    async read(tabs) {
      // A batchGet fails whole on a tab that does not exist, so it asks only for the tabs the Sheet has.
      grids = await sheets.sheetGrids()
      const present = tabs.filter((tab) => grids!.has(tab))
      const ranges = await sheets.batchGet(present.map(sheetNameInRange))
      const values = present.map((_, index) => ranges[index]?.values ?? [])
      widths = new Map(present.map((tab, index) => [tab, values[index]!.reduce((widest, row) => Math.max(widest, row.length), 0)]))
      return Object.fromEntries(present.map((tab, index) => [tab, tabReadOf(values[index]!)]))
    },

    async write(edits, before) {
      if (grids === null) {
        throw new Error('A write was planned before the Sheet was read.')
      }
      const ids = new Map([...grids].map(([tab, grid]) => [tab, grid.sheetId]))
      const newTabs = edits.newTabs ?? []
      for (const { tab } of newTabs) {
        if (before[tab] !== undefined || ids.has(tab)) {
          throw new Error(`The ${tab} tab is already in the Sheet, so it is not added again.`)
        }
        ids.set(tab, unusedSheetId(ids))
      }
      const requested = edits.newColumns ?? []
      const newColumns = requested.map((added, order) => {
        const header = headerOf(before, added.tab)
        if (header.some((name) => name.trim() === added.column) || requested.findIndex((other) => other.tab === added.tab && other.column === added.column) !== order) {
          throw new Error(`The ${added.tab} tab already has a ${added.column} column, so it is not added again.`)
        }
        const earlier = requested.slice(0, order).filter((other) => other.tab === added.tab).length
        return { ...added, index: Math.max(header.length, widths.get(added.tab) ?? 0) + earlier }
      })
      // A tab or a column added here reads as part of the header, so the edits below place their cells the same way.
      const read: FreshTabs = {
        ...before,
        ...Object.fromEntries(newTabs.map(({ tab, header }) => [tab, { header, rows: [], lastRow: 1 }])),
        ...Object.fromEntries(
          [...new Set(newColumns.map((added) => added.tab))].map((tab) => {
            const header = [...headerOf(before, tab)]
            for (const added of newColumns.filter((other) => other.tab === tab)) {
              header.push(...Array<string>(added.index - header.length).fill(''), added.column)
            }
            return [tab, { ...before[tab]!, header }]
          }),
        ),
      }
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
      /** Each grid's width as the columns added so far leave it. */
      const gridWidths = new Map<string, number>()
      const requests: SpreadsheetRequest[] = [
        ...newTabs.flatMap(({ tab, header }): SpreadsheetRequest[] => [
          { addSheet: { properties: { sheetId: sheetIdOf(tab), title: tab } } },
          { updateCells: { start: { sheetId: sheetIdOf(tab), rowIndex: 0, columnIndex: 0 }, rows: [{ values: header.map(cellData) }], fields: 'userEnteredValue' } },
        ]),
        ...newColumns.flatMap(({ tab, column, index }): SpreadsheetRequest[] => {
          const sheetId = sheetIdOf(tab)
          const width = gridWidths.get(tab) ?? grids!.get(tab)!.columnCount
          const lacking = index + 1 - width
          gridWidths.set(tab, Math.max(width, index + 1))
          return [
            ...(lacking > 0 ? [{ appendDimension: { sheetId, dimension: 'COLUMNS', length: lacking } } as const] : []),
            { updateCells: { start: { sheetId, rowIndex: 0, columnIndex: index }, rows: [{ values: [cellData(column)] }], fields: 'userEnteredValue' } },
          ]
        }),
        ...edits.cells.flatMap((edit): SpreadsheetRequest[] => {
          if (!editableColumns(edit.tab).has(edit.column)) {
            throw new Error(`The app never changes the ${edit.column} column of a row already on the ${edit.tab} tab.`)
          }
          const start = { sheetId: sheetIdOf(edit.tab), rowIndex: edit.sheetRow - 1, columnIndex: columnOf(read, edit.tab, edit.column) - 1 }
          const value: SpreadsheetRequest = { updateCells: { start, rows: [{ values: [cellData(edit.value)] }], fields: 'userEnteredValue' } }
          const cells = rowAfterEdits(read, edits.cells, edit)
          return isDateCell(edit.tab, edit.column, (column) => cells[column]) ? [value, formatRequest(start.sheetId, start.rowIndex, start.columnIndex, 1, DATE_CELL)] : [value]
        }),
        ...[...deletions]
          .sort((upper, lower) => lower.sheetRow - upper.sheetRow)
          .map((deletion): SpreadsheetRequest => ({
            deleteDimension: { range: { sheetId: sheetIdOf(deletion.tab), dimension: 'ROWS', startIndex: deletion.sheetRow - 1, endIndex: deletion.sheetRow } },
          })),
        ...[...new Set(placed.map((append) => append.tab))].flatMap((tab) => insertedBlocks(read, tab, sheetIdOf(tab), placed.filter((append) => append.tab === tab))),
        ...[...new Set(atFoot.map((append) => append.tab))].flatMap((tab): SpreadsheetRequest[] => {
          const rows = atFoot.filter((append) => append.tab === tab)
          // appendCells starts right under the last row with anything in it, which is the read's last row once this write's own rows moved it.
          const firstRow = read[tab]!.lastRow - deletions.filter((deletion) => deletion.tab === tab).length + placed.filter((append) => append.tab === tab).length
          return [
            { appendCells: { sheetId: sheetIdOf(tab), rows: rows.map((append) => rowData(read, tab, append)), fields: 'userEnteredValue' } },
            ...numberFormatRequests(read, tab, sheetIdOf(tab), firstRow, rows, false),
          ]
        }),
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
      ...numberFormatRequests(read, tab, sheetId, start, block, true),
    ]
  })
}

const DATE_CELL: NumberFormat = { type: 'DATE', pattern: DATE_FORMAT }
const TEXT_CELL: NumberFormat = { type: 'TEXT', pattern: '@' }

/**
 * The number formats of new rows that start on the 0-based `firstRow`: each date gets the date
 * format. Rows put in between others take the format of the row below, whose cells may carry a
 * number format such as the euro on a text column, so with `textToo` their text cells get the
 * text format as well.
 */
function numberFormatRequests(read: FreshTabs, tab: WritableTab, sheetId: number, firstRow: number, rows: readonly RowAppend[], textToo: boolean): SpreadsheetRequest[] {
  const header = lineUpHeader(read, tab)
  const wanted = rows.flatMap((append, offset) =>
    header.flatMap((name, columnIndex) => {
      const column = name.trim()
      const cell = append.cells[column]
      if (isDateCell(tab, column, (other) => append.cells[other])) return [{ rowIndex: firstRow + offset, columnIndex, format: DATE_CELL }]
      if (textToo && typeof cell === 'string' && cellText(cell) !== '') return [{ rowIndex: firstRow + offset, columnIndex, format: TEXT_CELL }]
      return []
    }),
  )
  // One request per run of rows, one under another, that take the same format in a column.
  const requests: SpreadsheetRequest[] = []
  let run: { rowIndex: number; columnIndex: number; format: NumberFormat; rowCount: number } | null = null
  for (const cell of [...wanted].sort((left, right) => left.columnIndex - right.columnIndex || left.rowIndex - right.rowIndex)) {
    if (run !== null && run.columnIndex === cell.columnIndex && run.format === cell.format && run.rowIndex + run.rowCount === cell.rowIndex) {
      run.rowCount += 1
      continue
    }
    if (run !== null) requests.push(formatRequest(sheetId, run.rowIndex, run.columnIndex, run.rowCount, run.format))
    run = { ...cell, rowCount: 1 }
  }
  if (run !== null) requests.push(formatRequest(sheetId, run.rowIndex, run.columnIndex, run.rowCount, run.format))
  return requests
}

function formatRequest(sheetId: number, rowIndex: number, columnIndex: number, rowCount: number, format: NumberFormat): SpreadsheetRequest {
  return {
    repeatCell: {
      range: { sheetId, startRowIndex: rowIndex, endRowIndex: rowIndex + rowCount, startColumnIndex: columnIndex, endColumnIndex: columnIndex + 1 },
      cell: { userEnteredFormat: { numberFormat: format } },
      fields: 'userEnteredFormat.numberFormat',
    },
  }
}

/** The cells of an edited row as the write leaves them: the row as read, with every edit of the write on it. */
function rowAfterEdits(read: FreshTabs, edits: readonly CellEdit[], edit: CellEdit): Readonly<Record<string, CellValue>> {
  const row = read[edit.tab]?.rows.find((candidate) => candidate.sheetRow === edit.sheetRow)
  const onRow = edits.filter((other) => other.tab === edit.tab && other.sheetRow === edit.sheetRow)
  return { ...row?.cells, ...Object.fromEntries(onRow.map((other) => [other.column, other.value])) }
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
  if (!writableColumns(tab).has(column)) {
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
