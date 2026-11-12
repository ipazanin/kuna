import { PDFDocument, rgb } from 'pdf-lib'
import type { Color, PDFPage } from 'pdf-lib'

import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { ZERO, amountOf } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import { INK, embedDocumentFaces } from '../../documents/infrastructure/pdfFaces'
import type { DocumentFontFiles } from '../../documents/infrastructure/pdfFaces'
import { companyVatId } from '../../settings/domain/settings'
import type { InvoiceDocument } from '../domain/invoiceDocument'

const PAGE_WIDTH = 595.28
const PAGE_HEIGHT = 841.89
const LEFT = 51
const RIGHT = 502
const TEXT_LEFT = 52.6
const VALUE_LEFT = 257.4
const SIZE = 7.8
const LINE = 13.5
const SHADE = rgb(0.85, 0.85, 0.85)

/** The table's column edges, from # to the total price, as the template draws them. */
const COLUMNS = [LEFT, 80.5, 250.7, 290, 368.5, 434, RIGHT] as const
const HEADER_HEIGHT = 14.5
const ROW_HEIGHT = 28.5
const TOTALS_ROW = 13.1

/** A date as the template prints it, such as 21.09.2026. */
export function printedDate(date: CivilDate): string {
  const [year, month, day] = date.split('-')
  return `${day}.${month}.${year}.`
}

function printedAmount(amount: Money, document: InvoiceDocument): string {
  const number = new Intl.NumberFormat(document.numberLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amountOf(amount))
  return `${number} ${document.currency}`
}

function top(y: number): number {
  return PAGE_HEIGHT - y
}

function box(page: PDFPage, left: number, upper: number, right: number, lower: number, options: { fill?: Color; border?: number } = {}): void {
  page.drawRectangle({
    x: left,
    y: top(lower),
    width: right - left,
    height: lower - upper,
    ...(options.fill === undefined ? {} : { color: options.fill }),
    ...(options.border === undefined ? {} : { borderColor: INK, borderWidth: options.border }),
  })
}

function line(page: PDFPage, from: readonly [number, number], to: readonly [number, number], thickness: number, dotted = false): void {
  page.drawLine({ start: { x: from[0], y: top(from[1]) }, end: { x: to[0], y: top(to[1]) }, thickness, color: INK, ...(dotted ? { dashArray: [1, 1.5] } : {}) })
}

/** The invoice on one A4 page, laid out as the Sheet template the invoice generator exported. */
export async function renderInvoicePdf(invoice: InvoiceDocument, fonts: DocumentFontFiles): Promise<Uint8Array> {
  const document = await PDFDocument.create()
  document.setTitle(`Invoice ${invoice.number}`)
  document.setAuthor(invoice.issuer.name)
  document.setCreator('Kuna')
  document.setProducer('Kuna')
  const { regular, bold, italic } = await embedDocumentFaces(document, fonts)
  const page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  const { issuer, recipient } = invoice
  const vatId = companyVatId(issuer)

  const issuerLines = [
    issuer.address,
    issuer.country,
    vatId === '' ? '' : `VAT ID: ${vatId}`,
    issuer.phone === '' ? '' : `Mob: ${issuer.phone}`,
    issuer.mail === '' ? '' : `Mail: ${issuer.mail}`,
  ].filter((text) => text !== '')
  bold.draw(page, issuer.name, TEXT_LEFT, 58, SIZE)
  issuerLines.forEach((text, index) => regular.draw(page, text, TEXT_LEFT, 58 + LINE * (index + 1), SIZE))

  const recipientLines = [recipient.address, recipient.country, recipient.taxId === '' ? '' : `Tax ID: ${recipient.taxId}`].filter((text) => text !== '')
  const recipientTop = 133.5
  const recipientBottom = recipientTop + 6 + LINE * (recipientLines.length + 1) - 1.5
  box(page, 370.5, recipientTop, RIGHT, recipientBottom, { border: 1.2 })
  bold.draw(page, recipient.name, 374.5, recipientTop + 5.5, SIZE)
  recipientLines.forEach((text, index) => regular.draw(page, text, 374.5, recipientTop + 5.5 + LINE * (index + 1), SIZE))

  bold.drawCentred(page, `INVOICE NUMBER ${invoice.number}`, (LEFT + RIGHT) / 2, 232, 11)

  const details: [string, string][] = [
    ['Invoice place and date:', `${issuer.place}, ${printedDate(invoice.issued)}`],
    ...(issuer.issueTime === '' ? [] : [['Invoice issuing time:', issuer.issueTime] as [string, string]]),
    ['Delivery period:', `${printedDate(invoice.deliveryPeriod.from)} - ${printedDate(invoice.deliveryPeriod.to)}`],
    ['Due date:', printedDate(invoice.due)],
    ['Invoice prepared by:', issuer.signatory],
  ]
  details.forEach(([label, value], index) => {
    regular.draw(page, label, TEXT_LEFT, 260.5 + LINE * index, SIZE)
    regular.draw(page, value, VALUE_LEFT, 260.5 + LINE * index, SIZE)
  })

  const tableTop = 260.5 + LINE * details.length + 9.5
  const headerBottom = tableTop + HEADER_HEIGHT
  box(page, LEFT, tableTop, RIGHT, headerBottom, { fill: SHADE })
  const headings = ['#', 'Product/service description', 'Unit', 'Quantity', 'Price per unit', 'Total price']
  headings.forEach((heading, index) => bold.draw(page, heading, COLUMNS[index]! + 1.6, tableTop + 4.5, SIZE))

  const descriptionWidth = COLUMNS[2] - COLUMNS[1] - 3.2
  let rowTop = headerBottom
  const rowEdges: number[] = []
  invoice.lines.forEach((invoiceLine, index) => {
    const wrapped = regular.wrap(invoiceLine.description, descriptionWidth, SIZE)
    const height = Math.max(ROW_HEIGHT, wrapped.length * 11 + 12)
    const textTop = rowTop + (height - wrapped.length * 11) / 2
    regular.draw(page, `${index + 1}.`, COLUMNS[0] + 1.6, textTop, SIZE)
    wrapped.forEach((text, lineIndex) => regular.draw(page, text, COLUMNS[1] + 1.6, textTop + lineIndex * 11, SIZE))
    regular.draw(page, 'pcs', COLUMNS[2] + 1.6, textTop, SIZE)
    regular.drawRight(page, '1', COLUMNS[4] - 3, textTop, SIZE)
    regular.drawRight(page, printedAmount(invoiceLine.amount, invoice), COLUMNS[5] - 2, textTop, SIZE)
    regular.drawRight(page, printedAmount(invoiceLine.amount, invoice), COLUMNS[6] - 3, textTop, SIZE)
    rowTop += height
    rowEdges.push(rowTop)
  })
  const tableBottom = rowTop
  for (const x of COLUMNS.slice(1, -1)) {
    line(page, [x, tableTop], [x, headerBottom], 0.6)
    line(page, [x, headerBottom], [x, tableBottom], 0.6, true)
  }
  for (const edge of rowEdges.slice(0, -1)) {
    line(page, [LEFT, edge], [RIGHT, edge], 0.6, true)
  }
  line(page, [LEFT, headerBottom], [RIGHT, headerBottom], 0.6)
  box(page, LEFT, tableTop, RIGHT, tableBottom, { border: 1.2 })

  const totalsTop = tableBottom + 1.6
  const totals: [string, string][] = [
    ['Net amount', printedAmount(invoice.total, invoice)],
    ['VAT*', printedAmount(ZERO, invoice)],
    ['Total invoice amount', printedAmount(invoice.total, invoice)],
  ]
  const totalsBottom = totalsTop + TOTALS_ROW * totals.length
  box(page, COLUMNS[3], totalsTop + TOTALS_ROW * 2, RIGHT, totalsBottom, { fill: SHADE })
  totals.forEach(([label, value], index) => {
    const face = index === totals.length - 1 ? bold : regular
    const rowUpper = totalsTop + TOTALS_ROW * index
    face.draw(page, label, COLUMNS[3] + 1.6, rowUpper + 3.4, SIZE)
    face.drawRight(page, value, RIGHT - 3, rowUpper + 3.4, SIZE)
    if (index > 0) line(page, [COLUMNS[3], rowUpper], [RIGHT, rowUpper], 0.6)
  })
  line(page, [COLUMNS[5], totalsTop], [COLUMNS[5], totalsBottom], 0.6)
  box(page, COLUMNS[3], totalsTop, RIGHT, totalsBottom, { border: 1.2 })

  const noteTop = totalsBottom + 18
  regular.draw(page, `*${issuer.reverseChargeNote}`, TEXT_LEFT, noteTop, SIZE)

  const paymentTop = noteTop + 40.5
  regular.draw(page, 'Payment method: Bank transfer', TEXT_LEFT, paymentTop, SIZE)
  regular.draw(page, 'Transaction details', TEXT_LEFT, paymentTop + LINE, SIZE)
  italic.draw(page, `IBAN: ${issuer.iban}`, TEXT_LEFT, paymentTop + LINE * 2, SIZE)
  if (issuer.swift !== '') italic.draw(page, `SWIFT: ${issuer.swift}`, TEXT_LEFT, paymentTop + LINE * 3, SIZE)
  regular.draw(page, 'The invoice is issued in electronic form and is valid without a stamp or signature.', TEXT_LEFT, paymentTop + LINE * 5, SIZE)

  const signedBy = issuer.signatoryTitle === '' ? issuer.signatory : `${issuer.signatoryTitle} ${issuer.signatory}`
  regular.draw(page, `On behalf of the issuer, ${signedBy}`, COLUMNS[3] + 3.4, paymentTop + LINE * 9, SIZE)

  const footerTop = Math.max(676, paymentTop + LINE * 9 + 60)
  line(page, [LEFT, footerTop], [RIGHT, footerTop], 1.2, true)
  const footer = [
    [issuer.name, issuer.address, vatId === '' ? '' : `VAT ID: ${vatId}`, issuer.courtRegister === '' ? '' : `Court register ID number: ${issuer.courtRegister}`]
      .filter((part) => part !== '')
      .join('; '),
    issuer.shareCapital === '' ? '' : `Share capital: ${issuer.shareCapital};`,
    [`IBAN ${issuer.iban}`, issuer.bank === '' ? '' : `opened with ${issuer.bank}`, issuer.swift === '' ? '' : `(SWIFT: ${issuer.swift})`].filter((part) => part !== '').join(' '),
  ].filter((text) => text !== '')
  footer.forEach((text, index) => bold.drawCentred(page, text, (LEFT + RIGHT) / 2, footerTop + 6.5 + index * 9.8, 7))

  return document.save()
}
