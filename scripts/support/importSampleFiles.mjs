/**
 * Writes the fake build's two sample statement files to a folder, so the visual and touch checks
 * drop them on Import through the file input, as a person picks a file.
 */

import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { SAMPLE_CAMT_FILE_NAME, SAMPLE_TABLE_FILE_NAME, sampleCamtXml, sampleTableFile } from '../../src/apps/company/imports/infrastructure/fake/sampleImportFiles.ts'
import { SAMPLE_REFUSED_FILE_NAME, SAMPLE_REVOLUT_FILE_NAME, sampleRefusedCsv, sampleRevolutCsv } from '../../src/apps/spending/statements/infrastructure/fake/sampleRevolutFiles.ts'
import { SAMPLE_RECEIPT_TOTALS, sampleFiscalQrText, sampleReceiptPng } from '../../src/apps/spending/receipts/infrastructure/fake/sampleReceiptPhoto.ts'
import { today } from '../../src/shared/calendar/civilDate.ts'

export async function writeImportSamples(folder) {
  const camt = join(folder, SAMPLE_CAMT_FILE_NAME)
  const table = join(folder, SAMPLE_TABLE_FILE_NAME)
  writeFileSync(camt, sampleCamtXml())
  writeFileSync(table, await sampleTableFile())
  return { camt, table }
}

/** Writes the made-up Revolut exports of the day, one the fake Spending statements set pairs with and one the reader refuses. */
export function writeSpendingImportSamples(folder) {
  const revolut = join(folder, SAMPLE_REVOLUT_FILE_NAME)
  const refused = join(folder, SAMPLE_REFUSED_FILE_NAME)
  writeFileSync(revolut, sampleRevolutCsv(today()))
  writeFileSync(refused, sampleRefusedCsv(today()))
  return { revolut, refused }
}

/** Writes the made-up receipt photos of the day, each with a real QR code for the fake receipts set's payments, and one with no code. */
export function writeSpendingReceiptSamples(folder) {
  const write = (name, qrText) => {
    const path = join(folder, name)
    writeFileSync(path, sampleReceiptPng(qrText))
    return path
  }
  const coded = Object.entries(SAMPLE_RECEIPT_TOTALS).map(([name, cents]) => [name, write(`sample-receipt-${name}.png`, sampleFiscalQrText(today(), cents))])
  return { ...Object.fromEntries(coded), noCode: write('sample-receipt-no-code.png', null) }
}
