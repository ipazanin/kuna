import type { DriveFileBeside } from '../../../../shared/storage/application/workbookPorts'
import { BOOKS_FOLDER, folderTrail, startsAtBooksFolder } from '../../../../shared/text/folderPath'
import { MAIL_STATEMENTS_FOLDER } from '../../onboarding/domain/statementsChoice'
import type { Workbook } from '../../workbook/domain/workbook'
import { words } from './words'

/** The source the bank's mail is filed under, whose files are the statements Kuna made. */
const STATEMENTS_MAIL_SOURCE = 'statements'

/** Whether the books file their statements from mail into a folder named from My Drive, whose statements then follow the file, and so does the setting. */
function statementsFollowFile(workbook: Workbook): boolean {
  const { statementsFolder, statementsMailFrom } = workbook.settings
  return statementsFolder.length > 0 && !startsAtBooksFolder(statementsFolder) && statementsMailFrom.length > 0
}

/**
 * What goes along when the books file moves: only what Kuna made, so the statements it filed from mail come. A statements folder Kuna does not file
 * into keeps its path, since whatever does file there goes on being read. The invoice folder is one the person picked, and its id finds it wherever
 * the file is.
 */
export function companyFileBeside(workbook: Workbook): DriveFileBeside {
  const { statementsFolder, invoicing } = workbook.settings
  const statements = statementsFollowFile(workbook)
    ? [{ name: MAIL_STATEMENTS_FOLDER, fromPath: statementsFolder, mailSource: STATEMENTS_MAIL_SOURCE }]
    : startsAtBooksFolder(statementsFolder) && statementsFolder[1] !== undefined
      ? [{ name: statementsFolder[1], mailSource: STATEMENTS_MAIL_SOURCE }]
      : []
  return {
    files: [],
    folders: statements,
    stays: [...(statementsFolder.length > 0 && statements.length === 0 ? [folderTrail(statementsFolder)] : []), ...(invoicing.folderId === '' ? [] : [words.books.invoiceFolder])],
  }
}

/** The settings a move changes: mail then files into the statements folder beside the file, which is read from now on. */
export function settingsAfterMove(workbook: Workbook): readonly { readonly key: string; readonly value: string }[] {
  return statementsFollowFile(workbook) ? [{ key: 'statements_folder', value: [BOOKS_FOLDER, MAIL_STATEMENTS_FOLDER].join('/') }] : []
}
