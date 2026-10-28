import { writeFileSync } from 'node:fs'

import { readDocument } from '../../src/apps/company/workbook/infrastructure/documentStorePorts.ts'
import { fakeWorkbookDocument } from '../../src/apps/company/workbook/infrastructure/fake/fakeWorkbook.ts'
import { tabsOfDocument } from '../../src/apps/company/workbook/infrastructure/spreadsheetDocument.ts'
import { writeWorkbookFile } from '../../src/apps/company/workbook/infrastructure/workbookFile.ts'
import { installHrDooPack } from './installPack.mjs'

/**
 * Writes the fake workbook as an xlsx file in the template format, with the app's own writer, so
 * a check can import it the way a user imports a filled-in template. Every value in it is made up.
 */
export async function writeFakeTemplateFile(path) {
  installHrDooPack()
  const document = fakeWorkbookDocument('2026-10-16T08:00:00.000Z', 'browser')
  const { workbook } = readDocument({ id: 'fake', source: 'browser', title: 'Fake workbook', syncedAt: document.savedAt }, document)
  writeFileSync(path, await writeWorkbookFile(tabsOfDocument(document), workbook))
  return path
}
