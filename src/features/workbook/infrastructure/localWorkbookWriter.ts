import { cellText } from '../../../shared/text/cellText'
import { WRITABLE_COLUMNS, editableColumns, insertedRowNumbers, shiftedRowNumber } from '../application/workbookWriter'
import type { TabRead, WorkbookWriter } from '../application/workbookWriter'
import { TEMPLATE_COLUMNS } from './workbookTemplate'
import { WORKBOOK_TABS } from './workbookSnapshot'
import type { SheetRow, WorkbookTab, WorkbookTabs } from './workbookSnapshot'

/**
 * Writes to a working copy of the workbook kept in this browser. Its rows carry no header row, so
 * a tab's header is the template's columns and then any other column its rows use, which is what
 * an export writes. The store saves the copy once the write reads back. Rows put in above a row
 * move the rows below them down, and rows taken out move them up, as in a Sheet.
 */
export function localWorkbookWriter(tabs: WorkbookTabs): WorkbookWriter {
  const working = Object.fromEntries(WORKBOOK_TABS.map((tab) => [tab, [...tabs[tab]]])) as { -readonly [Tab in WorkbookTab]: SheetRow[] }

  return {
    async read(requested) {
      return Object.fromEntries(requested.map((tab) => [tab, tabReadOf(tab, working[tab])]))
    },

    async write(edits) {
      for (const edit of edits.cells) {
        if (!editableColumns(edit.tab).has(edit.column)) {
          throw new Error(`The app never changes the ${edit.column} column of a row already on the ${edit.tab} tab.`)
        }
      }
      for (const append of edits.appends) {
        for (const column of Object.keys(append.cells)) {
          if (!WRITABLE_COLUMNS[append.tab].has(column)) {
            throw new Error(`The app never writes the ${column} column of the ${append.tab} tab.`)
          }
        }
      }
      const deletions = edits.deletions ?? []
      const inserted = edits.appends.filter((append) => append.before !== undefined)
      for (const tab of new Set([...deletions, ...inserted].map((change) => change.tab))) {
        if (edits.cells.some((edit) => edit.tab === tab) || (deletions.some((deletion) => deletion.tab === tab) && inserted.some((append) => append.tab === tab))) {
          throw new Error(`One write may not move rows of the ${tab} tab and also change it otherwise.`)
        }
      }
      for (const edit of edits.cells) {
        working[edit.tab] = working[edit.tab].flatMap((row) => {
          if (row.sheetRow !== edit.sheetRow) {
            return [row]
          }
          const { [edit.column]: _replaced, ...others } = row.cells
          const cells = cellText(edit.value) === '' ? others : { ...others, [edit.column]: edit.value }
          // A Sheet read skips a row with nothing in it, and so does the copy kept here.
          return Object.keys(cells).length === 0 ? [] : [{ sheetRow: row.sheetRow, cells }]
        })
      }
      for (const tab of new Set(deletions.map((deletion) => deletion.tab))) {
        const taken = deletions.filter((deletion) => deletion.tab === tab).map((deletion) => deletion.sheetRow)
        working[tab] = working[tab]
          .filter((row) => !taken.includes(row.sheetRow))
          .map((row) => ({ sheetRow: row.sheetRow - taken.filter((sheetRow) => sheetRow < row.sheetRow).length, cells: row.cells }))
      }
      for (const tab of new Set(inserted.map((append) => append.tab))) {
        const tabInserts = inserted.filter((append) => append.tab === tab)
        const befores = tabInserts.map((append) => append.before!)
        const landed = insertedRowNumbers(befores)
        working[tab] = [
          ...working[tab].map((row) => ({ sheetRow: shiftedRowNumber(row.sheetRow, befores), cells: row.cells })),
          ...tabInserts.map((append, index) => ({ sheetRow: landed[index]!, cells: filled(append.cells) })),
        ].sort((upper, lower) => upper.sheetRow - lower.sheetRow)
      }
      for (const append of edits.appends.filter((candidate) => candidate.before === undefined)) {
        working[append.tab] = [...working[append.tab], { sheetRow: lastRowOf(working[append.tab]) + 1, cells: filled(append.cells) }]
      }
    },
  }
}

function filled(cells: SheetRow['cells']): SheetRow['cells'] {
  return Object.fromEntries(Object.entries(cells).filter(([, cell]) => cellText(cell) !== ''))
}

function tabReadOf(tab: keyof WorkbookTabs, rows: readonly SheetRow[]): TabRead {
  const template = TEMPLATE_COLUMNS[tab].map((column) => column.name)
  const others = [...new Set(rows.flatMap((row) => Object.keys(row.cells)))].filter((column) => !template.includes(column))
  return { header: [...template, ...others], rows, lastRow: lastRowOf(rows) }
}

function lastRowOf(rows: readonly SheetRow[]): number {
  return rows.reduce((last, row) => Math.max(last, row.sheetRow), 1)
}
