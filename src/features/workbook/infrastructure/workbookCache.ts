import Dexie from 'dexie'
import type { EntityTable } from 'dexie'

import { WORKBOOK_TABS } from './workbookSnapshot'
import type { SheetRow, WorkbookMeta, WorkbookSnapshot, WorkbookTabs } from './workbookSnapshot'

const META_KEY = 'workbook'

interface StoredMeta extends WorkbookMeta {
  readonly key: typeof META_KEY
}

type WorkbookDatabase = Dexie & {
  meta: EntityTable<StoredMeta, 'key'>
}

function workbookDatabaseName(workbookId: string): string {
  return `ledgerboard-workbook-${workbookId}`
}

function openDatabase(workbookId: string): WorkbookDatabase {
  const database = new Dexie(workbookDatabaseName(workbookId)) as WorkbookDatabase
  database.version(1).stores({
    meta: 'key',
    ledger: 'sheetRow',
    categories: 'sheetRow',
    accounts: 'sheetRow',
  })
  database.version(2).stores({ settings: 'sheetRow' })
  database.version(3).stores({ rules: 'sheetRow' })
  database.version(4).stores({ invoices: 'sheetRow', clients: 'sheetRow', 'owner-advances': 'sheetRow' })
  database.version(5).stores({ assets: 'sheetRow', grants: 'sheetRow', 'year-end': 'sheetRow', plan: 'sheetRow', scenarios: 'sheetRow' })
  return database
}

/**
 * One workbook in this browser: a copy of a Google Sheet, or in Excel mode the workbook itself.
 * Every write replaces it whole, since the workbook is small.
 */
export interface WorkbookCache {
  replace(snapshot: WorkbookSnapshot): Promise<void>
  read(): Promise<WorkbookSnapshot | null>
  delete(): Promise<void>
  close(): void
}

export function openWorkbookCache(workbookId: string): WorkbookCache {
  const database = openDatabase(workbookId)
  const tabTables = WORKBOOK_TABS.map((tab) => database.table<SheetRow, number>(tab))
  const tables = [database.meta, ...tabTables]

  return {
    async replace(snapshot) {
      if (snapshot.meta.id !== workbookId) {
        throw new Error(`Refusing to keep workbook ${snapshot.meta.id} in the database for ${workbookId}.`)
      }
      await database.transaction('rw', tables, async () => {
        await Promise.all(tables.map((table) => table.clear()))
        await Promise.all(WORKBOOK_TABS.map((tab, index) => tabTables[index]!.bulkAdd([...snapshot[tab]])))
        await database.meta.put({ key: META_KEY, ...snapshot.meta })
      })
    },

    async read() {
      return database.transaction('r', tables, async () => {
        const stored = await database.meta.get(META_KEY)
        if (stored === undefined) {
          return null
        }
        const meta = metaOf(stored)
        const rows = await Promise.all(tabTables.map((table) => table.toArray()))
        const tabs = Object.fromEntries(WORKBOOK_TABS.map((tab, index) => [tab, rows[index] ?? []])) as unknown as WorkbookTabs
        return { meta, ...tabs }
      })
    },

    async delete() {
      await database.delete()
    },

    close() {
      database.close()
    },
  }
}

/** A copy cached by an earlier version lacks the newer fields, and was always a Google Sheet. */
function metaOf(stored: StoredMeta): WorkbookMeta {
  const legacy = stored as Partial<StoredMeta> & { readonly spreadsheetId?: string }
  return {
    id: legacy.id ?? legacy.spreadsheetId ?? '',
    source: legacy.source ?? 'google',
    title: stored.title,
    syncedAt: stored.syncedAt,
    ledgerSheetId: legacy.ledgerSheetId ?? null,
    lastExportedAt: legacy.lastExportedAt ?? null,
    unexportedSince: legacy.unexportedSince ?? null,
    missingTabs: legacy.missingTabs ?? [],
  }
}
