import type { WorkbookStore } from '../../../../shared/storage/application/createWorkbookStore'
import type { WorkbookDocument } from '../../../../shared/storage/infrastructure/documentFormat'
import type { DocumentCopy } from '../../../../shared/storage/infrastructure/documentRecordStorage'
import { documentName } from '../../../../shared/storage/infrastructure/driveDocument'
import type { InvestmentsBooks } from '../domain/investmentsBooks'
import { INVESTMENTS_APP, emptyInvestmentsDocument } from '../infrastructure/investmentsDocument'

type InvestmentsStore = WorkbookStore<InvestmentsBooks, DocumentCopy, WorkbookDocument>

/** The name of the Investments file on Drive. */
export const INVESTMENTS_FILE_NAME = documentName(INVESTMENTS_APP)

/** The title of an Investments file made in this browser. It is stored with the file, so it stays English. */
export const LOCAL_INVESTMENTS_TITLE = 'Investments file'

/** What a new Investments file holds: the document on screen, which moves along to its new home, or an empty one. */
export function newInvestmentsFileContents(store: InvestmentsStore): WorkbookDocument {
  return store.state.snapshot?.document ?? emptyInvestmentsDocument(new Date().toISOString())
}
