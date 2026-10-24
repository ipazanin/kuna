import { expect } from 'vitest'

import { RULE_COLUMNS } from '../../src/features/rules/domain/rule'
import { createWorkbookStore } from '../../src/features/workbook/application/createWorkbookStore'
import type { WorkbookStore, WorkbookStorePorts } from '../../src/features/workbook/application/createWorkbookStore'
import type { WorkbookCache, WorkbookChoice } from '../../src/features/workbook/application/workbookPorts'
import { browserDocumentHome, deleteBrowserDocument, replaceBrowserDocument } from '../../src/features/workbook/infrastructure/browserDocument'
import { decodeDocument, encodeDocument } from '../../src/features/workbook/infrastructure/documentFormat'
import type { WorkbookDocument } from '../../src/features/workbook/infrastructure/documentFormat'
import type { DocumentCopy } from '../../src/features/workbook/infrastructure/documentRecordStorage'
import { COMPANY_APP, documentStorePorts } from '../../src/features/workbook/infrastructure/documentStorePorts'
import { createDriveDocument, documentName } from '../../src/features/workbook/infrastructure/driveDocument'
import { createFakeDrive } from '../../src/features/workbook/infrastructure/fake/fakeDrive'
import type { FakeDrive } from '../../src/features/workbook/infrastructure/fake/fakeDrive'
import { documentOfTabs } from '../../src/features/workbook/infrastructure/spreadsheetDocument'
import { openWorkbookCache } from '../../src/features/workbook/infrastructure/workbookCache'
import type { CellValue } from '../../src/features/workbook/infrastructure/workbookSnapshot'
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

/** Tabs as a test gives them, each a grid with its header row first. */
type Grids = Readonly<Record<string, readonly (readonly CellValue[])[]>>

/** The tabs a test gives as grids, header row first, as the document opening them as an xlsx file makes. */
export function documentOfGrids(grids: Grids): WorkbookDocument {
  const tabs = Object.fromEntries(Object.entries(grids).map(([tab, values]) => [tab, sheetRowsFromValues(values)]))
  return documentOfTabs(COMPANY_APP, { ...EMPTY_TABS, ...tabs }, '2026-10-16T09:00:00.000Z')
}

function documentOfSeed(seed: Grids | WorkbookDocument): WorkbookDocument {
  return 'schema' in seed && 'records' in seed ? (seed as WorkbookDocument) : documentOfGrids(seed as Grids)
}

export interface WriteBackHarness {
  readonly store: WorkbookStore<DocumentCopy, WorkbookDocument>
  /** The Drive the file is kept on, or null for a workbook kept in this browser. */
  readonly drive: FakeDrive | null
  /** The document as its home holds it now. */
  held(): Promise<WorkbookDocument>
}

const NOW = '2026-10-17T09:00:00.000Z'

function storePorts(choice: WorkbookChoice, drive: FakeDrive, used: Set<string>): WorkbookStorePorts<DocumentCopy, WorkbookDocument> {
  const ports = documentStorePorts(async () => ({ drive, signIn: async () => {}, signedIn: () => true, pickFolder: async () => 'root', pickFile: async () => null }), () => NOW)
  return {
    ...ports,
    openCache: (id) => {
      used.add(id)
      return ports.openCache(id)
    },
    loadChoice: () => choice,
    saveChoice: () => {},
    prepareSync: () => {},
    hasLiveAccessToken: () => true,
    forgetGoogleSignIn: () => {},
    signOutOfGoogle: async () => {},
    newLocalId: () => 'local-new',
    now: () => NOW,
    pause: async () => {},
    requestPersistentStorage: () => {},
  }
}

async function keepInCache(copy: DocumentCopy, used: Set<string>): Promise<void> {
  used.add(copy.meta.id)
  const cache = openWorkbookCache(copy.meta.id)
  await cache.replace(copy)
  cache.close()
}

/** A store showing the workbook as a file on a fake Drive, read once as a sync would. The grids or the document seed it. */
export async function driveHarness(used: Set<string>, seed: Grids | WorkbookDocument = workbookGrids()): Promise<WriteBackHarness> {
  const drive = createFakeDrive()
  const document = documentOfSeed(seed)
  const folderId = await drive.createFolder('root', 'books')
  const { fileId, document: stored } = await createDriveDocument(drive, folderId, COMPANY_APP, encodeDocument(document))
  const name = documentName(COMPANY_APP)
  await keepInCache({ meta: { id: fileId, source: 'drive', title: name, syncedAt: '2026-10-16T09:00:00.000Z', lastExportedAt: null, unexportedSince: null }, revision: stored.revision, document }, used)
  const store = createWorkbookStore(storePorts({ source: 'drive', id: fileId, name }, drive, used))
  await store.open()
  drive.requests.length = 0
  return { store, drive, held: async () => decodeDocument(await drive.download(fileId)) }
}

/** A second device's store on the same file of the same Drive, which read the file as it stands now. */
export async function secondDevice(used: Set<string>, drive: FakeDrive, fileId: string): Promise<WorkbookStore<DocumentCopy, WorkbookDocument>> {
  const name = documentName(COMPANY_APP)
  const store = createWorkbookStore({ ...storePorts({ source: 'drive', id: fileId, name }, drive, used), openCache: () => memoryCache() })
  await store.open()
  await store.sync()
  return store
}

/** A cache of the copy held in memory, so a second device in the same test keeps its own. */
function memoryCache(): WorkbookCache<DocumentCopy> {
  let held: DocumentCopy | null = null
  return {
    replace: async (copy) => {
      held = copy
    },
    read: async () => held,
    delete: async () => {
      held = null
    },
    close: () => {},
  }
}

/** A store showing the same workbook kept in this browser. */
export async function browserHarness(used: Set<string>, seed: Grids | WorkbookDocument = workbookGrids()): Promise<WriteBackHarness> {
  const id = `local-under-test-${used.size}`
  const document = documentOfSeed(seed)
  const stored = await replaceBrowserDocument(id, encodeDocument(document))
  await keepInCache({ meta: { id, source: 'browser', title: 'Books', syncedAt: '2026-10-16T09:00:00.000Z', lastExportedAt: null, unexportedSince: null }, revision: stored.revision, document }, used)
  const store = createWorkbookStore(storePorts({ source: 'browser', id, name: 'Books' }, createFakeDrive(), used))
  await store.open()
  return { store, drive: null, held: async () => decodeDocument((await browserDocumentHome(id).read(null)).text) }
}

export async function forgetCaches(used: Set<string>): Promise<void> {
  for (const id of used) {
    await openWorkbookCache(id).delete()
    await deleteBrowserDocument(id)
  }
  used.clear()
}
