import type { WorkbookStore } from '../../../../shared/storage/application/createWorkbookStore'
import type { WorkbookDocument } from '../../../../shared/storage/infrastructure/documentFormat'
import type { DocumentCopy } from '../../../../shared/storage/infrastructure/documentRecordStorage'
import { pageWorkbookStore } from '../../../../shared/storage/infrastructure/pageWorkbookStore'
import type { LoansBooks } from '../domain/loansBooks'
import { LOANS_APP, LOANS_DOCUMENT } from '../infrastructure/loansDocument'

const loansStore = pageWorkbookStore(LOANS_APP, LOANS_DOCUMENT, 'Pick your Loans file')

/** The one store the Loans screens share, over the Loans file on Drive or in this browser. */
export function useLoansBooks(): WorkbookStore<LoansBooks, DocumentCopy, WorkbookDocument> {
  return loansStore
}
