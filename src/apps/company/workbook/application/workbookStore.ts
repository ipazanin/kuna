import type { WorkbookStore } from '../../../../shared/storage/application/createWorkbookStore'
import type { WorkbookDocument } from '../../../../shared/storage/infrastructure/documentFormat'
import type { DocumentCopy } from '../../../../shared/storage/infrastructure/documentRecordStorage'
import { pageWorkbookStore } from '../../../../shared/storage/infrastructure/pageWorkbookStore'
import type { CompanyBooks } from '../domain/readWorkbook'
import { COMPANY_APP, COMPANY_DOCUMENT } from '../infrastructure/companyDocument'
import { words } from '../../words'

const workbookStore = pageWorkbookStore(COMPANY_APP, COMPANY_DOCUMENT, words.pickFile)

/** The one workbook store the screens share, over the document in a Drive file or in this browser. */
export function useWorkbook(): WorkbookStore<CompanyBooks, DocumentCopy, WorkbookDocument> {
  return workbookStore
}
