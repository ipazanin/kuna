import { codecOfLoansKind } from '../application/loansCodecs'
import { LOANS_APP } from '../domain/loansApp'
import type { LoansBooks } from '../domain/loansBooks'
import { loansRecordsOf, readLoanBook } from '../domain/readLoanBook'
import type { WorkbookDocument } from '../../../../shared/storage/infrastructure/documentFormat'
import { newDocument, recordsOfDocument } from '../../../../shared/storage/infrastructure/documentRecordStorage'
import type { AppDocument } from '../../../../shared/storage/infrastructure/documentStorePorts'

const LOANS_SCHEMA: WorkbookDocument['schema'] = { loans: 2 }

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
