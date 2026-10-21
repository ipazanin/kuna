/**
 * Writes the fake build's two sample statement files to a folder, so the visual and touch checks
 * drop them on Import through the file input, as a person picks a file.
 */

import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { SAMPLE_CAMT_FILE_NAME, SAMPLE_TABLE_FILE_NAME, sampleCamtXml, sampleTableFile } from '../../src/features/imports/infrastructure/fake/sampleImportFiles.ts'

export async function writeImportSamples(folder) {
  const camt = join(folder, SAMPLE_CAMT_FILE_NAME)
  const table = join(folder, SAMPLE_TABLE_FILE_NAME)
  writeFileSync(camt, sampleCamtXml())
  writeFileSync(table, await sampleTableFile())
  return { camt, table }
}
