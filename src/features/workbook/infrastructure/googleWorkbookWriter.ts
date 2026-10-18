import { columnLetter } from '../../../shared/text/columnLetter'
import { WRITABLE_COLUMNS, WorkbookWriteRefused } from '../application/workbookWriter'
import type { FreshTabs, TabRead, WorkbookWriter, WritableTab } from '../application/workbookWriter'
import type { SheetsValues, ValueRange } from './sheetsClient'
import { sheetRowsFromValues } from './workbookSnapshot'
import type { CellValue } from './workbookSnapshot'

/**
 * Writes to the picked Google Sheet through the values API, always RAW. A cell edit names one cell
 * by its header's column and its row, so nothing else on the row is touched. Every request is
 * worked out before the first one is sent, so a refusal never leaves half a write behind.
 */
export function googleWorkbookWriter(sheets: SheetsValues): WorkbookWriter {
  return {
    async read(tabs) {
      const sheetIds = await sheets.sheetIds()
      const missing = tabs.filter((tab) => !sheetIds.has(tab))
      if (missing.length > 0) {
        throw new WorkbookWriteRefused(`The Sheet has no ${missing.join(' or ')} tab, so nothing was written.`)
      }
      const ranges = await sheets.batchGet(tabs)
      return Object.fromEntries(tabs.map((tab, index) => [tab, tabReadOf(ranges[index]?.values ?? [])]))
    },

    async write(edits, before) {
      const data: ValueRange[] = edits.cells.map((edit) => ({
        range: `${edit.tab}!${columnLetter(columnOf(before, edit.tab, edit.column))}${edit.sheetRow}`,
        values: [[edit.value]],
      }))
      const appends = edits.appends.map((append) => {
        const header = headerOf(before, append.tab)
        if (header[0] === undefined || header[0].trim() === '') {
          throw new WorkbookWriteRefused(`Column A of the ${append.tab} tab has no header, so a new row would not line up. Nothing was written.`)
        }
        for (const column of Object.keys(append.cells)) {
          columnOf(before, append.tab, column)
        }
        return {
          range: `${append.tab}!A:${columnLetter(header.length)}`,
          values: [header.map((name): CellValue => append.cells[name.trim()] ?? '')],
        }
      })
      if (data.length > 0) {
        await sheets.batchUpdate({ valueInputOption: 'RAW', data })
      }
      for (const append of appends) {
        await sheets.append(append.range, { valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS', values: append.values })
      }
    },
  }
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
