/**
 * Writes the made-up files the chat's attach checks pick through the file input, as a person picks them: a receipt photo,
 * a PDF of two pages, a turnover sheet, a Word note, a kind Kuna does not take, an XML file that declares its own entities,
 * which Kuna does not open, and a broker's CSV of two deposits in a format Kuna does not read, which goes as cells.
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
  const note = join(folder, 'chat-sample-note.docx')
  writeFileSync(photo, sampleReceiptPng(null))
  const document = await PDFDocument.create()
  document.addPage()
  document.addPage()
  writeFileSync(pdf, await document.save())
  writeFileSync(sheet, await sampleTableFile())
  writeFileSync(note, 'Pay the plumber on Friday.')
  const unsafe = join(folder, 'chat-sample-entities.xml')
  writeFileSync(unsafe, '<?xml version="1.0"?><!DOCTYPE report [<!ENTITY row "made-up">]><report><line>&row;</line></report>')
  const deposits = join(folder, 'chat-sample-deposits.csv')
  const daysAgo = (days) => new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)
  writeFileSync(deposits, `Booked,Kind,Amount,Currency\n${daysAgo(9)},Deposit,500.00,EUR\n${daysAgo(6)},Deposit,300.00,EUR\n`)
  return { photo, pdf, sheet, note, unsafe, deposits }
}
