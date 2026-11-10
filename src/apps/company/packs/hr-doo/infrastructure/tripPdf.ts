import { PDFDocument, rgb } from 'pdf-lib'
import type { PDFPage } from 'pdf-lib'

import { INK, embedDocumentFaces } from '../../../documents/infrastructure/pdfFaces'
import type { DocumentFaces, DocumentFontFiles, Face } from '../../../documents/infrastructure/pdfFaces'
import type { TripFile } from '../domain/trips/tripReading'
import type { TripSettlement } from '../domain/trips/tripSettlement'
import { cellText, tripDocument } from './tripDocument'
import type { TripCell, TripCellKind, TripColumn, TripDocumentContext, TripField, TripPart } from './tripDocument'
import { tripDocumentWords as words } from './tripDocumentWords'

const PAGE_WIDTH = 595.28
const PAGE_HEIGHT = 841.89
const LEFT = 51
const RIGHT = PAGE_WIDTH - 51
const TOP = 48
const BOTTOM = PAGE_HEIGHT - 56
const SIZE = 8.5
const LINE = 12
const PAD = 3
/** Where an adding field's label ends and its amount starts. */
const VALUE_LEFT = 300
/** A pair of label and value takes half the width, the label the first part of it. */
const PAIR_WIDTH = (RIGHT - LEFT) / 2
const PAIR_LABEL = 112
const PAIR_GAP = 12
const SHADE = rgb(0.9, 0.9, 0.9)

/** The width a column of each kind takes. A text column shares what is left. */
const FIXED_WIDTHS: Readonly<Record<Exclude<TripCellKind, 'text'>, number>> = { day: 62, euros: 72, count: 44 }

/** A page cursor that starts a new page when the next block does not fit. */
interface Sheet {
  readonly document: PDFDocument
  readonly faces: DocumentFaces
  page: PDFPage
  top: number
}

function newPage(sheet: Sheet): void {
  sheet.page = sheet.document.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  sheet.top = TOP
}

/** Moves to a new page unless `height` fits below the cursor. */
function room(sheet: Sheet, height: number): void {
  if (sheet.top + height > BOTTOM) newPage(sheet)
}

function rule(page: PDFPage, left: number, right: number, top: number, thickness = 0.5, dotted = false): void {
  page.drawLine({ start: { x: left, y: PAGE_HEIGHT - top }, end: { x: right, y: PAGE_HEIGHT - top }, thickness, color: INK, ...(dotted ? { dashArray: [1, 1.5] } : {}) })
}

/** A part's title, moved to a new page with the first `keep` points of the part, so a title never ends a page. */
function heading(sheet: Sheet, title: string, keep: number): void {
  room(sheet, LINE * 2 + keep)
  sheet.top += 4
  sheet.faces.bold.draw(sheet.page, title, LEFT, sheet.top, SIZE + 1.5)
  sheet.top += LINE + 2
  rule(sheet.page, LEFT, RIGHT, sheet.top - 3)
}

/** One field of a part that adds up, its amount on the right. */
function sumRow(sheet: Sheet, field: TripField): void {
  const face = field.strong === true ? sheet.faces.bold : sheet.faces.regular
  room(sheet, LINE)
  face.draw(sheet.page, field.label, LEFT, sheet.top, SIZE)
  if (field.cell === null) rule(sheet.page, VALUE_LEFT, RIGHT, sheet.top + LINE - 2, 0.5, true)
  else face.drawRight(sheet.page, cellText(field.cell), RIGHT, sheet.top, SIZE)
  sheet.top += LINE
}

/** Two fields side by side, each label beside its value, which wraps. A blank gets a dotted line to write on. */
function pairRow(sheet: Sheet, fields: readonly TripField[]): void {
  const valueWidth = PAIR_WIDTH - PAIR_LABEL - PAIR_GAP
  const wrapped = fields.map((field) => sheet.faces.regular.wrap(cellText(field.cell), valueWidth, SIZE))
  const lines = Math.max(...wrapped.map((field) => field.length))
  room(sheet, LINE * lines)
  fields.forEach((field, index) => {
    const left = LEFT + PAIR_WIDTH * index
    sheet.faces.bold.draw(sheet.page, field.label, left, sheet.top, SIZE - 0.5)
    wrapped[index]!.forEach((line, lineIndex) => sheet.faces.regular.draw(sheet.page, line, left + PAIR_LABEL, sheet.top + LINE * lineIndex, SIZE))
    if (field.cell === null) rule(sheet.page, left + PAIR_LABEL, left + PAIR_WIDTH - PAIR_GAP, sheet.top + LINE - 2, 0.5, true)
  })
  sheet.top += LINE * lines
}

function columnEdges(columns: readonly TripColumn[]): number[] {
  const fixed = columns.reduce((sum, column) => sum + (column.kind === 'text' ? 0 : FIXED_WIDTHS[column.kind]), 0)
  const texts = columns.filter((column) => column.kind === 'text').length
  const textWidth = texts === 0 ? 0 : (RIGHT - LEFT - fixed) / texts
  return columns.reduce((edges, column) => [...edges, edges[edges.length - 1]! + (column.kind === 'text' ? textWidth : FIXED_WIDTHS[column.kind])], [LEFT])
}

/** Draws a cell inside its column, right-aligned for numbers. */
function drawCell(face: Face, page: PDFPage, value: string, kind: TripCellKind, left: number, right: number, top: number): void {
  if (kind === 'euros' || kind === 'count') face.drawRight(page, value, right - PAD, top, SIZE)
  else face.draw(page, value, left + PAD, top, SIZE)
}

function headingsRow(sheet: Sheet, columns: readonly TripColumn[], edges: readonly number[]): void {
  sheet.page.drawRectangle({ x: LEFT, y: PAGE_HEIGHT - sheet.top - LINE - 2, width: RIGHT - LEFT, height: LINE + 2, color: SHADE })
  columns.forEach((column, index) => drawCell(sheet.faces.bold, sheet.page, column.heading, column.kind, edges[index]!, edges[index + 1]!, sheet.top + 3))
  sheet.top += LINE + 2
}

function tableRow(sheet: Sheet, columns: readonly TripColumn[], edges: readonly number[], cells: readonly TripCell[]): void {
  const wrapped = columns.map((column, index) => {
    const value = cellText(cells[index] ?? null)
    return column.kind === 'text' ? sheet.faces.regular.wrap(value, edges[index + 1]! - edges[index]! - PAD * 2, SIZE) : [value]
  })
  const height = Math.max(...wrapped.map((lines) => lines.length)) * LINE + 2
  if (sheet.top + height > BOTTOM) {
    newPage(sheet)
    headingsRow(sheet, columns, edges)
  }
  wrapped.forEach((lines, index) =>
    lines.forEach((line, lineIndex) => drawCell(sheet.faces.regular, sheet.page, line, columns[index]!.kind, edges[index]!, edges[index + 1]!, sheet.top + 2 + LINE * lineIndex)),
  )
  sheet.top += height
  rule(sheet.page, LEFT, RIGHT, sheet.top, 0.3, true)
}

function tableTotal(sheet: Sheet, edges: readonly number[], total: TripField): void {
  room(sheet, LINE + 2)
  sheet.faces.bold.draw(sheet.page, total.label, LEFT + PAD, sheet.top + 2, SIZE)
  drawCell(sheet.faces.bold, sheet.page, cellText(total.cell), total.cell?.kind ?? 'text', edges[edges.length - 2]!, edges[edges.length - 1]!, sheet.top + 2)
  sheet.top += LINE + 2
}

function signatures(sheet: Sheet, place: string, day: string, signers: readonly string[]): void {
  room(sheet, LINE * 7)
  sheet.top += LINE
  sheet.faces.regular.draw(sheet.page, `${words.signatures.placeAndDate}: ${place}, ${day}`, LEFT, sheet.top, SIZE)
  sheet.top += LINE * 4
  const width = (RIGHT - LEFT) / signers.length
  signers.forEach((signer, index) => {
    const left = LEFT + width * index
    rule(sheet.page, left + 8, left + width - 8, sheet.top)
    sheet.faces.regular.drawCentred(sheet.page, signer, left + width / 2, sheet.top + 4, SIZE)
  })
  sheet.top += LINE * 2
}

function drawPart(sheet: Sheet, part: TripPart): void {
  if (part.kind === 'signatures') {
    signatures(sheet, part.place, cellText({ kind: 'day', day: part.day }), part.signers)
    return
  }
  heading(sheet, part.title, part.kind === 'table' ? (LINE + 2) * 2 : LINE * 2)
  if (part.kind === 'fields') {
    if (part.adds) part.fields.forEach((field) => sumRow(sheet, field))
    else for (let index = 0; index < part.fields.length; index += 2) pairRow(sheet, part.fields.slice(index, index + 2))
  } else if (part.kind === 'table') {
    const edges = columnEdges(part.columns)
    headingsRow(sheet, part.columns, edges)
    part.rows.forEach((cells) => tableRow(sheet, part.columns, edges, cells))
    if (part.total !== null) tableTotal(sheet, edges, part.total)
  } else if (part.text.trim() === '') {
    for (let index = 1; index <= 4; index += 1) rule(sheet.page, LEFT, RIGHT, sheet.top + LINE * index, 0.5, true)
    sheet.top += LINE * 5
  } else {
    sheet.faces.regular.wrap(part.text, RIGHT - LEFT, SIZE).forEach((line) => {
      room(sheet, LINE)
      sheet.faces.regular.draw(sheet.page, line, LEFT, sheet.top, SIZE)
      sheet.top += LINE
    })
  }
}

/**
 * The travel order to sign, in Croatian on A4: the order, the settlement as far as it is filled, the
 * report and the signature lines. A long trip runs onto further pages, each numbered at its foot.
 */
export async function tripPdf(file: TripFile, settlement: TripSettlement, context: TripDocumentContext, fonts: DocumentFontFiles): Promise<Uint8Array> {
  const trip = tripDocument(file, settlement, context)
  const document = await PDFDocument.create()
  document.setTitle(trip.title)
  document.setAuthor(trip.issuer.name)
  document.setCreator('Kuna')
  document.setProducer('Kuna')
  const faces = await embedDocumentFaces(document, fonts)
  const sheet: Sheet = { document, faces, page: document.addPage([PAGE_WIDTH, PAGE_HEIGHT]), top: TOP }

  const issuerLines = [trip.issuer.address, trip.issuer.oib === '' ? '' : words.oib(trip.issuer.oib)].filter((line) => line !== '')
  faces.bold.draw(sheet.page, trip.issuer.name, LEFT, sheet.top, SIZE + 1)
  issuerLines.forEach((line, index) => faces.regular.draw(sheet.page, line, LEFT, sheet.top + LINE * (index + 1), SIZE))
  sheet.top += LINE * (issuerLines.length + 1.5)
  faces.bold.drawCentred(sheet.page, trip.title, PAGE_WIDTH / 2, sheet.top, 13)
  sheet.top += LINE * 1.5

  trip.parts.forEach((part) => drawPart(sheet, part))

  const pages = document.getPages()
  pages.forEach((page, index) => faces.regular.drawCentred(page, words.page(index + 1, pages.length), PAGE_WIDTH / 2, PAGE_HEIGHT - 36, SIZE - 1))
  return document.save()
}
