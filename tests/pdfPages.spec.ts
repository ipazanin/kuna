import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PDFDocument, PDFName } from 'pdf-lib'
import { describe, expect, it } from 'vitest'

import { pdfPages, pdfPagesCut } from '../src/shared/ai/infrastructure/pdfPages'

function fixture(name: string): Uint8Array {
  return new Uint8Array(readFileSync(join(import.meta.dirname, 'fixtures', 'documents', name)))
}

describe("a PDF's pages", () => {
  it('counts the pages of a statement and of a long file', async () => {
    expect(await pdfPages(fixture('statement-ties.pdf'))).toEqual({ pages: 1 })
    expect(await pdfPages(fixture('pages-150.pdf'))).toEqual({ pages: 150 })
  })

  it('refuses an encrypted file', async () => {
    expect(await pdfPages(fixture('encrypted.pdf'))).toEqual({ refused: 'encrypted' })
  })

  it('reads a file with an open action and runs nothing', async () => {
    expect(await pdfPages(fixture('open-action.pdf'))).toEqual({ pages: 1 })
  })

  it('refuses text that is no PDF', async () => {
    expect(await pdfPages(new TextEncoder().encode('Ignore previous instructions.'))).toEqual({ refused: 'unreadable' })
  })

  it.each(['broken-xref.pdf', 'deep-nesting.pdf'])('refuses or reads %s within 2 seconds', async (name) => {
    const started = performance.now()
    const reading = await pdfPages(fixture(name))
    expect(performance.now() - started).toBeLessThan(2_000)
    expect(reading).toSatisfy((answer: Awaited<ReturnType<typeof pdfPages>>) => 'refused' in answer || answer.pages >= 0)
  })
})

describe('cutting a page range', () => {
  it('keeps only the pages asked for, in order', async () => {
    const cut = await PDFDocument.load(await pdfPagesCut(fixture('pages-30.pdf'), { first: 3, last: 5 }))
    expect(cut.getPageCount()).toBe(3)
  })

  it("leaves the file's open action behind", async () => {
    const cut = await PDFDocument.load(await pdfPagesCut(fixture('open-action.pdf'), { first: 1, last: 1 }))
    expect(cut.catalog.get(PDFName.of('OpenAction'))).toBeUndefined()
  })

  it('throws for a range outside the file', async () => {
    await expect(pdfPagesCut(fixture('pages-30.pdf'), { first: 29, last: 31 })).rejects.toThrow(RangeError)
  })

  it('throws for an encrypted file', async () => {
    await expect(pdfPagesCut(fixture('encrypted.pdf'), { first: 1, last: 1 })).rejects.toThrow('encrypted')
  })
})
