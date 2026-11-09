import type { PDFDocument } from 'pdf-lib'

import type { ReadRange } from '../domain/chatAttachments'

/** Why a PDF cannot be read: a password, or a structure `pdf-lib` refuses, such as a page tree that holds itself. */
type PdfRefusal = { readonly refused: 'encrypted' | 'unreadable' }

/** A PDF's page count, or why it cannot be read. */
export type PdfReading = { readonly pages: number } | PdfRefusal

/** `pdf-lib` is loaded with the first PDF, never with the chat. */
async function pdfLib(): Promise<typeof import('pdf-lib')> {
  return import('pdf-lib')
}

/**
 * The PDF with its pages counted, or why not. It is loaded with encryption ignored and then refused by its flag, since
 * `pdf-lib`'s own error for it is not an instance of its class once compiled.
 */
async function loaded(bytes: Uint8Array): Promise<{ readonly document: PDFDocument; readonly pages: number } | PdfRefusal> {
  const { PDFDocument } = await pdfLib()
  try {
    const document = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false })
    if (document.isEncrypted) return { refused: 'encrypted' }
    const pages = document.getPageCount()
    return pages === 0 ? { refused: 'unreadable' } : { document, pages }
  } catch {
    return { refused: 'unreadable' }
  }
}

/** How many pages a PDF has, read on the device. An encrypted PDF is refused, as every provider refuses one. */
export async function pdfPages(bytes: Uint8Array): Promise<PdfReading> {
  const reading = await loaded(bytes)
  return 'refused' in reading ? reading : { pages: reading.pages }
}

/**
 * A new PDF holding only the pages of the range, copied from the file. The file's catalogue, such as an open action, and
 * its metadata stay behind. Throws for a file `pdfPages` refuses or a range outside it.
 */
export async function pdfPagesCut(bytes: Uint8Array, range: ReadRange): Promise<Uint8Array> {
  const reading = await loaded(bytes)
  if ('refused' in reading) throw new Error(`The PDF cannot be cut: it is ${reading.refused}.`)
  if (range.first < 1 || range.last > reading.pages || range.first > range.last) throw new RangeError(`Pages ${range.first} to ${range.last} are outside a PDF of ${reading.pages}.`)
  const { PDFDocument } = await pdfLib()
  const cut = await PDFDocument.create({ updateMetadata: false })
  const indices = Array.from({ length: range.last - range.first + 1 }, (_, offset) => range.first - 1 + offset)
  for (const page of await cut.copyPages(reading.document, indices)) cut.addPage(page)
  return cut.save()
}
