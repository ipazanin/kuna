import type { CellObject, WorkSheet } from 'xlsx'

import { settingNote } from '../../settings/domain/settings'
import type { Workbook } from '../domain/workbook'
import { numberFormatOf } from './cellFormats'
import { TEMPLATE_COLUMNS, settingsTabRows } from './workbookTemplate'
import { EMPTY_TABS, WORKBOOK_TABS, sheetRowsFromValues } from './workbookSnapshot'
import type { CellValue, SheetRow, WorkbookTab, WorkbookTabs } from './workbookSnapshot'

export const XLSX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

const NOTE_AUTHOR = 'Ledgerboard'

/** A tab as rows of cells, header first, each data row at its own row number. */
export interface TabGrid {
  readonly header: readonly string[]
  readonly rows: readonly (readonly (CellValue | undefined)[])[]
}

export interface WorkbookFileContents {
  readonly tabs: WorkbookTabs
  /** Tabs the file does not have. A file without `ledger` is not a workbook. */
  readonly missingTabs: readonly WorkbookTab[]
}

/**
 * SheetJS is loaded on the first import or export, never with the app, because it is larger than
 * everything else on the first screen together.
 */
async function sheetJs(): Promise<typeof import('xlsx')> {
  return import('xlsx')
}

/** Reads the workbook tabs of an xlsx file, by tab name in any letter case. Other tabs are ignored. */
export async function readWorkbookFile(bytes: ArrayBuffer | Uint8Array): Promise<WorkbookFileContents> {
  const XLSX = await sheetJs()
  const book = XLSX.read(bytes, { type: 'array', cellText: false })
  const missingTabs: WorkbookTab[] = []
  const tabs: Partial<Record<WorkbookTab, SheetRow[]>> = {}
  for (const tab of WORKBOOK_TABS) {
    const name = book.SheetNames.find((candidate) => candidate.trim().toLowerCase() === tab)
    const sheet = name === undefined ? undefined : book.Sheets[name]
    if (sheet === undefined) {
      missingTabs.push(tab)
      continue
    }
    tabs[tab] = sheetRowsFromValues(gridOf(XLSX, sheet))
  }
  return { tabs: { ...EMPTY_TABS, ...tabs }, missingTabs }
}

/**
 * The first sheet of a file SheetJS reads, xlsx, xls or ods as bytes, or a csv's text, whose cells
 * stay as written so `1.234,56` is not read as a number. The cells start from A1.
 */
export async function readFirstSheet(contents: ArrayBuffer | string): Promise<(CellValue | undefined)[][]> {
  const XLSX = await sheetJs()
  const book = typeof contents === 'string' ? XLSX.read(contents, { type: 'string', raw: true }) : XLSX.read(contents, { type: 'array', cellText: false })
  const sheet = book.Sheets[book.SheetNames[0] ?? '']
  return sheet === undefined ? [] : gridOf(XLSX, sheet)
}

/** The cells from A1, so row numbers match the sheet's even when its used range starts lower. */
function gridOf(XLSX: typeof import('xlsx'), sheet: WorkSheet): (CellValue | undefined)[][] {
  const reference = sheet['!ref']
  if (reference === undefined) {
    return []
  }
  const range = XLSX.utils.decode_range(reference)
  range.s.r = 0
  range.s.c = 0
  return XLSX.utils.sheet_to_json<(CellValue | undefined)[]>(sheet, { header: 1, raw: true, blankrows: true, range })
}

/**
 * Writes the tabs in the template format: known columns in template order, then any other columns
 * the tabs carry, every row at its own row number, a note on each header. A workbook without a
 * settings tab gets one with the settings it was read with.
 */
export async function writeWorkbookFile(tabs: WorkbookTabs, workbook: Workbook): Promise<Uint8Array<ArrayBuffer>> {
  const XLSX = await sheetJs()
  const book = XLSX.utils.book_new()
  const grids = workbookGrids(tabs, workbook)
  for (const tab of WORKBOOK_TABS) {
    const grid = grids[tab]
    const sheet = XLSX.utils.aoa_to_sheet([[...grid.header], ...grid.rows.map((cells) => [...cells])])
    const notes = new Map(TEMPLATE_COLUMNS[tab].map((column) => [column.name, column.note]))
    grid.header.forEach((name, column) => {
      const note = notes.get(name)
      if (note !== undefined) {
        attachNote(sheet[XLSX.utils.encode_cell({ r: 0, c: column })], note)
      }
      for (let row = 1; row <= grid.rows.length; row += 1) {
        const cell: CellObject | undefined = sheet[XLSX.utils.encode_cell({ r: row, c: column })]
        if (cell === undefined) continue
        const format = numberFormatOf(tab, name, (column) => grid.rows[row - 1]?.[grid.header.indexOf(column)])
        if (format !== null && cell.t === 'n') cell.z = format
        if (tab === 'settings' && name === 'key') {
          const keyNote = settingNote(String(cell.v))
          if (keyNote !== null) attachNote(cell, keyNote)
        }
      }
    })
    sheet['!cols'] = grid.header.map((name) => ({ wch: columnWidth(tab, name) }))
    XLSX.utils.book_append_sheet(book, sheet, tab)
  }
  const written: ArrayBuffer = XLSX.write(book, { type: 'array', bookType: 'xlsx', compression: true })
  return new Uint8Array(written)
}

function attachNote(cell: CellObject | undefined, text: string): void {
  if (cell === undefined) return
  const note = Object.assign([{ a: NOTE_AUTHOR, t: text }], { hidden: true })
  cell.c = note
}

function columnWidth(tab: WorkbookTab, name: string): number {
  if (tab === 'settings') return name === 'key' ? 22 : 28
  if (tab === 'rules') return name === 'note' ? 60 : name === 'rule' ? 28 : 14
  if (['description', 'counterparty', 'item', 'asset', 'note'].includes(name) || (tab === 'ledger' && name === 'statement') || (tab === 'dismissed' && name === 'key')) return 32
  return name.endsWith('iban') || name.endsWith('reference') || name.endsWith('_until') ? 26 : 14
}

/** The grid of every tab, without SheetJS, so the layout can be tested on its own. */
export function workbookGrids(tabs: WorkbookTabs, workbook: Workbook): Record<WorkbookTab, TabGrid> {
  return {
    ledger: gridFor('ledger', tabs.ledger),
    categories: gridFor('categories', tabs.categories),
    accounts: gridFor('accounts', tabs.accounts),
    settings: gridFor('settings', tabs.settings.length === 0 ? settingsTabRows(workbook.settings) : tabs.settings),
    rules: gridFor('rules', tabs.rules),
    invoices: gridFor('invoices', tabs.invoices),
    clients: gridFor('clients', tabs.clients),
    'outgoing-plan': gridFor('outgoing-plan', tabs['outgoing-plan']),
    'owner-advances': gridFor('owner-advances', tabs['owner-advances']),
    assets: gridFor('assets', tabs.assets),
    grants: gridFor('grants', tabs.grants),
    'year-end': gridFor('year-end', tabs['year-end']),
    plan: gridFor('plan', tabs.plan),
    scenarios: gridFor('scenarios', tabs.scenarios),
    splits: gridFor('splits', tabs.splits),
    dismissed: gridFor('dismissed', tabs.dismissed),
  }
}

function gridFor(tab: WorkbookTab, rows: readonly SheetRow[]): TabGrid {
  const known = TEMPLATE_COLUMNS[tab].map((column) => column.name)
  const ordered = [...rows].sort((upper, lower) => upper.sheetRow - lower.sheetRow)
  const extra = [...new Set(ordered.flatMap((row) => Object.keys(row.cells)))].filter((name) => !known.includes(name))
  const header = [...known, ...extra]
  const grid: (CellValue | undefined)[][] = []
  for (const row of ordered) {
    while (grid.length < row.sheetRow - 2) {
      grid.push([])
    }
    grid.push(header.map((name) => row.cells[name]))
  }
  return { header, rows: grid }
}
