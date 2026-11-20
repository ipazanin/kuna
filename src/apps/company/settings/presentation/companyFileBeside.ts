import type { DriveFileBeside } from '../../../../shared/storage/application/workbookPorts'
import type { Workbook } from '../../workbook/domain/workbook'
import { words } from './words'

/** What goes along when the books file moves: only its backups. The invoice folder is one the person picked, and its id finds it wherever the file is. */
export function companyFileBeside(workbook: Workbook): DriveFileBeside {
  return { files: [], folders: [], stays: workbook.settings.invoicing.folderId === '' ? [] : [words.books.invoiceFolder] }
}
