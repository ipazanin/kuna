import type { WorkbookStore } from '../../../../shared/storage/application/createWorkbookStore'
import type { WorkbookDocument } from '../../../../shared/storage/infrastructure/documentFormat'
import type { DocumentCopy } from '../../../../shared/storage/infrastructure/documentRecordStorage'
import { pageWorkbookStore } from '../../../../shared/storage/infrastructure/pageWorkbookStore'
import type { InvestmentsBooks } from '../domain/investmentsBooks'
import { INVESTMENTS_APP, INVESTMENTS_DOCUMENT } from '../infrastructure/investmentsDocument'
import { words } from '../../words'

const investmentsStore = pageWorkbookStore(INVESTMENTS_APP, INVESTMENTS_DOCUMENT, words.pickFile)

/** The one store the Investments screens share, over the Investments file on Drive or in this browser. */
export function useInvestmentsBooks(): WorkbookStore<InvestmentsBooks, DocumentCopy, WorkbookDocument> {
  return investmentsStore
}
