import Dexie from 'dexie'
import type { EntityTable } from 'dexie'

import { CACHED_TABS } from './workbookSnapshot'
import type { SheetRow, WorkbookMeta, WorkbookSnapshot } from './workbookSnapshot'

const META_KEY = 'workbook'

interface StoredMeta extends WorkbookMeta {
  readonly key: typeof META_KEY
}

type WorkbookDatabase = Dexie & {
  meta: EntityTable<StoredMeta, 'key'>
  ledger: EntityTable<SheetRow, 'sheetRow'>
  categories: EntityTable<SheetRow, 'sheetRow'>
  accounts: EntityTable<SheetRow, 'sheetRow'>
}

function workbookDatabaseName(spreadsheetId: string): string {
  return `ledgerboard-workbook-${spreadsheetId}`
}

function openDatabase(spreadsheetId: string): WorkbookDatabase {
  const database = new Dexie(workbookDatabaseName(spreadsheetId)) as WorkbookDatabase
  database.version(1).stores({
    meta: 'key',
    ledger: 'sheetRow',
    categories: 'sheetRow',
    accounts: 'sheetRow',
  })
  return database
}

/** The local copy of one spreadsheet. Every sync replaces it whole, since the workbook is small. */
export interface WorkbookCache {
  replace(snapshot: WorkbookSnapshot): Promise<void>
  read(): Promise<WorkbookSnapshot | null>
  delete(): Promise<void>
  close(): void
}

export function openWorkbookCache(spreadsheetId: string): WorkbookCache {
  const database = openDatabase(spreadsheetId)
  const tables = [database.meta, database.ledger, database.categories, database.accounts]

  return {
    async replace(snapshot) {
      if (snapshot.meta.spreadsheetId !== spreadsheetId) {
        throw new Error(
          `Refusing to cache spreadsheet ${snapshot.meta.spreadsheetId} in the database for ${spreadsheetId}.`,
        )
      }
      await database.transaction('rw', tables, async () => {
        await Promise.all(tables.map((table) => table.clear()))
        await Promise.all(CACHED_TABS.map((tab) => database[tab].bulkAdd([...snapshot[tab]])))
        await database.meta.put({ key: META_KEY, ...snapshot.meta })
      })
    },

    async read() {
      return database.transaction('r', tables, async () => {
        const stored = await database.meta.get(META_KEY)
        if (stored === undefined) {
          return null
        }
        const { key: _key, ...meta } = stored
        const [ledger, categories, accounts] = await Promise.all([
          database.ledger.toArray(),
          database.categories.toArray(),
          database.accounts.toArray(),
        ])
        return { meta, ledger, categories, accounts }
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
