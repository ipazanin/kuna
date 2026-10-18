import type { CellObject, WorkSheet } from 'xlsx'

import { settingNote } from '../../settings/domain/settings'
import type { Workbook } from '../domain/workbook'
import { YEAR_END_STATEMENTS, yearEndLineDefinition } from '../domain/yearEnd'
import type { YearEndFigureKind, YearEndStatement } from '../domain/yearEnd'
import { TEMPLATE_COLUMNS, settingsTabRows } from './workbookTemplate'
import { EMPTY_TABS, WORKBOOK_TABS, sheetRowsFromValues } from './workbookSnapshot'
import type { CellValue, SheetRow, WorkbookTab, WorkbookTabs } from './workbookSnapshot'

export const XLSX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

const NOTE_AUTHOR = 'Ledgerboard'

const DATE_FORMAT = 'yyyy-mm-dd'
const AMOUNT_FORMAT = '#,##0.00'
const RATE_FORMAT = '0.00%'

const COLUMN_FORMATS: Readonly<Partial<Record<WorkbookTab, Readonly<Record<string, string>>>>> = {
  ledger: { date: DATE_FORMAT, amount: AMOUNT_FORMAT, balance: AMOUNT_FORMAT },
  invoices: { amount: AMOUNT_FORMAT, issued: DATE_FORMAT, due: DATE_FORMAT, period_from: DATE_FORMAT, period_to: DATE_FORMAT },
  'owner-advances': { date: DATE_FORMAT, amount: AMOUNT_FORMAT },
  assets: { bought: DATE_FORMAT, in_use: DATE_FORMAT, cost_net: AMOUNT_FORMAT, disposed: DATE_FORMAT },
  grants: {
    received: DATE_FORMAT,
    amount: AMOUNT_FORMAT,
    fixed_part: AMOUNT_FORMAT,
    variable_part: AMOUNT_FORMAT,
    period_from: DATE_FORMAT,
    period_to: DATE_FORMAT,
    clawback_year1: AMOUNT_FORMAT,
    clawback_year2: AMOUNT_FORMAT,
    employment_required_until: DATE_FORMAT,
  },
  plan: { amount: AMOUNT_FORMAT },
  scenarios: { amount: AMOUNT_FORMAT, from: DATE_FORMAT, to: DATE_FORMAT },
}

const FIGURE_FORMATS: Readonly<Record<YearEndFigureKind, string>> = { money: AMOUNT_FORMAT, date: DATE_FORMAT, rate: RATE_FORMAT, count: '0' }

/** The `year-end` amount cell holds a date, a rate or a count on some lines, so its format follows the line. */
function yearEndAmountFormat(grid: TabGrid, row: number): string {
  const cellOf = (column: string): string => String(grid.rows[row - 1]?.[grid.header.indexOf(column)] ?? '').trim().toLowerCase()
  const statement = cellOf('statement')
  const definition = (YEAR_END_STATEMENTS as readonly string[]).includes(statement) ? yearEndLineDefinition(statement as YearEndStatement, cellOf('line')) : null
  return FIGURE_FORMATS[definition?.kind ?? 'money']
}

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
 * the tabs carry, every row at its own row number, a note on each header. The ledger's family,
 * bucket and month are filled in from the workbook, which is what they mean in the Sheet too. A
 * workbook without a settings tab gets one with the settings it was read with.
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
        const format = tab === 'year-end' && name === 'amount' ? yearEndAmountFormat(grid, row) : COLUMN_FORMATS[tab]?.[name]
        if (format !== undefined && cell.t === 'n') cell.z = format
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
  if (['description', 'counterparty', 'item', 'asset', 'note'].includes(name) || (tab === 'ledger' && name === 'statement')) return 32
  return name.endsWith('iban') || name.endsWith('reference') || name.endsWith('_until') ? 26 : 14
}

/** The grid of every tab, without SheetJS, so the layout can be tested on its own. */
export function workbookGrids(tabs: WorkbookTabs, workbook: Workbook): Record<WorkbookTab, TabGrid> {
  const transactionsByRow = new Map(workbook.transactions.map((transaction) => [transaction.sheetRow, transaction]))
  const ledgerRows = tabs.ledger.map((row): SheetRow => {
    const transaction = transactionsByRow.get(row.sheetRow)
    if (transaction === undefined) {
      return row
    }
    return { ...row, cells: { ...row.cells, family: transaction.family, bucket: transaction.bucket, month: transaction.date.slice(0, 7) } }
  })
  return {
    ledger: gridFor('ledger', ledgerRows),
    categories: gridFor('categories', tabs.categories),
    accounts: gridFor('accounts', tabs.accounts),
    settings: gridFor('settings', tabs.settings.length === 0 ? settingsTabRows(workbook.settings) : tabs.settings),
    rules: gridFor('rules', tabs.rules),
    invoices: gridFor('invoices', tabs.invoices),
    clients: gridFor('clients', tabs.clients),
    'owner-advances': gridFor('owner-advances', tabs['owner-advances']),
    assets: gridFor('assets', tabs.assets),
    grants: gridFor('grants', tabs.grants),
    'year-end': gridFor('year-end', tabs['year-end']),
    plan: gridFor('plan', tabs.plan),
    scenarios: gridFor('scenarios', tabs.scenarios),
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
