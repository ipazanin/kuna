import Dexie from 'dexie'
import type { EntityTable } from 'dexie'

import type { WorkbookCache } from '../application/workbookPorts'
import type { DocumentCopy } from './documentRecordStorage'

const COPY_KEY = 'workbook'

interface StoredCopy extends DocumentCopy {
  readonly key: typeof COPY_KEY
}

type WorkbookDatabase = Dexie & {
  copy: EntityTable<StoredCopy, 'key'>
}

function workbookDatabaseName(workbookId: string): string {
  return `ledgerboard-workbook-${workbookId}`
}

/**
 * The copy is one row: the document whole, with its revision and what names it.
 */
function openDatabase(workbookId: string): WorkbookDatabase {
  const database = new Dexie(workbookDatabaseName(workbookId)) as WorkbookDatabase
  database.version(9).stores({ copy: 'key' })
  return database
}

/** One workbook in this browser, as Dexie keeps it: the document whole with its revision. */
export function openWorkbookCache(workbookId: string): WorkbookCache<DocumentCopy> {
  const database = openDatabase(workbookId)

  return {
    async replace(copy) {
      if (copy.meta.id !== workbookId) {
        throw new Error(`Refusing to keep workbook ${copy.meta.id} in the database for ${workbookId}.`)
      }
      await database.copy.put({ key: COPY_KEY, ...copy })
    },

    async read() {
      const stored = await database.copy.get(COPY_KEY)
      if (stored === undefined) {
        return null
      }
      const { key: _key, ...copy } = stored
      return copy
    },

    async delete() {
      await database.delete()
    },

    close() {
      database.close()
    },
  }
}
