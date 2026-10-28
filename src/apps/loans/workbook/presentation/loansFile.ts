import { today } from '../../../../shared/calendar/civilDate'
import { downloadFile } from '../../../../shared/files/downloadFile'
import { JSON_MIME_TYPE } from '../../../../shared/google/driveClient'
import type { WorkbookStore } from '../../../../shared/storage/application/createWorkbookStore'
import { encodeDocument } from '../../../../shared/storage/infrastructure/documentFormat'
import type { WorkbookDocument } from '../../../../shared/storage/infrastructure/documentFormat'
import type { DocumentCopy } from '../../../../shared/storage/infrastructure/documentRecordStorage'
import { documentName } from '../../../../shared/storage/infrastructure/driveDocument'
import type { LoansBooks } from '../domain/loansBooks'
import { LOANS_APP, emptyLoansDocument } from '../infrastructure/loansDocument'

type LoansStore = WorkbookStore<LoansBooks, DocumentCopy, WorkbookDocument>

/** The name of the Loans file on Drive. */
export const LOANS_FILE_NAME = documentName(LOANS_APP)

/** What a new Loans file holds: the document on screen, which moves along to its new home, or an empty one. */
export function newLoansFileContents(store: LoansStore): WorkbookDocument {
  return store.state.snapshot?.document ?? emptyLoansDocument(new Date().toISOString())
}

/** Hands the browser the Loans file on screen as JSON, as the file holds it, named `kuna-loans-export-<yyyy-mm-dd>.json` so a pick on Drive does not take it for a daily backup, and notes the export. */
export async function exportLoansFile(store: LoansStore): Promise<string> {
  const snapshot = store.state.snapshot
  if (snapshot === null) {
    throw new Error('There is no Loans file to export yet.')
  }
  const fileName = `kuna-${LOANS_APP}-export-${today()}.json`
  downloadFile(encodeDocument(snapshot.document), fileName, JSON_MIME_TYPE)
  await store.recordExport()
  return fileName
}
