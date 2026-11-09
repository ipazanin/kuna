import { sha256Hex } from '../../../../shared/files/sha256'
import { decodedText } from '../../../../shared/text/decodedText'
import { readFirstSheet } from '../../../../shared/xlsx/sheetGrids'
import type { LoadedImportFile } from '../application/importStatements'
import type { CellGrid } from '../domain/tabularStatement'
import { words } from './words'

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
      throw new Error(words.notXml(fileName))
    }
    return { kind: 'camt', fileName, document }
  }
  let grid: CellGrid
  try {
    grid = await readFirstSheet(/\.(csv|txt)$/i.test(fileName) ? decodedText(bytes) : bytes)
  } catch (failure) {
    throw new Error(words.notSpreadsheet(fileName), { cause: failure })
  }
  return { kind: 'table', fileName, fileHash: await sha256Hex(bytes), grid }
}
