import type { CellObject } from 'xlsx'

import { readEveryTab, sheetJs } from '../../../shared/xlsx/sheetGrids'
import { installedPack } from '../../packs/packContribution'
import { settingNote } from '../../settings/domain/settings'
import type { Workbook } from '../domain/workbook'
import { settingsTabRows } from './emptyWorkbook'
import { numberFormatOf } from './spreadsheetTab'
import { templateColumnNames, templateColumns } from './workbookTemplate'
import { EMPTY_TABS, WORKBOOK_TABS, sheetRowsFromValues } from './workbookSnapshot'
import type { CellValue, SheetRow, WorkbookTab, WorkbookTabs } from './workbookSnapshot'

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

/** Reads the workbook tabs of an xlsx file, by tab name in any letter case. Other tabs are ignored. */
export async function readWorkbookFile(bytes: ArrayBuffer | Uint8Array): Promise<WorkbookFileContents> {
  const fileTabs = await readEveryTab(bytes)
  const missingTabs: WorkbookTab[] = []
  const tabs: Partial<Record<WorkbookTab, SheetRow[]>> = {}
  for (const tab of WORKBOOK_TABS) {
    const found = fileTabs.find((candidate) => candidate.name.trim().toLowerCase() === tab)
    if (found === undefined) {
      missingTabs.push(tab)
      continue
    }
    tabs[tab] = sheetRowsFromValues(found.grid)
  }
  return { tabs: { ...EMPTY_TABS, ...tabs }, missingTabs }
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
  const packSettings = installedPack().workbook?.settings ?? null
  for (const tab of WORKBOOK_TABS) {
    const grid = grids[tab]
    const sheet = XLSX.utils.aoa_to_sheet([[...grid.header], ...grid.rows.map((cells) => [...cells])])
    const notes = new Map(templateColumns(tab).map((column) => [column.name, column.note]))
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
          const keyNote = settingNote(String(cell.v), packSettings)
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
    employees: gridFor('employees', tabs.employees),
    splits: gridFor('splits', tabs.splits),
    dismissed: gridFor('dismissed', tabs.dismissed),
  }
}

function gridFor(tab: WorkbookTab, rows: readonly SheetRow[]): TabGrid {
  const known = templateColumnNames(tab)
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
