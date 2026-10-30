import { codecOfInvestmentsKind } from '../application/investmentsCodecs'
import type { InvestmentsBooks } from '../domain/investmentsBooks'
import { investmentsRecordsOf, readInvestmentBook } from '../domain/readInvestmentBook'
import type { WorkbookDocument } from '../../../../shared/storage/infrastructure/documentFormat'
import { newDocument, recordsOfDocument } from '../../../../shared/storage/infrastructure/documentRecordStorage'
import type { AppDocument } from '../../../../shared/storage/infrastructure/documentStorePorts'

/** The app of the hub whose file this store keeps. */
export const INVESTMENTS_APP = 'investments'

const INVESTMENTS_SCHEMA: WorkbookDocument['schema'] = { investments: 1 }

/** An Investments file with no records, which a first run keeps on Drive or in this browser. */
export function emptyInvestmentsDocument(savedAt: string): WorkbookDocument {
  return newDocument(INVESTMENTS_APP, INVESTMENTS_SCHEMA, {}, savedAt)
}

/** The Investments document as the store reads and writes it. */
export const INVESTMENTS_DOCUMENT: AppDocument<InvestmentsBooks> = {
  schema: () => INVESTMENTS_SCHEMA,
  codecOf: codecOfInvestmentsKind,
  read(copy) {
    const records = investmentsRecordsOf((kind) => recordsOfDocument(copy.document, kind, codecOfInvestmentsKind))
    return { records, workbook: { title: copy.meta.title, ...readInvestmentBook(records) } }
  },
}
