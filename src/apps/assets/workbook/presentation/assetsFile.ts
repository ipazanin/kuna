import type { WorkbookStore } from '../../../../shared/storage/application/createWorkbookStore'
import type { WorkbookDocument } from '../../../../shared/storage/infrastructure/documentFormat'
import type { DocumentCopy } from '../../../../shared/storage/infrastructure/documentRecordStorage'
import { documentName } from '../../../../shared/storage/infrastructure/driveDocument'
import type { AssetsBooks } from '../domain/assetsBooks'
import { ASSETS_APP, emptyAssetsDocument } from '../infrastructure/assetsDocument'

type AssetsStore = WorkbookStore<AssetsBooks, DocumentCopy, WorkbookDocument>

/** The name of the Assets file on Drive. */
export const ASSETS_FILE_NAME = documentName(ASSETS_APP)

/** The title of an Assets file made in this browser. It is stored with the file, so it stays English. */
export const LOCAL_ASSETS_TITLE = 'Assets file'

/** What a new Assets file holds: the document on screen, which moves along to its new home, or an empty one. */
export function newAssetsFileContents(store: AssetsStore): WorkbookDocument {
  return store.state.snapshot?.document ?? emptyAssetsDocument(new Date().toISOString())
}
