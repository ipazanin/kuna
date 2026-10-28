import type { WorkbookDocument } from '../../../../shared/storage/infrastructure/documentFormat'
import { newDocument } from '../../../../shared/storage/infrastructure/documentRecordStorage'
import type { AppDocument } from '../../../../shared/storage/infrastructure/documentStorePorts'
import type { LoansBooks } from '../domain/loansBooks'

/** The app of the hub whose file this store keeps. */
export const LOANS_APP = 'loans'

const LOANS_SCHEMA: WorkbookDocument['schema'] = { loans: 1 }

/** A Loans file with no records, which a first run keeps on Drive or in this browser. */
export function emptyLoansDocument(savedAt: string): WorkbookDocument {
  return newDocument(LOANS_APP, LOANS_SCHEMA, {}, savedAt)
}

/** The Loans document as the store reads and writes it. It has no kinds, so nothing asks for a codec. */
export const LOANS_DOCUMENT: AppDocument<LoansBooks> = {
  schema: () => LOANS_SCHEMA,
  codecOf: (kind) => {
    throw new Error(`The Loans app keeps no ${kind.name} records.`)
  },
  read: (copy) => ({ records: {}, workbook: { title: copy.meta.title } }),
}
