import { expect } from 'vitest'

import { columnLetter } from '../../src/shared/text/columnLetter'
import { RULE_COLUMNS } from '../../src/features/rules/domain/rule'
import { createWorkbookStore } from '../../src/features/workbook/application/createWorkbookStore'
import type { WorkbookStore } from '../../src/features/workbook/application/createWorkbookStore'
import type { WorkbookChoice } from '../../src/features/workbook/application/workbookPorts'
import { spreadsheetStorePorts } from '../../src/features/workbook/application/workbookStore'
import type { SpreadsheetStorePorts } from '../../src/features/workbook/application/workbookStore'
import { createFakeSheets } from '../../src/features/workbook/infrastructure/fake/fakeSheets'
import type { FakeSheets } from '../../src/features/workbook/infrastructure/fake/fakeSheets'
import { readSnapshotFrom } from '../../src/features/workbook/infrastructure/googleWorkbookPorts'
import { sheetNameInRange } from '../../src/features/workbook/infrastructure/sheetsClient'
import type { CellData, SpreadsheetRequest } from '../../src/features/workbook/infrastructure/sheetsClient'
import { googleWorkbookWriter } from '../../src/features/workbook/infrastructure/googleWorkbookWriter'
import { openWorkbookCache } from '../../src/features/workbook/infrastructure/workbookCache'
import type { CellValue, WorkbookSnapshot } from '../../src/features/workbook/infrastructure/workbookSnapshot'
import { EMPTY_TABS, sheetRowsFromValues } from '../../src/features/workbook/infrastructure/workbookSnapshot'

export const LEDGER_HEADER = [
  'date',
  'account',
  'statement',
  'counterparty',
  'counterparty_iban',
  'description',
  'amount',
  'balance',
  'category',
  'flagged_by',
  'reference',
  'purpose',
  'tx_domain',
  'tx_family',
  'tx_sub_family',
  'creditor_reference',
  'instructed_currency',
  'review_reasons',
]

export const DESK_IBAN = 'XX00FAKE0000000013'

/** Ledger rows newest first, as the live tab holds them, A to R. */
export const LEDGER_ROWS: CellValue[][] = [
  [46300, 'main', 's-002', 'GADGET CORNER', '', 'Card purchase', -38.9, 1000, 'unknown', 'ai', 'REF-4', '', '', '', '', '', '', ''],
  [46299, 'main', 's-002', 'MODEL API INC', '', 'Card purchase', -20, 1038.9, 'ai-services', 'ai', 'REF-3', '', '', '', '', '', '', ''],
  [46298, 'main', 's-001', 'Desk Co', DESK_IBAN, 'Desk', -100, 1058.9, 'equipment', 'human', 'REF-2', '', '', '', '', '', '', ''],
  [46297, 'main', 's-001', 'Cash deposit', '', 'Deposit', 500, 1158.9, 'revenue', 'rule', '', '', '', '', '', '', '', ''],
]

export function ruleRow(cells: Partial<Record<(typeof RULE_COLUMNS)[number], CellValue>>): CellValue[] {
  return RULE_COLUMNS.map((column) => cells[column] ?? '')
}

/** A new row's id as the app makes one: a version 4 UUID. */
export const AN_ID = expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)

/** A cell as an updateCells or appendCells request carries it, a blank one as no value. */
export function cellData(value: CellValue): CellData {
  if (value === '') return {}
  return { userEnteredValue: typeof value === 'number' ? { numberValue: value } : typeof value === 'boolean' ? { boolValue: value } : { stringValue: value } }
}

/** The request that gives one cell, or a run of rows in its column, a number format, 0-based as the API counts. */
export function numberFormatRequest(sheetId: number, rowIndex: number, columnIndex: number, format: { type: 'DATE' | 'TEXT'; pattern: string }, rowCount = 1): SpreadsheetRequest {
  return {
    repeatCell: {
      range: { sheetId, startRowIndex: rowIndex, endRowIndex: rowIndex + rowCount, startColumnIndex: columnIndex, endColumnIndex: columnIndex + 1 },
      cell: { userEnteredFormat: { numberFormat: format } },
      fields: 'userEnteredFormat.numberFormat',
    },
  }
}

export function dateFormat(sheetId: number, rowIndex: number, columnIndex: number, rowCount = 1): SpreadsheetRequest {
  return numberFormatRequest(sheetId, rowIndex, columnIndex, { type: 'DATE', pattern: 'yyyy-mm-dd' }, rowCount)
}

export function textFormat(sheetId: number, rowIndex: number, columnIndex: number, rowCount = 1): SpreadsheetRequest {
  return numberFormatRequest(sheetId, rowIndex, columnIndex, { type: 'TEXT', pattern: '@' }, rowCount)
}

export function workbookGrids(): Record<string, CellValue[][]> {
  return {
    ledger: [LEDGER_HEADER, ...LEDGER_ROWS.map((row) => [...row])],
    categories: [
      ['category', 'family', 'bucket'],
      ['equipment', 'operating', 'operating'],
      ['ai-services', 'operating', 'operating'],
      ['revenue', 'income', 'income'],
    ],
    accounts: [
      ['account', 'iban'],
      ['main', 'XX00FAKE0000000001'],
    ],
    settings: [
      ['key', 'value'],
      ['card_settlement_ibans', ''],
      ['review_label', 'ivan'],
    ],
    rules: [[...RULE_COLUMNS], ruleRow({ rule: 'merchant-model', order: 100, enabled: true, counterparty_contains: 'MODEL', category: 'ai-services', confidence: 'rule' })],
  }
}

export interface WriteBackHarness {
  readonly store: WorkbookStore<WorkbookSnapshot>
  readonly sheets: FakeSheets
  /** Every range an updateCells request wrote, in order, in A1 notation. */
  readonly writtenRanges: () => string[]
}

const SHEET = { id: 'sheet-under-test', name: 'Books' }

function ports(choice: WorkbookChoice, sheets: FakeSheets, used: Set<string>): SpreadsheetStorePorts {
  return {
    loadChoice: () => choice,
    saveChoice: () => {},
    openCache: (id) => {
      used.add(id)
      return openWorkbookCache(id)
    },
    fetchFromGoogle: async () => readSnapshotFrom(sheets, SHEET),
    prepareSync: () => {},
    hasLiveAccessToken: () => true,
    forgetGoogleSignIn: () => {},
    signOutOfGoogle: async () => {},
    newLocalId: () => 'local-new',
    now: () => '2026-10-17T09:00:00.000Z',
    requestPersistentStorage: () => {},
    googleWriter: async () => googleWorkbookWriter(sheets),
  }
}

/** A store showing a Google Sheet held in a fake that records every request, read once as a sync would, with the tabs' number formats where a test gives them. */
export async function googleHarness(used: Set<string>, grids = workbookGrids(), numberFormats: Record<string, (string | null)[][]> = {}): Promise<WriteBackHarness> {
  const sheets = createFakeSheets(grids, numberFormats)
  const snapshot = await readSnapshotFrom(sheets, SHEET)
  await keepInCache(snapshot, used)
  const store = createWorkbookStore(spreadsheetStorePorts(ports({ source: 'google', id: SHEET.id, name: SHEET.name }, sheets, used)))
  await store.open()
  sheets.requests.length = 0
  return {
    store,
    sheets,
    writtenRanges: () => updatedRanges(sheets),
  }
}

/** A store showing the same workbook kept in this browser. Its fake Sheet is never asked for anything. */
export async function excelHarness(used: Set<string>, grids = workbookGrids()): Promise<WriteBackHarness> {
  const sheets = createFakeSheets({})
  const id = 'local-under-test'
  const tabs = Object.fromEntries(Object.entries(grids).map(([tab, values]) => [tab, sheetRowsFromValues(values)]))
  const snapshot = {
    meta: { id, source: 'excel', title: 'Books', syncedAt: '2026-10-16T09:00:00.000Z', lastExportedAt: null, unexportedSince: null, missingTabs: [] },
    ...EMPTY_TABS,
    ...tabs,
  } as WorkbookSnapshot
  await keepInCache(snapshot, used)
  const store = createWorkbookStore(spreadsheetStorePorts(ports({ source: 'excel', id, name: 'Books' }, sheets, used)))
  await store.open()
  return { store, sheets, writtenRanges: () => [] }
}

/** Every request the writes sent in their batchUpdates, in order. */
export function sentRequests(sheets: FakeSheets): SpreadsheetRequest[] {
  return sheets.requests.flatMap((request) => (request.kind === 'updateSpreadsheet' ? [...request.requests] : []))
}

function updatedRanges(sheets: FakeSheets): string[] {
  return sentRequests(sheets).flatMap((change) => {
    if (!('updateCells' in change)) return []
    const { start, rows } = change.updateCells
    const width = Math.max(...rows.map((row) => row.values.length))
    const from = `${columnLetter(start.columnIndex + 1)}${start.rowIndex + 1}`
    const to = `${columnLetter(start.columnIndex + width)}${start.rowIndex + rows.length}`
    return [`${sheetNameInRange(sheets.tabWithId(start.sheetId) ?? '?')}!${from === to ? from : `${from}:${to}`}`]
  })
}

async function keepInCache(snapshot: WorkbookSnapshot, used: Set<string>): Promise<void> {
  used.add(snapshot.meta.id)
  const cache = openWorkbookCache(snapshot.meta.id)
  await cache.replace(snapshot)
  cache.close()
}

export async function forgetCaches(used: Set<string>): Promise<void> {
  for (const id of used) {
    await openWorkbookCache(id).delete()
  }
  used.clear()
}
