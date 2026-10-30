import type { WorkbookStore } from '../../../../shared/storage/application/createWorkbookStore'
import type { WorkbookDocument } from '../../../../shared/storage/infrastructure/documentFormat'
import type { DocumentCopy } from '../../../../shared/storage/infrastructure/documentRecordStorage'
import { documentName } from '../../../../shared/storage/infrastructure/driveDocument'
import type { LoansBooks } from '../domain/loansBooks'
import { LOANS_APP, emptyLoansDocument } from '../infrastructure/loansDocument'

type LoansStore = WorkbookStore<LoansBooks, DocumentCopy, WorkbookDocument>

/** The name of the Loans file on Drive. */
export const LOANS_FILE_NAME = documentName(LOANS_APP)

/** The title of a Loans file made in this browser. It is stored with the file, so it stays English. */
export const LOCAL_LOANS_TITLE = 'Loans file'

/** What a new Loans file holds: the document on screen, which moves along to its new home, or an empty one. */
export function newLoansFileContents(store: LoansStore): WorkbookDocument {
  return store.state.snapshot?.document ?? emptyLoansDocument(new Date().toISOString())
}
