/**
 * Writes the fake build's made-up portfolio workbook to a folder, and a copy whose first deposit was edited from
 * 5,000.00 to 5,200.00, so the visual and touch checks drop them on the Investments import through the file input, as
 * a person picks a file.
 */

import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import * as XLSX from 'xlsx'

import { SAMPLE_WORKBOOK_FILE_NAME, sampleWorkbookFile, sampleWorkbookGrid } from '../../src/apps/investments/imports/infrastructure/fake/sampleWorkbook.ts'

export async function writeWorkbookSamples(folder) {
  const workbook = join(folder, SAMPLE_WORKBOOK_FILE_NAME)
  writeFileSync(workbook, await sampleWorkbookFile())
  const edited = join(folder, `edited-${SAMPLE_WORKBOOK_FILE_NAME}`)
  const grid = sampleWorkbookGrid().map((row, index) => (index === 2 ? row.map((cell) => (cell === 5000 ? 5200 : cell)) : row))
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(grid), 'Transactions')
  writeFileSync(edited, XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }))
  return { workbook, edited }
}
