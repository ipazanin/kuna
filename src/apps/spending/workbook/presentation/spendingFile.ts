import { starterCategories } from '../../categories/domain/starterCategories'
import { codecOfSpendingKind } from '../application/spendingCodecs'
import type { SpendingBooks } from '../domain/spendingBooks'
import { CATEGORY_RECORDS } from '../domain/spendingKinds'
import { SPENDING_APP } from '../domain/spendingBooks'
import { spendingDocumentOf } from '../infrastructure/spendingDocument'
import type { WorkbookStore } from '../../../../shared/storage/application/createWorkbookStore'
import type { WorkbookDocument } from '../../../../shared/storage/infrastructure/documentFormat'
import type { DocumentCopy } from '../../../../shared/storage/infrastructure/documentRecordStorage'
import { documentName } from '../../../../shared/storage/infrastructure/driveDocument'
import { language } from '../../../../shared/text/language'

type SpendingStore = WorkbookStore<SpendingBooks, DocumentCopy, WorkbookDocument>

/** The name of the Spending file on Drive. */
export const SPENDING_FILE_NAME = documentName(SPENDING_APP)

/** The title of a Spending file made in this browser. It is stored with the file, so it stays English. */
export const LOCAL_SPENDING_TITLE = 'Spending file'

/** A new Spending file with the starter categories, named in the language on screen. */
export function starterSpendingDocument(savedAt: string): WorkbookDocument {
  const codec = codecOfSpendingKind(CATEGORY_RECORDS)
  return spendingDocumentOf(savedAt, { [CATEGORY_RECORDS.name]: starterCategories(language).map((category) => codec.fieldsOf(category)) })
}

/** What a new Spending file holds: the document on screen, which moves along to its new home, or a new one with the starter categories. */
export function newSpendingFileContents(store: SpendingStore): WorkbookDocument {
  return store.state.snapshot?.document ?? starterSpendingDocument(new Date().toISOString())
}
