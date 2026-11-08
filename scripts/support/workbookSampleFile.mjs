/**
 * Writes the fake build's made-up portfolio workbook to a folder, a copy whose first deposit was edited from 5,000.00 to
 * 5,200.00, and a copy without its split, its spin-off and the rows after them that move those units, so the visual and
 * touch checks drop them on the Investments import or the chat through the file input, as a person picks a file. The
 * chat leaves a split's and a spin-off's questions to the Import dialog, so only the copy without them becomes a card.
 */

import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import * as XLSX from 'xlsx'

import { WORKBOOK_COLUMNS } from '../../src/apps/investments/imports/domain/portfolioWorkbook.ts'
import { SAMPLE_WORKBOOK_FILE_NAME, sampleWorkbookFile, sampleWorkbookGrid } from '../../src/apps/investments/imports/infrastructure/fake/sampleWorkbook.ts'

const ASKED_IN_THE_IMPORT = new Set(['SPLIT', 'SPINOFF', 'SELL', 'TRANSFER OUT', 'TRANSFER IN'])

function writeGrid(path, grid) {
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(grid), 'Transactions')
  writeFileSync(path, XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }))
  return path
}

export async function writeWorkbookSamples(folder) {
  const workbook = join(folder, SAMPLE_WORKBOOK_FILE_NAME)
  writeFileSync(workbook, await sampleWorkbookFile())
  const grid = sampleWorkbookGrid()
  const edited = writeGrid(
    join(folder, `edited-${SAMPLE_WORKBOOK_FILE_NAME}`),
    grid.map((row, index) => (index === 2 ? row.map((cell) => (cell === 5000 ? 5200 : cell)) : row)),
  )
  const type = grid[1].indexOf(WORKBOOK_COLUMNS.type)
  const withoutSplit = writeGrid(
    join(folder, `without-split-${SAMPLE_WORKBOOK_FILE_NAME}`),
    grid.filter((row) => !ASKED_IN_THE_IMPORT.has(row[type])),
  )
  return { workbook, edited, withoutSplit }
}
