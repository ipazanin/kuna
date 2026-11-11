import { inflateSync } from 'node:zlib'
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRawStream, PDFRef } from 'pdf-lib'
import type { PDFObject } from 'pdf-lib'
import { describe, expect, it } from 'vitest'

import { TRIP_CODECS, tripsOf } from '../src/apps/company/packs/hr-doo/domain/hrDooWrites'
import type { TripFile } from '../src/apps/company/packs/hr-doo/domain/trips/tripReading'
import { tripSettlement } from '../src/apps/company/packs/hr-doo/domain/trips/tripSettlement'
import { tripFileName } from '../src/apps/company/packs/hr-doo/infrastructure/tripDocument'
import type { TripDocumentContext } from '../src/apps/company/packs/hr-doo/infrastructure/tripDocument'
import { tripPdf } from '../src/apps/company/packs/hr-doo/infrastructure/tripPdf'
import { tripWorkbookFile } from '../src/apps/company/packs/hr-doo/infrastructure/tripWorkbookFile'
import { ruleValue } from '../src/apps/company/packs/hr-doo/ruleset/ruleset'
import { companyOib } from '../src/apps/company/settings/domain/settings'
import { serialFromCivilDate } from '../src/shared/calendar/civilDate'
import type { RecordCodec } from '../src/shared/storage/domain/recordCodec'
import type { RecordFields } from '../src/shared/storage/domain/recordFields'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import type { RecordsRead } from '../src/shared/storage/domain/recordsRead'
import { storedFieldsOfValues } from '../src/shared/storage/domain/storedFields'
import { readEveryTab } from '../src/shared/xlsx/sheetGrids'
import { documentFontFiles } from './fixtures/documentFonts'
import { civil } from './fixtures/ledger'

function tab<R>(codec: RecordCodec<R>, rows: readonly RecordFields[]): RecordsRead<R> {
  return {
    records: rows.map((row) => {
      const fields = storedFieldsOfValues(row)
      const id = recordIdOf(codec.kind, String(row.id))
      return { record: codec.make(fields, id), id, label: codec.label(fields), fields }
    }),
    refused: [],
  }
}

const SPLIT: RecordFields = {
  id: 'split',
  number: '3/2026',
  issued: '2026-03-10',
  traveller: 'alex',
  role: 'Direktor',
  destination: 'Split',
  task: 'Sastanak s klijentom',
  departs: '2026-03-12',
  days: '2',
  transport: 'private-car',
  car: 'Made-up Estate',
  plate: 'ZG-000-XX',
  km_rate: '0.50',
  advance: '100',
  left: '2026-03-12 07:00',
  returned: '2026-03-13 20:00',
  odometer_start: '10000',
  odometer_end: '10820',
  meals: '1, 0',
  report: 'Sastali smo se s klijentom i potpisali narudžbu.',
  settled_on: '2026-03-16',
}

const LEGS: readonly RecordFields[] = [
  { id: 'out', trip: 'split', date: '2026-03-12', from: 'Zagreb', to: 'Split', km: '410' },
  { id: 'back', trip: 'split', date: '2026-03-13', from: 'Split', to: 'Zagreb', km: '410' },
]

const COSTS: readonly RecordFields[] = [
  { id: 'toll', trip: 'split', date: '2026-03-12', kind: 'toll', description: 'Autocesta', amount: '27.40', paid_by: 'traveller' },
  { id: 'hotel', trip: 'split', date: '2026-03-12', kind: 'lodging', description: 'Hotel', amount: '95', paid_by: 'company' },
]

const CONTEXT: TripDocumentContext = {
  issuer: { name: 'Primjer d.o.o.', oib: '12345678901', address: 'Ulica 1, 10000 Zagreb' },
  traveller: 'Ana Čičić',
  place: 'Zagreb',
}

function fileOf(legs: readonly RecordFields[] = LEGS, costs: readonly RecordFields[] = COSTS, trip: RecordFields = SPLIT): TripFile {
  const reading = tripsOf({ trips: tab(TRIP_CODECS.trip, [trip]), legs: tab(TRIP_CODECS.leg, legs), costs: tab(TRIP_CODECS.cost, costs) }, new Set(['alex']))
  return reading.files[0]!
}

function streamText(stream: PDFObject | undefined): string {
  if (!(stream instanceof PDFRawStream)) return ''
  const compressed = stream.dict.get(PDFName.of('Filter')) !== undefined
  return Buffer.from(compressed ? inflateSync(stream.contents) : stream.contents).toString('latin1')
}

/** A font's glyph ids to letters, from its ToUnicode map. */
function glyphMap(document: PDFDocument, font: PDFObject | undefined): Map<string, string> {
  const map = new Map<string, string>()
  const dict = font instanceof PDFRef ? document.context.lookup(font) : font
  if (!(dict instanceof PDFDict)) return map
  const cmap = streamText(document.context.lookup(dict.get(PDFName.of('ToUnicode')) as PDFRef))
  for (const [, glyph, unicode] of cmap.matchAll(/<([0-9A-Fa-f]{4})>\s*<([0-9A-Fa-f]+)>/g)) {
    map.set(glyph!.toUpperCase(), String.fromCodePoint(...unicode!.match(/.{4}/g)!.map((unit) => parseInt(unit, 16))))
  }
  return map
}

/** The text a page draws, every run joined, read back through the ToUnicode map of the font each run is set in. */
function pageTexts(document: PDFDocument): string[] {
  return document.getPages().map((page) => {
    const fonts = page.node.Resources()?.lookup(PDFName.of('Font'), PDFDict)
    const contents = page.node.Contents()
    const streams = contents instanceof PDFArray ? contents.asArray().map((ref) => document.context.lookup(ref)) : [contents]
    const operators = streams.map((stream) => streamText(stream)).join('\n')
    let map = new Map<string, string>()
    let text = ''
    for (const [, font, hex] of operators.matchAll(/\/(\S+)\s+[\d.]+\s+Tf|<([0-9A-Fa-f]*)>\s*Tj/g)) {
      if (font !== undefined) map = glyphMap(document, fonts?.get(PDFName.of(font)))
      else text += (hex!.toUpperCase().match(/.{4}/g) ?? []).map((glyph) => map.get(glyph) ?? '?').join('')
    }
    return text
  })
}

describe('the travel order PDF', () => {
  it('prints the order, the traveller and the payout on one A4 page', async () => {
    const file = fileOf()
    const document = await PDFDocument.load(await tripPdf(file, tripSettlement(file, ruleValue), CONTEXT, documentFontFiles()))
    expect(document.getPageCount()).toBe(1)
    expect(document.getPage(0).getSize()).toEqual({ width: 595.28, height: 841.89 })
    expect(document.getTitle()).toBe('PUTNI NALOG br. 3/2026')
    const text = pageTexts(document)[0]!
    expect(text).toContain('3/2026')
    expect(text).toContain('Ana Čičić')
    // 21.00 and 30.00 per diems, 820 km at 0.50 is 410.00, and the 27.40 toll, less the 100.00 advance, is 388.40.
    expect(text).toContain('Za isplatu putniku')
    expect(text).toContain('388,40 €')
  })

  it('runs a long list of legs onto a second page', async () => {
    const legs = Array.from({ length: 30 }, (_, index) => ({ id: `leg-${index}`, trip: 'split', date: '2026-03-12', from: 'Zagreb', to: 'Karlovac', km: '13' }))
    const file = fileOf(legs)
    const document = await PDFDocument.load(await tripPdf(file, tripSettlement(file, ruleValue), CONTEXT, documentFontFiles()))
    expect(document.getPageCount()).toBe(2)
    const second = pageTexts(document)[1]!
    expect(second).toContain('Stranica 2 od 2')
    expect(second).toContain('Za isplatu putniku')
  })

  it('prints an order not yet travelled, with what its settlement waits for', async () => {
    const planned = Object.fromEntries(Object.entries(SPLIT).filter(([name]) => !['left', 'returned', 'odometer_start', 'odometer_end', 'meals', 'report', 'settled_on'].includes(name)))
    const file = fileOf([], [], planned)
    const document = await PDFDocument.load(await tripPdf(file, tripSettlement(file, ruleValue), CONTEXT, documentFontFiles()))
    const text = pageTexts(document)[0]!
    expect(text).toContain('Obračun čekavrijeme polaska i povratka')
    expect(text).not.toContain('Za isplatu putniku')
  })
})

describe('the travel order xlsx', () => {
  it('writes the order and the settlement as rows of one sheet, with date and euro cells', async () => {
    const file = fileOf()
    const tabs = await readEveryTab(await tripWorkbookFile(file, tripSettlement(file, ruleValue), CONTEXT))
    expect(tabs.map((sheet) => sheet.name)).toEqual(['Putni nalog'])
    const rows = tabs[0]!.grid
    const row = (label: string) => rows.find((cells) => cells[0] === label)
    expect(rows[4]).toEqual(['PUTNI NALOG br. 3/2026'])
    expect(row('Broj')).toEqual(['Broj', '3/2026'])
    expect(row('Putnik')?.[1]).toBe('Ana Čičić')
    expect(row('Datum izdavanja')).toEqual(['Datum izdavanja', serialFromCivilDate(civil('2026-03-10'))])
    expect(row('Za isplatu putniku')).toEqual(['Za isplatu putniku', 388.4])
    expect(row('Troškovi koje je platilo društvo')).toEqual(['Troškovi koje je platilo društvo', 95])
    expect(row('Ukupno km')).toEqual(['Ukupno km', undefined, undefined, 820])
  })

  it('names both files after the order number', () => {
    expect(tripFileName('3/2026', 'pdf')).toBe('putni-nalog-3-2026.pdf')
    expect(tripFileName(' 3/2026 ', 'xlsx')).toBe('putni-nalog-3-2026.xlsx')
  })
})

describe("the company's OIB", () => {
  it('is the digits of its VAT ID, and blank while the VAT ID is', () => {
    expect([companyOib({ vatId: 'HR12345678901' }), companyOib({ vatId: 'HR 123 4567 8901' }), companyOib({ vatId: '' })]).toEqual(['12345678901', '12345678901', ''])
  })
})
