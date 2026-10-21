import { columnLetter } from '../../../shared/text/columnLetter'
import { WRITABLE_COLUMNS, WorkbookWriteRefused, editableColumns, insertedRowNumbers } from '../application/workbookWriter'
import type { FreshTabs, RowAppend, TabRead, WorkbookWriter, WritableTab } from '../application/workbookWriter'
import { sheetNameInRange } from './sheetsClient'
import type { SheetsValues, SpreadsheetRequest, ValueRange } from './sheetsClient'
import { sheetRowsFromValues } from './workbookSnapshot'
import type { CellValue } from './workbookSnapshot'

/**
 * Writes to the picked Google Sheet through the values API, always RAW. A cell edit names one cell
 * by its header's column and its row, so nothing else on the row is touched. Every request is
 * worked out before the first one is sent, so a refusal never leaves half a write behind. The rows
 * appended to one tab go in one request, so several new rows land together or not at all. A new tab
 * is added and given its header before anything else is written.
 *
 * Rows put in above a row of the read, as the ledger takes a statement, are made in one structural
 * request with the format and the dropdowns of the row below copied onto them, the way the
 * shadow-accounting Apps Script inserts a batch, and then filled. Rows taken out go in one request
 * too, from the bottom up.
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
      const newTabs = edits.newTabs ?? []
      for (const { tab } of newTabs) {
        if (before[tab] !== undefined) {
          throw new Error(`The ${tab} tab is already in the Sheet, so it is not added again.`)
        }
      }
      // A tab added here reads as its template header, so the edits below place their cells the same way.
      const read: FreshTabs = { ...before, ...Object.fromEntries(newTabs.map(({ tab, header }) => [tab, { header, rows: [], lastRow: 1 }])) }
      const headerCells: ValueRange[] = newTabs.flatMap(({ tab, header }) =>
        header.map((name) => ({ range: `${sheetNameInRange(tab)}!${columnLetter(columnOf(read, tab, name))}1`, values: [[name]] })),
      )
      const data: ValueRange[] = [
        ...headerCells,
        ...edits.cells.map((edit) => {
          if (!editableColumns(edit.tab).has(edit.column)) {
            throw new Error(`The app never changes the ${edit.column} column of a row already on the ${edit.tab} tab.`)
          }
          return { range: `${sheetNameInRange(edit.tab)}!${columnLetter(columnOf(read, edit.tab, edit.column))}${edit.sheetRow}`, values: [[edit.value]] }
        }),
      ]
      const footAppends = edits.appends.filter((append) => append.before === undefined)
      const appendedTabs = [...new Set(footAppends.map((append) => append.tab))]
      const appends = appendedTabs.map((tab) => ({
        range: `${sheetNameInRange(tab)}!A:${columnLetter(lineUpHeader(read, tab).length)}`,
        values: footAppends.filter((append) => append.tab === tab).map((append) => rowValues(read, tab, append)),
      }))
      const reshaped = reshapingOf(read, edits.appends, edits.deletions ?? [], edits.cells.map((edit) => edit.tab), () => {
        if (sheetIds === null) {
          throw new Error('Rows were to be put in or taken out before the Sheet was read.')
        }
        return sheetIds
      })
      if (newTabs.length > 0) {
        await sheets.updateSpreadsheet(newTabs.map(({ tab }) => ({ addSheet: { properties: { title: tab } } })))
      }
      if (data.length > 0) {
        await sheets.batchUpdate({ valueInputOption: 'RAW', data })
      }
      if (reshaped.requests.length > 0) {
        await sheets.updateSpreadsheet(reshaped.requests)
      }
      if (reshaped.cells.length > 0) {
        await sheets.batchUpdate({ valueInputOption: 'RAW', data: reshaped.cells })
      }
      for (const append of appends) {
        await sheets.append(append.range, { valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS', values: append.values })
      }
    },
  }
}

/**
 * The structural requests for rows put in and taken out, and the cells of the rows put in at the
 * rows they land on. Requests run from the bottom up, so each index still means the row it was read as.
 */
function reshapingOf(
  read: FreshTabs,
  appends: readonly RowAppend[],
  deletions: readonly { readonly tab: WritableTab; readonly sheetRow: number }[],
  editedTabs: readonly WritableTab[],
  ids: () => ReadonlyMap<string, number>,
): { readonly requests: SpreadsheetRequest[]; readonly cells: ValueRange[] } {
  const requests: SpreadsheetRequest[] = []
  const cells: ValueRange[] = []
  const inserted = appends.filter((append) => append.before !== undefined)
  for (const tab of [...new Set([...inserted, ...deletions].map((change) => change.tab))]) {
    const tabInserts = inserted.filter((append) => append.tab === tab)
    const tabDeletions = deletions.filter((deletion) => deletion.tab === tab)
    if ((tabInserts.length > 0 && tabDeletions.length > 0) || editedTabs.includes(tab)) {
      throw new Error(`One write may not move rows of the ${tab} tab and also change it otherwise.`)
    }
    const sheetId = ids().get(tab)
    if (sheetId === undefined) {
      throw new WorkbookWriteRefused(`The Sheet has no ${tab} tab, so nothing was written.`)
    }
    const width = lineUpHeader(read, tab).length
    const befores = tabInserts.map((append) => append.before!)
    for (const before of [...new Set(befores)].sort((upper, lower) => lower - upper)) {
      const count = befores.filter((other) => other === before).length
      const start = before - 1
      const below = { sheetId, startRowIndex: start + count, endRowIndex: start + count + 1, startColumnIndex: 0, endColumnIndex: width }
      const placed = { sheetId, startRowIndex: start, endRowIndex: start + count, startColumnIndex: 0, endColumnIndex: width }
      requests.push(
        { insertDimension: { range: { sheetId, dimension: 'ROWS', startIndex: start, endIndex: start + count }, inheritFromBefore: false } },
        { copyPaste: { source: below, destination: placed, pasteType: 'PASTE_FORMAT', pasteOrientation: 'NORMAL' } },
        { copyPaste: { source: below, destination: placed, pasteType: 'PASTE_DATA_VALIDATION', pasteOrientation: 'NORMAL' } },
      )
    }
    const landed = insertedRowNumbers(befores)
    tabInserts.forEach((append, index) => {
      cells.push({ range: `${sheetNameInRange(tab)}!A${landed[index]}:${columnLetter(width)}${landed[index]}`, values: [rowValues(read, tab, append)] })
    })
    for (const sheetRow of [...new Set(tabDeletions.map((deletion) => deletion.sheetRow))].sort((upper, lower) => lower - upper)) {
      requests.push({ deleteDimension: { range: { sheetId, dimension: 'ROWS', startIndex: sheetRow - 1, endIndex: sheetRow } } })
    }
  }
  return { requests, cells }
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
function rowValues(read: FreshTabs, tab: WritableTab, append: RowAppend): CellValue[] {
  for (const column of Object.keys(append.cells)) {
    columnOf(read, tab, column)
  }
  return lineUpHeader(read, tab).map((name): CellValue => append.cells[name.trim()] ?? '')
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
