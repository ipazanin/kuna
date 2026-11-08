/**
 * Writes the made-up files the chat's attach checks pick through the file input, as a person picks them: a receipt photo,
 * a PDF of two pages and a turnover sheet.
 */

import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { PDFDocument } from 'pdf-lib'

import { sampleTableFile } from '../../src/apps/company/imports/infrastructure/fake/sampleImportFiles.ts'
import { sampleReceiptPng } from '../../src/apps/spending/receipts/infrastructure/fake/sampleReceiptPhoto.ts'

export async function writeChatAttachmentSamples(folder) {
  const photo = join(folder, 'chat-sample-receipt.png')
  const pdf = join(folder, 'chat-sample-statement.pdf')
  const sheet = join(folder, 'chat-sample-turnover.xlsx')
  writeFileSync(photo, sampleReceiptPng(null))
  const document = await PDFDocument.create()
  document.addPage()
  document.addPage()
  writeFileSync(pdf, await document.save())
  writeFileSync(sheet, await sampleTableFile())
  return { photo, pdf, sheet }
}
