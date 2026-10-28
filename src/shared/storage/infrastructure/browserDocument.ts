import Dexie from 'dexie'
import type { EntityTable } from 'dexie'

import type { DocumentHome, StoredDocument } from '../application/documentHome'

const DOCUMENT_KEY = 'document'

interface DocumentRow {
  readonly key: typeof DOCUMENT_KEY
  /** New and random on every save, so a tab that read an older one finds the document moved, even after the database was deleted and made again. */
  readonly revision: string
  readonly text: string
}

type DocumentDatabase = Dexie & {
  document: EntityTable<DocumentRow, 'key'>
}

function openDatabase(documentId: string): DocumentDatabase {
  const database = new Dexie(`kuna-document-${documentId}`) as DocumentDatabase
  database.version(1).stores({ document: 'key' })
  return database
}

async function withDatabase<Result>(documentId: string, use: (database: DocumentDatabase) => Promise<Result>): Promise<Result> {
  const database = openDatabase(documentId)
  try {
    return await use(database)
  } finally {
    database.close()
  }
}

function storedOf(row: DocumentRow): StoredDocument {
  return { revision: row.revision, text: row.text }
}

function rowOf(text: string): DocumentRow {
  return { key: DOCUMENT_KEY, revision: crypto.randomUUID(), text }
}

/** Keeps `text` as the document of this browser, in place of any it held, as an import or a fresh start does. */
export function replaceBrowserDocument(documentId: string, text: string): Promise<StoredDocument> {
  return withDatabase(documentId, async (database) => {
    const row = rowOf(text)
    await database.document.put(row)
    return storedOf(row)
  })
}

/** Deletes the document this browser keeps under this id. */
export async function deleteBrowserDocument(documentId: string): Promise<void> {
  await openDatabase(documentId).delete()
}

/** The document kept in this browser's IndexedDB. Two tabs save one after the other, and nothing else saves at the same moment, so a save never runs its write again. */
export function browserDocumentHome(documentId: string): DocumentHome {
  return {
    async read(cached) {
      const row = await withDatabase(documentId, (database) => database.document.get(DOCUMENT_KEY))
      if (row === undefined) {
        throw new Error('This browser no longer holds the workbook. Open an Excel file or a backup to start again.')
      }
      return cached?.revision === row.revision ? cached : storedOf(row)
    },

    save(base, text) {
      return withDatabase(documentId, (database) =>
        database.transaction('rw', database.document, async () => {
          const current = await database.document.get(DOCUMENT_KEY)
          if (current === undefined || current.revision !== base.revision) {
            return { kind: 'moved' } as const
          }
          const row = rowOf(text)
          await database.document.put(row)
          return { kind: 'saved', document: storedOf(row) } as const
        }),
      )
    },
  }
}
