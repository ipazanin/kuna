import { today } from '../../calendar/civilDate'
import { downloadFile } from '../../files/downloadFile'
import { JSON_MIME_TYPE } from '../../google/driveClient'
import type { BooksRead, WorkbookStore } from '../application/createWorkbookStore'
import { encodeDocument } from '../infrastructure/documentFormat'
import type { WorkbookDocument } from '../infrastructure/documentFormat'
import type { DocumentCopy } from '../infrastructure/documentRecordStorage'

export type ExportableStore = Pick<WorkbookStore<BooksRead, DocumentCopy, WorkbookDocument>, 'state' | 'recordExport'>

/**
 * Hands the browser the app's file on screen as JSON, as the file holds it, named `kuna-<app>-export-<yyyy-mm-dd>.json`
 * so a pick on Drive does not take it for a daily backup, and notes the export. Throws `nothingToExport` when no file is on screen.
 */
export async function exportAppFile(store: ExportableStore, app: string, nothingToExport: string): Promise<string> {
  const snapshot = store.state.snapshot
  if (snapshot === null) {
    throw new Error(nothingToExport)
  }
  const fileName = `kuna-${app}-export-${today()}.json`
  downloadFile(encodeDocument(snapshot.document), fileName, JSON_MIME_TYPE)
  await store.recordExport()
  return fileName
}
