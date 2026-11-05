import { codecOfSpendingKind } from '../application/spendingCodecs'
import type { SpendingBooks } from '../domain/spendingBooks'
import { readSpendingBook, spendingRecordsOf } from '../domain/readSpendingBook'
import type { WorkbookDocument } from '../../../../shared/storage/infrastructure/documentFormat'
import { newDocument, recordsOfDocument } from '../../../../shared/storage/infrastructure/documentRecordStorage'
import type { AppDocument } from '../../../../shared/storage/infrastructure/documentStorePorts'

/** The app of the hub whose file this store keeps. */
export const SPENDING_APP = 'spending'

const SPENDING_SCHEMA: WorkbookDocument['schema'] = { spending: 1 }

/** A Spending file with the records given, by kind name, which a first run keeps on Drive or in this browser. */
export function spendingDocumentOf(savedAt: string, records: WorkbookDocument['records'] = {}): WorkbookDocument {
  return newDocument(SPENDING_APP, SPENDING_SCHEMA, records, savedAt)
}

/** The Spending document as the store reads and writes it. */
export const SPENDING_DOCUMENT: AppDocument<SpendingBooks> = {
  schema: () => SPENDING_SCHEMA,
  codecOf: codecOfSpendingKind,
  read(copy) {
    const records = spendingRecordsOf((kind) => recordsOfDocument(copy.document, kind, codecOfSpendingKind))
    return { records, workbook: { title: copy.meta.title, ...readSpendingBook(records) } }
  },
}
