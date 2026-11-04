import type { WorkbookStore } from '../../../../shared/storage/application/createWorkbookStore'
import type { WorkbookDocument } from '../../../../shared/storage/infrastructure/documentFormat'
import type { DocumentCopy } from '../../../../shared/storage/infrastructure/documentRecordStorage'
import { pageWorkbookStore } from '../../../../shared/storage/infrastructure/pageWorkbookStore'
import type { AssetsBooks } from '../domain/assetsBooks'
import { ASSETS_APP, ASSETS_DOCUMENT } from '../infrastructure/assetsDocument'
import { words } from '../../words'

const assetsStore = pageWorkbookStore(ASSETS_APP, ASSETS_DOCUMENT, words.pickFile)

/** The one store the Assets screens share, over the Assets file on Drive or in this browser. */
export function useAssetsBooks(): WorkbookStore<AssetsBooks, DocumentCopy, WorkbookDocument> {
  return assetsStore
}
