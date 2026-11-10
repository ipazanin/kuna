import fontkit from '@pdf-lib/fontkit'
import { rgb } from 'pdf-lib'
import type { PDFDocument, PDFFont, PDFPage } from 'pdf-lib'

/**
 * One weight of Inter as the app ships it: the basic Latin file and the Latin Extended one, which
 * holds č, ć, ž, š and đ. A letter the basic file lacks is drawn from the extended one.
 */
export interface FontPair {
  readonly latin: Uint8Array
  readonly extended: Uint8Array
}

export interface DocumentFontFiles {
  readonly regular: FontPair
  readonly bold: FontPair
  readonly italic: FontPair
}

/** The colour Company's documents print their text and rules in. */
export const INK = rgb(0, 0, 0)

export interface Face {
  width(text: string, size: number): number
  /** Draws the text with its top at `top`, measured from the top of the page. */
  draw(page: PDFPage, text: string, x: number, top: number, size: number): void
  drawRight(page: PDFPage, text: string, right: number, top: number, size: number): void
  drawCentred(page: PDFPage, text: string, centre: number, top: number, size: number): void
  /** The text broken into lines no wider than `width`, at spaces. */
  wrap(text: string, width: number, size: number): string[]
}

export interface DocumentFaces {
  readonly regular: Face
  readonly bold: Face
  readonly italic: Face
}

function faceFrom(latin: PDFFont, extended: PDFFont): Face {
  const latinSet = new Set(latin.getCharacterSet())
  const runs = (text: string): { font: PDFFont; text: string }[] => {
    const cut: { font: PDFFont; text: string }[] = []
    for (const letter of text) {
      const font = latinSet.has(letter.codePointAt(0)!) ? latin : extended
      const last = cut[cut.length - 1]
      if (last !== undefined && last.font === font) {
        last.text += letter
      } else {
        cut.push({ font, text: letter })
      }
    }
    return cut
  }
  const width = (text: string, size: number): number => runs(text).reduce((sum, run) => sum + run.font.widthOfTextAtSize(run.text, size), 0)
  const draw = (page: PDFPage, text: string, x: number, top: number, size: number): void => {
    const baseline = page.getHeight() - top - size * 0.95
    let left = x
    for (const run of runs(text)) {
      page.drawText(run.text, { x: left, y: baseline, size, font: run.font, color: INK })
      left += run.font.widthOfTextAtSize(run.text, size)
    }
  }
  return {
    width,
    draw,
    drawRight: (page, text, right, top, size) => draw(page, text, right - width(text, size), top, size),
    drawCentred: (page, text, centre, top, size) => draw(page, text, centre - width(text, size) / 2, top, size),
    wrap: (text, maxWidth, size) => {
      const lines: string[] = []
      let line = ''
      for (const word of text.split(/\s+/).filter((part) => part !== '')) {
        const candidate = line === '' ? word : `${line} ${word}`
        if (line !== '' && width(candidate, size) > maxWidth) {
          lines.push(line)
          line = word
        } else {
          line = candidate
        }
      }
      return line === '' ? [''] : [...lines, line]
    },
  }
}

async function faceOf(document: PDFDocument, pair: FontPair): Promise<Face> {
  const [latin, extended] = await Promise.all([document.embedFont(pair.latin, { subset: true }), document.embedFont(pair.extended, { subset: true })])
  return faceFrom(latin, extended)
}

/** Embeds the three weights of Inter into the document and returns a face for each. */
export async function embedDocumentFaces(document: PDFDocument, fonts: DocumentFontFiles): Promise<DocumentFaces> {
  document.registerFontkit(fontkit)
  const [regular, bold, italic] = await Promise.all([faceOf(document, fonts.regular), faceOf(document, fonts.bold), faceOf(document, fonts.italic)])
  return { regular, bold, italic }
}
