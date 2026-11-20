import type { CellObject, WorkSheet } from 'xlsx'

import { civilDateFromSerial } from '../calendar/civilDate'
import { decimalOfNumber, decimalText } from '../money/decimal'
import { roundHalfAwayFromZero } from '../money/money'

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

/** The cells from A1, so row numbers match the sheet's even when its used range starts lower. Raw cells are values, the others the text the sheet shows. */
function gridOf(XLSX: typeof import('xlsx'), sheet: WorkSheet, raw = true): (SheetCell | undefined)[][] {
  const reference = sheet['!ref']
  if (reference === undefined) {
    return []
  }
  const range = XLSX.utils.decode_range(reference)
  range.s.r = 0
  range.s.c = 0
  return XLSX.utils.sheet_to_json<(SheetCell | undefined)[]>(sheet, { header: 1, raw, blankrows: true, range })
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

/** How a day reads where the sheet's format leaves it unclear: the short date each reader's Excel shows its own way, which SheetJS writes month first. */
const PLAIN_DAY = 'yyyy-mm-dd'

/**
 * Every tab of an xlsx, xls or ods file, each cell as the sheet shows it, so a date reads as its format writes it rather than as a
 * serial number. The short date, and a day format SheetJS cannot write, such as the `dd.mm.yyyy` of Croatian exports, read as `yyyy-mm-dd`.
 */
export async function readEveryTabAsShown(bytes: ArrayBuffer | Uint8Array): Promise<SheetTab[]> {
  const XLSX = await sheetJs()
  const book = XLSX.read(bytes, { type: 'array', cellNF: true, dateNF: PLAIN_DAY })
  return book.SheetNames.flatMap((name) => {
    const sheet = book.Sheets[name]
    return sheet === undefined ? [] : [{ name, grid: gridOf(XLSX, withDaysWritten(XLSX, sheet), false) }]
  })
}

/** The sheet with each day cell SheetJS could not write as text written as a plain day, with its time when it has one. */
function withDaysWritten(XLSX: typeof import('xlsx'), sheet: WorkSheet): WorkSheet {
  for (const [address, cell] of Object.entries(sheet)) {
    if (address.startsWith('!') || cell.t !== 'n' || cell.w !== undefined || typeof cell.z !== 'string' || !XLSX.SSF.is_date(cell.z)) continue
    cell.w = XLSX.SSF.format(Number.isInteger(cell.v) ? PLAIN_DAY : `${PLAIN_DAY} hh:mm`, cell.v)
  }
  return sheet
}

/**
 * The first sheet of a file SheetJS reads, xlsx, xls or ods as bytes, or a csv's text, whose cells
 * stay as written so `1.234,56` is not read as a number. The cells start from A1.
 */
export async function readFirstSheet(contents: ArrayBuffer | string): Promise<(SheetCell | undefined)[][]> {
  const XLSX = await sheetJs()
  const book = typeof contents === 'string' ? XLSX.read(contents, { type: 'string', raw: true }) : XLSX.read(contents, { type: 'array', cellText: false })
  const sheet = book.Sheets[book.SheetNames[0] ?? '']
  return sheet === undefined ? [] : gridOf(XLSX, sheet)
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

function cellText(XLSX: typeof import('xlsx'), cell: CellObject | undefined): string {
  if (cell === undefined || cell.v === undefined) return ''
  if (typeof cell.v === 'number') {
    if (typeof cell.z === 'string' && XLSX.SSF.is_date(cell.z)) return dayTimeText(cell.v)
    const exact = decimalOfNumber(cell.v, 12)
    return exact === null ? '' : decimalText(exact)
  }
  return String(cell.v)
}

/**
 * The first sheet of a file as text for a recipe, from A1: a csv's cells as written, so `1.234,56` stays text, and an xlsx,
 * xls or ods file's cells by their kind. A day cell reads as `yyyy-MM-dd HH:mm:ss`, or `yyyy-MM-dd` for a whole day, and
 * any other number as its full value in decimal text, such as `-12.5`.
 */
export async function readFirstSheetCells(contents: ArrayBuffer | string): Promise<string[][]> {
  const XLSX = await sheetJs()
  const book = typeof contents === 'string' ? XLSX.read(contents, { type: 'string', raw: true }) : XLSX.read(contents, { type: 'array', cellText: false, cellNF: true })
  const sheet = book.Sheets[book.SheetNames[0] ?? '']
  const reference = sheet?.['!ref']
  if (sheet === undefined || reference === undefined) return []
  const { e: end } = XLSX.utils.decode_range(reference)
  return Array.from({ length: end.r + 1 }, (_, row) => Array.from({ length: end.c + 1 }, (_, column) => cellText(XLSX, sheet[XLSX.utils.encode_cell({ r: row, c: column })])))
}
