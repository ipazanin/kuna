import Dexie from 'dexie'
import type { EntityTable } from 'dexie'

import type { DocumentHome, StoredDocument } from '../application/documentHome'

const DOCUMENT_KEY = 'document'

interface DocumentRow {
  readonly key: typeof DOCUMENT_KEY
  /** Counts up with every save, so a tab that read an older one finds the document moved. */
  readonly revision: number
  readonly text: string
}

type DocumentDatabase = Dexie & {
  document: EntityTable<DocumentRow, 'key'>
}

async function withDatabase<Result>(documentId: string, use: (database: DocumentDatabase) => Promise<Result>): Promise<Result> {
  const database = new Dexie(`ledgerboard-document-${documentId}`) as DocumentDatabase
  database.version(1).stores({ document: 'key' })
  try {
    return await use(database)
  } finally {
    database.close()
  }
}

function storedOf(row: DocumentRow): StoredDocument {
  return { revision: String(row.revision), text: row.text }
}

/** Keeps `text` as the document of this browser, in place of any it held, as an import or a fresh start does. */
export function replaceBrowserDocument(documentId: string, text: string): Promise<StoredDocument> {
  return withDatabase(documentId, (database) =>
    database.transaction('rw', database.document, async () => {
      const row: DocumentRow = { key: DOCUMENT_KEY, revision: ((await database.document.get(DOCUMENT_KEY))?.revision ?? 0) + 1, text }
      await database.document.put(row)
      return storedOf(row)
    }),
  )
}

/** The document kept in this browser's IndexedDB. Two tabs save one after the other, and nothing else saves at the same moment, so a save never runs its write again. */
export function browserDocumentHome(documentId: string): DocumentHome {
  return {
    async read(cached) {
      const row = await withDatabase(documentId, (database) => database.document.get(DOCUMENT_KEY))
      if (row === undefined) {
        throw new Error('This browser no longer holds the workbook. Open an Excel file or a backup to start again.')
      }
      return cached?.revision === String(row.revision) ? cached : storedOf(row)
    },

    save(base, text) {
      return withDatabase(documentId, (database) =>
        database.transaction('rw', database.document, async () => {
          const current = await database.document.get(DOCUMENT_KEY)
          if (current === undefined || String(current.revision) !== base.revision) {
            return { kind: 'moved' } as const
          }
          const row: DocumentRow = { key: DOCUMENT_KEY, revision: current.revision + 1, text }
          await database.document.put(row)
          return { kind: 'saved', document: storedOf(row) } as const
        }),
      )
    },
  }
}
