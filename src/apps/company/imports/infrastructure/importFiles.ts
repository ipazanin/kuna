import { sha256Hex } from '../../../../shared/files/sha256'
import type { LoadedImportFile } from '../application/importStatements'
import type { TableCells } from '../domain/tabularStatement'
import { readRecipeDocument, tableFileCells } from '../../../../shared/recipes/infrastructure/recipeFile'
import { CAMT_RECIPE } from '../domain/camtRecipe'
import { words } from './words'

/** An XML statement file's text, read by the camt recipe. Throws a message for the person when it is not XML. */
export function camtFile(fileName: string, text: string): LoadedImportFile {
  const document = new DOMParser().parseFromString(text, 'application/xml')
  if (document.getElementsByTagName('parsererror').length > 0) {
    throw new Error(words.notXml(fileName))
  }
  return { kind: 'camt', fileName, reading: readRecipeDocument(CAMT_RECIPE, document) }
}

/**
 * Reads the bytes of a statement file. XML is read by the camt recipe. Anything else goes to
 * SheetJS, loaded only now, which reads xlsx, xls, ods and csv as text, a csv's cells as written
 * so a decimal comma reaches the recipe as written. Throws a message for the person when the file
 * is neither.
 */
export async function loadImportFile(fileName: string, bytes: ArrayBuffer): Promise<LoadedImportFile> {
  const text = new TextDecoder('utf-8').decode(bytes.slice(0, 512)).replace(/^﻿/, '').trimStart()
  if (text.startsWith('<')) {
    return camtFile(fileName, new TextDecoder('utf-8').decode(bytes))
  }
  let cells: TableCells
  try {
    cells = await tableFileCells(fileName, bytes)
  } catch (failure) {
    throw new Error(words.notSpreadsheet(fileName), { cause: failure })
  }
  return { kind: 'table', fileName, fileHash: await sha256Hex(bytes), cells }
}
