import { RULE_COLUMNS } from '../../src/features/rules/domain/rule'
import { createWorkbookStore } from '../../src/features/workbook/application/workbookStore'
import type { WorkbookStore, WorkbookStorePorts } from '../../src/features/workbook/application/workbookStore'
import { createFakeSheets } from '../../src/features/workbook/infrastructure/fake/fakeSheets'
import type { FakeSheets } from '../../src/features/workbook/infrastructure/fake/fakeSheets'
import { readSnapshotFrom } from '../../src/features/workbook/infrastructure/googleWorkbookPorts'
import { googleWorkbookWriter } from '../../src/features/workbook/infrastructure/googleWorkbookWriter'
import { openWorkbookCache } from '../../src/features/workbook/infrastructure/workbookCache'
import type { WorkbookChoice } from '../../src/features/workbook/infrastructure/workbookChoice'
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
  'family',
  'bucket',
  'month',
  'flagged_by',
  'reference',
]

export const DESK_IBAN = 'XX00FAKE0000000013'

/** Ledger rows newest first, as the live tab holds them. J to L carry what the Sheet's formulas would show. */
export const LEDGER_ROWS: CellValue[][] = [
  [46300, 'main', 's-002', 'GADGET CORNER', '', 'Card purchase', -38.9, 1000, 'unknown', 'unclassified', 'unclassified', '2026-10', 'ai', 'REF-4'],
  [46299, 'main', 's-002', 'MODEL API INC', '', 'Card purchase', -20, 1038.9, 'ai-services', 'operating', 'operating', '2026-10', 'ai', 'REF-3'],
  [46298, 'main', 's-001', 'Desk Co', DESK_IBAN, 'Desk', -100, 1058.9, 'equipment', 'operating', 'operating', '2026-10', 'human', 'REF-2'],
  [46297, 'main', 's-001', 'Cash deposit', '', 'Deposit', 500, 1158.9, 'revenue', 'income', 'income', '2026-10', 'rule', ''],
]

export function ruleRow(cells: Partial<Record<(typeof RULE_COLUMNS)[number], CellValue>>): CellValue[] {
  return RULE_COLUMNS.map((column) => cells[column] ?? '')
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
  readonly store: WorkbookStore
  readonly sheets: FakeSheets
  /** Every range a batchUpdate wrote, in order. */
  readonly writtenRanges: () => string[]
}

const SHEET = { id: 'sheet-under-test', name: 'Books' }

function ports(choice: WorkbookChoice, sheets: FakeSheets, used: Set<string>): WorkbookStorePorts {
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

/** A store showing a Google Sheet held in a fake that records every request, read once as a sync would. */
export async function googleHarness(used: Set<string>, grids = workbookGrids()): Promise<WriteBackHarness> {
  const sheets = createFakeSheets(grids)
  const snapshot = await readSnapshotFrom(sheets, SHEET)
  await keepInCache(snapshot, used)
  const store = createWorkbookStore(ports({ source: 'google', id: SHEET.id, name: SHEET.name }, sheets, used))
  await store.open()
  sheets.requests.length = 0
  return {
    store,
    sheets,
    writtenRanges: () => sheets.requests.flatMap((request) => (request.kind === 'batchUpdate' ? request.request.data.map((write) => write.range) : [])),
  }
}

/** A store showing the same workbook kept in this browser. Its fake Sheet is never asked for anything. */
export async function excelHarness(used: Set<string>, grids = workbookGrids()): Promise<WriteBackHarness> {
  const sheets = createFakeSheets({})
  const id = 'local-under-test'
  const tabs = Object.fromEntries(Object.entries(grids).map(([tab, values]) => [tab, sheetRowsFromValues(values)]))
  const snapshot = {
    meta: { id, source: 'excel', title: 'Books', syncedAt: '2026-10-16T09:00:00.000Z', ledgerSheetId: null, lastExportedAt: null, unexportedSince: null },
    ...EMPTY_TABS,
    ...tabs,
  } as WorkbookSnapshot
  await keepInCache(snapshot, used)
  const store = createWorkbookStore(ports({ source: 'excel', id, name: 'Books' }, sheets, used))
  await store.open()
  return { store, sheets, writtenRanges: () => [] }
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
