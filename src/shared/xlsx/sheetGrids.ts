import type { CellObject, WorkSheet } from 'xlsx'

import { civilDateFromSerial } from '../calendar/civilDate'
import { decimalOfNumber, decimalText } from '../money/decimal'
import { roundHalfAwayFromZero } from '../money/money'
import type { TableCells } from '../recipes/domain/tableRows'

export const XLSX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

/** A cell as SheetJS reads it: text, a number, or true and false. */
type SheetCell = string | number | boolean

/** A tab of a spreadsheet file by its name, with its cells from A1. */
interface SheetTab {
  readonly name: string
  readonly grid: (SheetCell | undefined)[][]
}

/**
 * SheetJS is loaded on the first import or export, never with the app, because it is larger than
 * everything else on the first screen together.
 */
export async function sheetJs(): Promise<typeof import('xlsx')> {
  return import('xlsx')
}

/** The cells from A1 as values, so row numbers match the sheet's even when its used range starts lower. */
function gridOf(XLSX: typeof import('xlsx'), sheet: WorkSheet): (SheetCell | undefined)[][] {
  const reference = sheet['!ref']
  if (reference === undefined) {
    return []
  }
  const range = XLSX.utils.decode_range(reference)
  range.s.r = 0
  range.s.c = 0
  return XLSX.utils.sheet_to_json<(SheetCell | undefined)[]>(sheet, { header: 1, raw: true, blankrows: true, range })
}

/** Every tab of an xlsx, xls or ods file, in the file's order. */
export async function readEveryTab(bytes: ArrayBuffer | Uint8Array): Promise<SheetTab[]> {
  const XLSX = await sheetJs()
  const book = XLSX.read(bytes, { type: 'array', cellText: false })
  return book.SheetNames.flatMap((name) => {
    const sheet = book.Sheets[name]
    return sheet === undefined ? [] : [{ name, grid: gridOf(XLSX, sheet) }]
  })
}

const SECONDS_PER_DAY = 86_400

/** A day cell's serial number as `yyyy-MM-dd HH:mm:ss` to the nearest second, or `yyyy-MM-dd` for a day with no time. */
function dayTimeText(serial: number): string {
  const seconds = roundHalfAwayFromZero(serial * SECONDS_PER_DAY)
  const day = civilDateFromSerial(Math.floor(seconds / SECONDS_PER_DAY))
  const inDay = seconds % SECONDS_PER_DAY
  if (inDay === 0) return day
  const [hours, minutes, rest] = [Math.floor(inDay / 3600), Math.floor(inDay / 60) % 60, inDay % 60].map((part) => String(part).padStart(2, '0'))
  return `${day} ${hours}:${minutes}:${rest}`
}

function isDayCell(XLSX: typeof import('xlsx'), cell: CellObject): boolean {
  return typeof cell.z === 'string' && XLSX.SSF.is_date(cell.z)
}

/** Whether the cell holds a number that is no day. */
function isNumberCell(XLSX: typeof import('xlsx'), cell: CellObject | undefined): boolean {
  return cell !== undefined && typeof cell.v === 'number' && !isDayCell(XLSX, cell)
}

function cellText(XLSX: typeof import('xlsx'), cell: CellObject | undefined): string {
  if (cell === undefined || cell.v === undefined) return ''
  if (typeof cell.v === 'number') {
    if (isDayCell(XLSX, cell)) return dayTimeText(cell.v)
    const exact = decimalOfNumber(cell.v, 12)
    return exact === null ? '' : decimalText(exact)
  }
  return String(cell.v)
}

/** A sheet's cells from A1, each by its kind as `readFirstSheetCells` says. */
function sheetCells(XLSX: typeof import('xlsx'), sheet: WorkSheet | undefined): TableCells {
  const reference = sheet?.['!ref']
  if (sheet === undefined || reference === undefined) return { texts: [], numbers: [] }
  const { e: end } = XLSX.utils.decode_range(reference)
  const cells = Array.from({ length: end.r + 1 }, (_, row) => Array.from({ length: end.c + 1 }, (_, column) => sheet[XLSX.utils.encode_cell({ r: row, c: column })]))
  return {
    texts: cells.map((row) => row.map((cell) => cellText(XLSX, cell))),
    numbers: cells.map((row) => row.flatMap((cell, column) => (isNumberCell(XLSX, cell) ? [column] : []))),
  }
}

function bookOfCells(XLSX: typeof import('xlsx'), contents: ArrayBuffer | Uint8Array | string): import('xlsx').WorkBook {
  return typeof contents === 'string' ? XLSX.read(contents, { type: 'string', raw: true }) : XLSX.read(contents, { type: 'array', cellText: false, cellNF: true })
}

/**
 * The first sheet of a file for a recipe, from A1: a csv's cells as written, so `1.234,56` stays text, and an xlsx, xls or
 * ods file's cells by their kind. A day cell reads as `yyyy-MM-dd HH:mm:ss`, or `yyyy-MM-dd` for a whole day, and any other
 * number as its full value in decimal text, such as `-12.5`, marked as a number cell.
 */
export async function readFirstSheetCells(contents: ArrayBuffer | Uint8Array | string): Promise<TableCells> {
  const XLSX = await sheetJs()
  const book = bookOfCells(XLSX, contents)
  return sheetCells(XLSX, book.Sheets[book.SheetNames[0] ?? ''])
}

/** Every tab of an xlsx, xls or ods file by its name, in the file's order, each cell's text read as `readFirstSheetCells` reads the first tab's. */
export async function readEveryTabCells(bytes: ArrayBuffer | Uint8Array): Promise<{ readonly name: string; readonly cells: readonly (readonly string[])[] }[]> {
  const XLSX = await sheetJs()
  const book = bookOfCells(XLSX, bytes)
  return book.SheetNames.map((name) => ({ name, cells: sheetCells(XLSX, book.Sheets[name]).texts }))
}
