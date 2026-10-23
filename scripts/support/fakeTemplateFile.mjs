import { writeFileSync } from 'node:fs'

import { fakeWorkbookSnapshot } from '../../src/features/workbook/infrastructure/fake/fakeWorkbook.ts'
import { writeWorkbookFile } from '../../src/features/workbook/infrastructure/workbookFile.ts'
import { readSnapshot } from '../../src/features/workbook/infrastructure/spreadsheetTab.ts'
import { installHrDooPack } from './installPack.mjs'

/**
 * Writes the fake workbook as an xlsx file in the template format, with the app's own writer, so
 * a check can import it the way a user imports a filled-in template. Every value in it is made up.
 */
export async function writeFakeTemplateFile(path) {
  installHrDooPack()
  const snapshot = fakeWorkbookSnapshot('2026-10-16T08:00:00.000Z', 'excel')
  writeFileSync(path, await writeWorkbookFile(snapshot, readSnapshot(snapshot).workbook))
  return path
}
