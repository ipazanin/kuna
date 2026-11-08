/**
 * Writes the made-up files the chat's attach checks pick through the file input, as a person picks them: a receipt photo,
 * a PDF of two pages, a turnover sheet and a plain text note, a kind Kuna does not take.
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
  const note = join(folder, 'chat-sample-note.txt')
  writeFileSync(photo, sampleReceiptPng(null))
  const document = await PDFDocument.create()
  document.addPage()
  document.addPage()
  writeFileSync(pdf, await document.save())
  writeFileSync(sheet, await sampleTableFile())
  writeFileSync(note, 'Pay the plumber on Friday.')
  return { photo, pdf, sheet, note }
}
