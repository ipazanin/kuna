import { readFirstSheet } from '../../../shared/xlsx/sheetGrids'
import type { LoadedImportFile } from '../application/importStatements'
import type { CellGrid } from '../domain/tabularStatement'

/**
 * Reads the bytes of a statement file. XML is parsed as a camt document. Anything else goes to
 * SheetJS, loaded only now, which reads xlsx, xls, ods and csv, a csv's cells kept as their text
 * so a decimal comma reaches the profile as written. Throws a message for the person when the file
 * is neither.
 */
export async function loadImportFile(fileName: string, bytes: ArrayBuffer): Promise<LoadedImportFile> {
  const text = new TextDecoder('utf-8').decode(bytes.slice(0, 512)).replace(/^﻿/, '').trimStart()
  if (text.startsWith('<')) {
    const document = new DOMParser().parseFromString(new TextDecoder('utf-8').decode(bytes), 'application/xml')
    if (document.getElementsByTagName('parsererror').length > 0) {
      throw new Error(`${fileName} is not well-formed XML, so it cannot be read as a camt.053 statement.`)
    }
    return { kind: 'camt', fileName, document }
  }
  let grid: CellGrid
  try {
    grid = await readFirstSheet(/\.(csv|txt)$/i.test(fileName) ? csvText(bytes) : bytes)
  } catch (failure) {
    throw new Error(`${fileName} could not be read as a spreadsheet. Save it as .xlsx or .csv and try again.`, { cause: failure })
  }
  return { kind: 'table', fileName, fileHash: await sha256Hex(bytes), grid }
}

/** A csv's text: UTF-8 when it decodes as such, else Windows-1250, which Croatian banks' older exports use. */
function csvText(bytes: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return new TextDecoder('windows-1250').decode(bytes)
  }
}

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}
