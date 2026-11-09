import { decodedText } from '../../text/decodedText'
import { readEveryTabAsShown, readFirstSheet } from '../../xlsx/sheetGrids'
import type { AttachmentKind, CellSheet } from '../domain/chatAttachments'
import { MOST_INFLATED_BYTES } from '../domain/chatAttachments'
import { cleanCell } from '../domain/fileCells'

type SheetCell = string | number | boolean | undefined

const END_OF_DIRECTORY = 0x06054b50
const DIRECTORY_ENTRY = 0x02014b50
/** A zip64 size, which Kuna does not read, so such a sheet counts as too large. */
const ZIP64 = 0xffffffff

/**
 * Whether a zip, such as an xlsx or an ods, says its files inflate past what Kuna reads, or cannot say. Read from its
 * central directory before anything is inflated. A file that is no zip, such as an old xls, passes.
 */
function inflatesTooFar(bytes: Uint8Array): boolean {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let end = -1
  for (let at = bytes.length - 22; at >= Math.max(0, bytes.length - 22 - 65_535); at -= 1) {
    if (view.getUint32(at, true) === END_OF_DIRECTORY) {
      end = at
      break
    }
  }
  if (end === -1) return bytes[0] === 0x50 && bytes[1] === 0x4b
  const entries = view.getUint16(end + 10, true)
  let at = view.getUint32(end + 16, true)
  let inflated = 0
  for (let entry = 0; entry < entries; entry += 1) {
    if (at + 46 > bytes.length || view.getUint32(at, true) !== DIRECTORY_ENTRY) return true
    const size = view.getUint32(at + 24, true)
    if (size === ZIP64) return true
    inflated += size
    at += 46 + view.getUint16(at + 28, true) + view.getUint16(at + 30, true) + view.getUint16(at + 32, true)
  }
  return inflated > MOST_INFLATED_BYTES
}

/** Whether XML declares entities of its own, which can expand a small file into gigabytes. No bank or broker file needs them. */
function declaresEntities(text: string): boolean {
  return /<!DOCTYPE[^>]*\[|<!ENTITY/i.test(text)
}

/** Whether a file of this kind is one no reader may open: a sheet that inflates too far, or XML that declares entities. Checked before any reader, Kuna's own included, parses it. */
export function unsafeToRead(kind: AttachmentKind, bytes: Uint8Array): boolean {
  if (kind === 'sheet') return inflatesTooFar(bytes)
  if (kind === 'xml') return declaresEntities(decodedText(bytes))
  return false
}

function textRows(grid: readonly (readonly SheetCell[])[]): string[][] {
  return grid.map((row) => {
    const cells = Array.from(row, (cell) => cleanCell(cell === undefined ? '' : String(cell)))
    while (cells.length > 0 && cells.at(-1) === '') cells.pop()
    return cells
  })
}

type JsonValue = string | number | boolean | null | readonly JsonValue[] | { readonly [key: string]: JsonValue }

function isRecord(value: JsonValue): value is { readonly [key: string]: JsonValue } {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Each array of objects as a sheet named by its path, its keys the header, and a sheet of `path, value` rows for every other leaf. */
function jsonSheets(root: JsonValue): CellSheet[] {
  const sheets: CellSheet[] = []
  const leaves: string[][] = []
  const walk = (value: JsonValue, path: string): void => {
    if (Array.isArray(value)) {
      const records = value.filter(isRecord)
      if (records.length > 0) {
        const columns = [...new Set(records.flatMap((record) => Object.keys(record).filter((key) => !isNested(record[key]!))))]
        sheets.push({ name: cleanCell(path), layout: 'table', rows: [columns.map(cleanCell), ...records.map((record) => columns.map((key) => cellOfJson(record[key])))] })
      }
      value.forEach((element, at) => {
        if (!isRecord(element)) return walk(element, `${path}/${at}`)
        for (const [key, nested] of Object.entries(element)) if (isNested(nested)) walk(nested, `${path}/${key}`)
      })
    } else if (isRecord(value)) {
      Object.entries(value).forEach(([key, nested]) => walk(nested, path === '' ? key : `${path}/${key}`))
    } else {
      leaves.push([cleanCell(path), cellOfJson(value)])
    }
  }
  walk(root, '')
  return withPaths(sheets, leaves)
}

function isNested(value: JsonValue): boolean {
  return typeof value === 'object' && value !== null
}

function cellOfJson(value: JsonValue | undefined): string {
  return value === undefined || value === null || isNested(value) ? '' : cleanCell(String(value))
}

/** The attributes and the texts of the children with no children of their own, by name. */
function fieldsOf(element: Element): Map<string, string> {
  const fields = new Map<string, string>()
  for (const attribute of Array.from(element.attributes)) fields.set(`@${attribute.localName}`, attribute.value)
  for (const child of Array.from(element.children)) {
    if (child.children.length === 0) fields.set(child.localName, child.textContent ?? '')
  }
  return fields
}

/** The sheets, then the values that repeat nowhere as one sheet of `path, value` rows. */
function withPaths(sheets: readonly CellSheet[], leaves: readonly string[][]): CellSheet[] {
  return leaves.length > 0 ? [...sheets, { name: sheets.length === 0 ? null : 'values', layout: 'paths', rows: leaves }] : [...sheets]
}

/**
 * Each element that repeats under one path as a row of a sheet named by the path, its attributes and leaf children the
 * columns. An element inside a repeated one gets a column with that one's row, so a counterparty nested in an entry
 * stays joined to the entry's amount. Every other leaf is a `path, value` row.
 */
function xmlSheets(document: Document): CellSheet[] {
  const byPath = new Map<string, Element[]>()
  const pathOfElement = new Map<Element, string>()
  const placeOfElement = new Map<Element, number>()
  for (const element of Array.from(document.getElementsByTagName('*'))) {
    const parentPath = element.parentElement === null ? null : pathOfElement.get(element.parentElement)
    const path = parentPath === null || parentPath === undefined ? element.localName : `${parentPath}/${element.localName}`
    pathOfElement.set(element, path)
    const elements = byPath.get(path)
    placeOfElement.set(element, elements?.length ?? 0)
    if (elements === undefined) byPath.set(path, [element])
    else elements.push(element)
  }
  const fieldsByPath = new Map([...byPath].map(([path, elements]) => [path, elements.map(fieldsOf)] as const))
  const hasSheet = (path: string): boolean => {
    const rows = fieldsByPath.get(path) ?? []
    return rows.length > 1 && rows.some((fields) => fields.size > 0)
  }
  /** The nearest repeated element with a sheet of its own that an element sits in, with its row in that sheet, the header being row 1. */
  const enclosingRow = (element: Element): { readonly path: string; readonly row: number } | null => {
    for (let at = element.parentElement; at !== null; at = at.parentElement) {
      const path = pathOfElement.get(at)!
      if (hasSheet(path)) return { path, row: placeOfElement.get(at)! + 2 }
    }
    return null
  }
  const sheets: CellSheet[] = []
  const leaves: string[][] = []
  for (const [path, elements] of byPath) {
    const rows = fieldsByPath.get(path)!
    if (hasSheet(path)) {
      const enclosing = elements.map(enclosingRow)
      const within = enclosing[0]?.path ?? null
      const columns = [...new Set(rows.flatMap((fields) => [...fields.keys()]))]
      const header = within === null ? columns : [`row of ${within}`, ...columns]
      const cells = rows.map((fields, at) => {
        const own = columns.map((column) => cleanCell(fields.get(column) ?? ''))
        return within === null ? own : [String(enclosing[at]?.row ?? ''), ...own]
      })
      sheets.push({ name: cleanCell(path), layout: 'table', rows: [header.map(cleanCell), ...cells] })
    } else if (elements.length === 1) {
      const [element] = elements as [Element]
      for (const attribute of Array.from(element.attributes)) leaves.push([cleanCell(`${path}/@${attribute.localName}`), cleanCell(attribute.value)])
      if (element.children.length === 0 && (element.textContent ?? '').trim() !== '') leaves.push([cleanCell(path), cleanCell(element.textContent ?? '')])
    }
  }
  return withPaths(sheets, leaves)
}

/**
 * The cells of a file Kuna does not read itself, on this device, every cell as cleaned text: each tab of a sheet with
 * formulas as their values, a CSV as written, XML and JSON flattened to rows, and any other text as one line a row.
 * Throws for a file that does not read as its kind.
 */
export async function cellSheetsOf(kind: AttachmentKind, bytes: Uint8Array): Promise<readonly CellSheet[]> {
  switch (kind) {
    case 'sheet':
      return (await readEveryTabAsShown(bytes)).map((tab) => ({ name: cleanCell(tab.name), layout: 'table', rows: textRows(tab.grid) }))
    case 'csv':
      return [{ name: null, layout: 'table', rows: textRows(await readFirstSheet(decodedText(bytes))) }]
    case 'json':
      return jsonSheets(JSON.parse(decodedText(bytes)) as JsonValue)
    case 'xml': {
      const document = new DOMParser().parseFromString(decodedText(bytes), 'application/xml')
      if (document.getElementsByTagName('parsererror').length > 0) throw new Error('not XML')
      return xmlSheets(document)
    }
    case 'text': {
      if (bytes.includes(0)) throw new Error('not text')
      const lines = decodedText(bytes).split(/\r?\n/)
      if (lines.at(-1) === '') lines.pop()
      return [{ name: null, layout: 'lines', rows: lines.map((line) => [cleanCell(line)]) }]
    }
    default:
      throw new Error('not a file of cells')
  }
}
