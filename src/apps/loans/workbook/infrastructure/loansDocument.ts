import { codecOfLoansKind } from '../application/loansCodecs'
import type { LoansBooks } from '../domain/loansBooks'
import { loansRecordsOf, readLoanBook } from '../domain/readLoanBook'
import type { WorkbookDocument } from '../../../../shared/storage/infrastructure/documentFormat'
import { newDocument, recordsOfDocument } from '../../../../shared/storage/infrastructure/documentRecordStorage'
import type { AppDocument } from '../../../../shared/storage/infrastructure/documentStorePorts'

/** The app of the hub whose file this store keeps. */
export const LOANS_APP = 'loans'

const LOANS_SCHEMA: WorkbookDocument['schema'] = { loans: 1 }

/** A Loans file with no records, which a first run keeps on Drive or in this browser. */
export function emptyLoansDocument(savedAt: string): WorkbookDocument {
  return newDocument(LOANS_APP, LOANS_SCHEMA, {}, savedAt)
}

/** The Loans document as the store reads and writes it. */
export const LOANS_DOCUMENT: AppDocument<LoansBooks> = {
  schema: () => LOANS_SCHEMA,
  codecOf: codecOfLoansKind,
  read(copy) {
    const records = loansRecordsOf((kind) => recordsOfDocument(copy.document, kind, codecOfLoansKind))
    return { records, workbook: { title: copy.meta.title, ...readLoanBook(records) } }
  },
}
