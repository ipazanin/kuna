/**
 * Writes the fake build's two sample statement files to a folder, so the visual and touch checks
 * drop them on Import through the file input, as a person picks a file.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  SAMPLE_CAMT_FILE_NAME,
  SAMPLE_REFUND_FILE_NAME,
  SAMPLE_TABLE_FILE_NAME,
  sampleCamtXml,
  sampleOwnerRefundXml,
  sampleTableFile,
} from '../../src/apps/company/imports/infrastructure/fake/sampleImportFiles.ts'
import {
  SAMPLE_MISSING_FILE_NAME,
  SAMPLE_REFUSED_FILE_NAME,
  SAMPLE_REVOLUT_FILE_NAME,
  sampleMissingAccountsCsv,
  sampleRefusedCsv,
  sampleRevolutCsv,
} from '../../src/apps/spending/statements/infrastructure/fake/sampleRevolutFiles.ts'
import { SAMPLE_RECEIPT_TOTALS, jpegWithMadeUpPlace, sampleFiscalQrText, sampleReceiptPng } from '../../src/apps/spending/receipts/infrastructure/fake/sampleReceiptPhoto.ts'
import { sampleFlexReport } from '../../src/apps/investments/mail/infrastructure/fake/sampleFlexReport.ts'
import { addDays, today } from '../../src/shared/calendar/civilDate.ts'

/** The day the sample files are made for. The checks pass it to the page as `?day=`, so the fake app seeds its rows from the same day. */
export const SAMPLE_DAY = today()

export async function writeImportSamples(folder) {
  const camt = join(folder, SAMPLE_CAMT_FILE_NAME)
  const table = join(folder, SAMPLE_TABLE_FILE_NAME)
  const refund = join(folder, SAMPLE_REFUND_FILE_NAME)
  writeFileSync(camt, sampleCamtXml())
  writeFileSync(table, await sampleTableFile())
  writeFileSync(refund, sampleOwnerRefundXml())
  return { camt, table, refund }
}

/** Writes a made-up IBKR Activity Flex report of the three days before yesterday, as a person saves it from IBKR, and one that no longer fits its recipe. */
export function writeFlexReportSamples(folder) {
  const days = [-4, -3, -2].map((day) => addDays(today(), day))
  const flexReport = join(folder, 'kuna-daily.xml')
  const misfit = join(folder, 'kuna-daily-misfit.xml')
  writeFileSync(flexReport, sampleFlexReport(days))
  writeFileSync(misfit, sampleFlexReport(days, 'no-trades-section'))
  return { flexReport, misfit }
}

/** Writes the made-up Revolut exports of the day: one the fake Spending statements set pairs with, one the reader refuses, and one in currencies no account keeps. */
export function writeSpendingImportSamples(folder) {
  const revolut = join(folder, SAMPLE_REVOLUT_FILE_NAME)
  const refused = join(folder, SAMPLE_REFUSED_FILE_NAME)
  writeFileSync(revolut, sampleRevolutCsv(SAMPLE_DAY))
  const missing = join(folder, SAMPLE_MISSING_FILE_NAME)
  writeFileSync(refused, sampleRefusedCsv(SAMPLE_DAY))
  writeFileSync(missing, sampleMissingAccountsCsv(SAMPLE_DAY))
  return { revolut, refused, missing }
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

/** Writes a made-up JPEG of a PNG the page drew, with a made-up GPS position in its Exif, so the page reads the place from the file as taken. */
export async function writeJpegWithPlace(page, pngPath, jpegPath) {
  const base64 = await page.evaluate(async (png) => {
    const blob = new Blob([Uint8Array.from(atob(png), (character) => character.charCodeAt(0))], { type: 'image/png' })
    const bitmap = await createImageBitmap(blob)
    const canvas = Object.assign(document.createElement('canvas'), { width: bitmap.width, height: bitmap.height })
    canvas.getContext('2d').drawImage(bitmap, 0, 0)
    return canvas.toDataURL('image/jpeg', 0.95).split(',')[1]
  }, readFileSync(pngPath).toString('base64'))
  writeFileSync(jpegPath, jpegWithMadeUpPlace(Uint8Array.from(Buffer.from(base64, 'base64')), { latitude: 43.5081, longitude: 16.4402 }))
  return jpegPath
}
