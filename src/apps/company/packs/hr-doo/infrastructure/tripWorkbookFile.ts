import type { CellObject } from 'xlsx'

import { dayCell, eurosCell } from '../../../../../shared/xlsx/cells'
import { sheetJs } from '../../../../../shared/xlsx/sheetGrids'
import type { TripFile } from '../domain/trips/tripReading'
import type { TripSettlement } from '../domain/trips/tripSettlement'
import { tripDocument } from './tripDocument'
import type { TripCell, TripDocumentContext, TripField, TripPart } from './tripDocument'
import { tripDocumentWords as words } from './tripDocumentWords'

/** A text, a whole number, a formatted cell, or a blank. */
type Cell = string | number | CellObject | undefined

const SHEET_NAME = 'Putni nalog'

function cellOf(cell: TripCell): Cell {
  if (cell === null) return undefined
  if (cell.kind === 'text') return cell.text
  if (cell.kind === 'day') return dayCell(cell.day)
  if (cell.kind === 'euros') return eurosCell(cell.amount)
  return cell.count
}

function fieldRow(field: TripField): Cell[] {
  return [field.label, cellOf(field.cell)]
}

/** A part's rows, a table's total under its last column. */
function partRows(part: TripPart): Cell[][] {
  if (part.kind === 'fields') return [[part.title], ...part.fields.map(fieldRow)]
  if (part.kind === 'text') return [[part.title], [part.text]]
  if (part.kind === 'signatures') return [[words.signatures.placeAndDate, part.place, dayCell(part.day)], ...part.signers.map((signer) => [signer])]
  const width = part.columns.length
  const total: Cell[][] = part.total === null ? [] : [[part.total.label, ...Array<Cell>(width - 2).fill(undefined), cellOf(part.total.cell)]]
  return [[part.title], part.columns.map((column) => column.heading), ...part.rows.map((cells) => cells.map(cellOf)), ...total]
}

/**
 * The travel order as an editable xlsx of one sheet, the same parts as the PDF, each part a block of
 * rows with a blank row between. Days are date cells and euros number cells. SheetJS loads only now.
 */
export async function tripWorkbookFile(file: TripFile, settlement: TripSettlement, context: TripDocumentContext): Promise<Uint8Array<ArrayBuffer>> {
  const XLSX = await sheetJs()
  const trip = tripDocument(file, settlement, context)
  const header: Cell[][] = [[trip.issuer.name], [trip.issuer.address], [trip.issuer.oib === '' ? undefined : words.oib(trip.issuer.oib)], [], [trip.title]]
  const rows = [...header, ...trip.parts.flatMap((part) => [[], ...partRows(part)])]
  const sheet = XLSX.utils.aoa_to_sheet(rows)
  sheet['!cols'] = [{ wch: 34 }, { wch: 28 }, { wch: 22 }, { wch: 22 }, { wch: 14 }, { wch: 14 }]
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, SHEET_NAME)
  return new Uint8Array(XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer)
}
