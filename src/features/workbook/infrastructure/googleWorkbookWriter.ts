import { columnLetter } from '../../../shared/text/columnLetter'
import { WRITABLE_COLUMNS, WorkbookWriteRefused } from '../application/workbookWriter'
import type { FreshTabs, TabRead, WorkbookWriter, WritableTab } from '../application/workbookWriter'
import { sheetNameInRange } from './sheetsClient'
import type { SheetsValues, ValueRange } from './sheetsClient'
import { sheetRowsFromValues } from './workbookSnapshot'
import type { CellValue } from './workbookSnapshot'

/**
 * Writes to the picked Google Sheet through the values API, always RAW. A cell edit names one cell
 * by its header's column and its row, so nothing else on the row is touched. Every request is
 * worked out before the first one is sent, so a refusal never leaves half a write behind. The rows
 * appended to one tab go in one request, so several new rows land together or not at all.
 */
export function googleWorkbookWriter(sheets: SheetsValues): WorkbookWriter {
  return {
    async read(tabs) {
      // A batchGet fails whole on a tab that does not exist, so it asks only for the tabs the Sheet has.
      const sheetIds = await sheets.sheetIds()
      const present = tabs.filter((tab) => sheetIds.has(tab))
      const ranges = await sheets.batchGet(present.map(sheetNameInRange))
      return Object.fromEntries(present.map((tab, index) => [tab, tabReadOf(ranges[index]?.values ?? [])]))
    },

    async write(edits, before) {
      const data: ValueRange[] = edits.cells.map((edit) => ({
        range: `${sheetNameInRange(edit.tab)}!${columnLetter(columnOf(before, edit.tab, edit.column))}${edit.sheetRow}`,
        values: [[edit.value]],
      }))
      const appendedTabs = [...new Set(edits.appends.map((append) => append.tab))]
      const appends = appendedTabs.map((tab) => {
        const header = headerOf(before, tab)
        if (header[0] === undefined || header[0].trim() === '') {
          throw new WorkbookWriteRefused(`Column A of the ${tab} tab has no header, so a new row would not line up. Nothing was written.`)
        }
        const rows = edits.appends.filter((append) => append.tab === tab)
        for (const column of rows.flatMap((append) => Object.keys(append.cells))) {
          columnOf(before, tab, column)
        }
        return {
          range: `${sheetNameInRange(tab)}!A:${columnLetter(header.length)}`,
          values: rows.map((append) => header.map((name): CellValue => append.cells[name.trim()] ?? '')),
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
