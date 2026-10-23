import type { WorkSheet } from 'xlsx'

/** A cell as SheetJS reads it: text, a number, or true and false. */
export type SheetCell = string | number | boolean

/**
 * SheetJS is loaded on the first import or export, never with the app, because it is larger than
 * everything else on the first screen together.
 */
export async function sheetJs(): Promise<typeof import('xlsx')> {
  return import('xlsx')
}

/** The cells from A1, so row numbers match the sheet's even when its used range starts lower. */
export function gridOf(XLSX: typeof import('xlsx'), sheet: WorkSheet): (SheetCell | undefined)[][] {
  const reference = sheet['!ref']
  if (reference === undefined) {
    return []
  }
  const range = XLSX.utils.decode_range(reference)
  range.s.r = 0
  range.s.c = 0
  return XLSX.utils.sheet_to_json<(SheetCell | undefined)[]>(sheet, { header: 1, raw: true, blankrows: true, range })
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
