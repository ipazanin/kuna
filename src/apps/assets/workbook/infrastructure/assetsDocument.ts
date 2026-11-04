import { codecOfAssetsKind } from '../application/assetsCodecs'
import type { AssetsBooks } from '../domain/assetsBooks'
import { assetsRecordsOf, readAssetBook } from '../domain/readAssetBook'
import type { WorkbookDocument } from '../../../../shared/storage/infrastructure/documentFormat'
import { newDocument, recordsOfDocument } from '../../../../shared/storage/infrastructure/documentRecordStorage'
import type { AppDocument } from '../../../../shared/storage/infrastructure/documentStorePorts'

/** The app of the hub whose file this store keeps. */
export const ASSETS_APP = 'assets'

const ASSETS_SCHEMA: WorkbookDocument['schema'] = { assets: 1 }

/** An Assets file with no records, which a first run keeps on Drive or in this browser. */
export function emptyAssetsDocument(savedAt: string): WorkbookDocument {
  return newDocument(ASSETS_APP, ASSETS_SCHEMA, {}, savedAt)
}

/** The Assets document as the store reads and writes it. */
export const ASSETS_DOCUMENT: AppDocument<AssetsBooks> = {
  schema: () => ASSETS_SCHEMA,
  codecOf: codecOfAssetsKind,
  read(copy) {
    const records = assetsRecordsOf((kind) => recordsOfDocument(copy.document, kind, codecOfAssetsKind))
    return { records, workbook: { title: copy.meta.title, ...readAssetBook(records) } }
  },
}
