import { cellText } from '../../../shared/text/cellText'
import { WRITABLE_COLUMNS } from '../application/workbookWriter'
import type { TabRead, WorkbookWriter } from '../application/workbookWriter'
import { TEMPLATE_COLUMNS } from './workbookTemplate'
import type { SheetRow, WorkbookTabs } from './workbookSnapshot'

/**
 * Writes to a working copy of the workbook kept in this browser. Its rows carry no header row, so
 * a tab's header is the template's columns and then any other column its rows use, which is what
 * an export writes. The store saves the copy once the write reads back.
 */
export function localWorkbookWriter(tabs: WorkbookTabs): WorkbookWriter {
  const working: { -readonly [Tab in keyof WorkbookTabs]: SheetRow[] } = {
    ledger: [...tabs.ledger],
    categories: [...tabs.categories],
    accounts: [...tabs.accounts],
    settings: [...tabs.settings],
    rules: [...tabs.rules],
  }

  return {
    async read(requested) {
      return Object.fromEntries(requested.map((tab) => [tab, tabReadOf(tab, working[tab])]))
    },

    async write(edits) {
      for (const edit of [...edits.cells, ...edits.appends]) {
        for (const column of 'column' in edit ? [edit.column] : Object.keys(edit.cells)) {
          if (!WRITABLE_COLUMNS[edit.tab].has(column)) {
            throw new Error(`The app never writes the ${column} column of the ${edit.tab} tab.`)
          }
        }
      }
      for (const edit of edits.cells) {
        working[edit.tab] = working[edit.tab].map((row) => {
          if (row.sheetRow !== edit.sheetRow) {
            return row
          }
          const { [edit.column]: _replaced, ...others } = row.cells
          return { sheetRow: row.sheetRow, cells: cellText(edit.value) === '' ? others : { ...others, [edit.column]: edit.value } }
        })
      }
      for (const append of edits.appends) {
        const cells = Object.fromEntries(Object.entries(append.cells).filter(([, cell]) => cellText(cell) !== ''))
        working[append.tab] = [...working[append.tab], { sheetRow: lastRowOf(working[append.tab]) + 1, cells }]
      }
    },
  }
}

function tabReadOf(tab: keyof WorkbookTabs, rows: readonly SheetRow[]): TabRead {
  const template = TEMPLATE_COLUMNS[tab].map((column) => column.name)
  const others = [...new Set(rows.flatMap((row) => Object.keys(row.cells)))].filter((column) => !template.includes(column))
  return { header: [...template, ...others], rows, lastRow: lastRowOf(rows) }
}

function lastRowOf(rows: readonly SheetRow[]): number {
  return rows.reduce((last, row) => Math.max(last, row.sheetRow), 1)
}
