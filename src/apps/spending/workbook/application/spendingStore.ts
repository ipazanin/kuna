import type { WorkbookStore } from '../../../../shared/storage/application/createWorkbookStore'
import type { WorkbookDocument } from '../../../../shared/storage/infrastructure/documentFormat'
import type { DocumentCopy } from '../../../../shared/storage/infrastructure/documentRecordStorage'
import { pageWorkbookStore } from '../../../../shared/storage/infrastructure/pageWorkbookStore'
import type { SpendingBooks } from '../domain/spendingBooks'
import { SPENDING_APP, SPENDING_DOCUMENT } from '../infrastructure/spendingDocument'
import { words } from '../../words'

const spendingStore = pageWorkbookStore(SPENDING_APP, SPENDING_DOCUMENT, words.pickFile)

/** The one store the Spending screens share, over the Spending file on Drive or in this browser. */
export function useSpendingBooks(): WorkbookStore<SpendingBooks, DocumentCopy, WorkbookDocument> {
  return spendingStore
}
