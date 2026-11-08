import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { assetsAssistant } from '../src/apps/assets/assistant/assetsAssistant'
import { assetsReader } from '../src/apps/assets/assistant/assetsReader'
import type { AssetsReading } from '../src/apps/assets/assistant/assetsReader'
import { ASSET_WRITES } from '../src/apps/assets/asset/application/assetWrites'
import { houseIndexOfAnswer } from '../src/apps/assets/houseIndex/infrastructure/dzsHouseIndex'
import { FAKE_HOUSE_INDEX_ANSWER } from '../src/apps/assets/houseIndex/infrastructure/fake/fakeHouseIndex'
import { assetsOnDay, assetsTotal } from '../src/apps/assets/values/presentation/assetsOnDay'
import { findRecords } from '../src/shared/ai/application/chatReads'
import type { ChatReads, FindRecordsInput } from '../src/shared/ai/application/chatReads'
import { chatRefs } from '../src/shared/ai/domain/chatRefs'
import type { AppReader, ReadableField, ReportFigure } from '../src/shared/app/assistantReader'
import { newPseudonyms } from '../src/shared/privacy/domain/pseudonyms'
import { civil } from './fixtures/ledger'
import { DESK_LOANS, EXAMPLE_RECORDS, assetsDesk } from './fixtures/assetsDesk'
import type { AssetsDesk } from './fixtures/assetsDesk'
import { forgetCaches } from './fixtures/writeBack'

const used = new Set<string>()
afterEach(async () => forgetCaches(used))

const INDEX = houseIndexOfAnswer(FAKE_HOUSE_INDEX_ANSWER)

function readingOf(desk: AssetsDesk, overrides: Partial<AssetsReading> = {}): AssetsReading {
  return { status: () => 'open', book: () => desk.store.state.workbook, index: () => INDEX, loans: () => [...DESK_LOANS], ...overrides }
}

function fieldsOf(reader: AppReader, kind: string, id: string): Readonly<Record<string, ReadableField>> {
  const row = reader.kinds
    .find((candidate) => candidate.name === kind)!
    .rows()
    .find((candidate) => candidate.id === id)!
  return Object.fromEntries(row.fields.map((field) => [field.name, field]))
}

function figureOf(figures: readonly ReportFigure[], label: string): ReportFigure {
  const figure = figures.find((candidate) => candidate.label === label)
  if (figure === undefined) throw new Error(`No figure ${label} among ${figures.map((candidate) => candidate.label).join(' | ')}`)
  return figure
}

describe('what the chat reads of Assets', () => {
  it('reads the two kinds, with each amount in euros and the loan by the name Loans lists it under', async () => {
    const desk = await assetsDesk(used)
    const reader = assetsReader(readingOf(desk))
    expect(reader.kinds.map((kind) => kind.name)).toEqual(['asset', 'valuation'])
    expect(fieldsOf(reader, 'asset', EXAMPLE_RECORDS['asset-home']!)).toMatchObject({
      price: { of: 'app', cents: 20_000_000, currency: 'EUR' },
      loan: { exposure: 'free-text', value: 'Home loan' },
      region: { value: 'zagreb' },
    })
    expect(fieldsOf(reader, 'asset', EXAMPLE_RECORDS['asset-boat']!)['loan']).toMatchObject({ value: null })
    expect(fieldsOf(reader, 'valuation', EXAMPLE_RECORDS['valuation']!)).toMatchObject({ value: { cents: 1_550_000 }, asset: { exposure: 'ref', id: EXAMPLE_RECORDS['asset-boat'] } })
  })

  it('finds an asset with no price, leaving the price out', async () => {
    const desk = await assetsDesk(used)
    const boat = desk.store.state.workbook!.readings.assets.facts.find((asset) => asset.id === EXAMPLE_RECORDS['asset-boat'])!
    await desk.store.write('Inherited', (unit) => unit.of(ASSET_WRITES).change(boat, { ...boat, price: null }))
    const reads: ChatReads = {
      readers: new Map([['assets', { name: 'Assets', reader: assetsReader(readingOf(desk)) }]]),
      pseudonyms: newPseudonyms(),
      refs: chatRefs(),
      anonymising: () => true,
      persons: () => [],
      mayRead: async () => true,
    }
    const input: FindRecordsInput = { app: 'assets', kind: 'asset', query: null, from: null, to: null, about: null, only: null, limit: null, cursor: null }

    const answer = await findRecords(input, reads)

    const records = (JSON.parse(answer.text) as { records: Record<string, unknown>[] }).records
    expect(records).toHaveLength(2)
    expect(records.filter((record) => 'price' in record)).toHaveLength(1)
  })

  it('says a loan Loans no longer lists, and one it cannot be asked about', async () => {
    const desk = await assetsDesk(used)
    const gone = assetsReader(readingOf(desk, { loans: () => [] }))
    expect(fieldsOf(gone, 'asset', EXAMPLE_RECORDS['asset-home']!)['loan']).toMatchObject({ value: 'a bank loan that Loans no longer lists' })
    const waiting = assetsReader(readingOf(desk, { loans: () => 'opening' }))
    expect(fieldsOf(waiting, 'asset', EXAMPLE_RECORDS['asset-home']!)['loan']).toMatchObject({ value: 'a bank loan of Loans, which cannot be read now' })
  })

  it('links an asset to its own page', async () => {
    const desk = await assetsDesk(used)
    expect(Object.fromEntries(assetsReader(readingOf(desk)).kinds.flatMap((kind) => (kind.page === undefined ? [] : [[kind.name, kind.page]])))).toEqual({ asset: '/assets/asset' })
  })

  it('sends a person named in an asset note under an alias with Anonymise on, and knows no person of its own', async () => {
    const desk = await assetsDesk(used)
    const flat = desk.store.state.workbook!.readings.assets.facts.find((asset) => asset.id === EXAMPLE_RECORDS['asset-home'])!
    await desk.store.write('Noted', (unit) => unit.of(ASSET_WRITES).change(flat, { ...flat, note: 'Bought with Ivana' }))
    const reading = readingOf(desk)
    const reads: ChatReads = {
      readers: new Map([['assets', { name: 'Assets', reader: assetsReader(reading) }]]),
      pseudonyms: newPseudonyms(),
      refs: chatRefs(),
      anonymising: () => true,
      persons: () => [{ name: 'Ivana', employee: false, ibans: [] }],
      mayRead: async () => true,
    }
    const input: FindRecordsInput = { app: 'assets', kind: 'asset', query: null, from: null, to: null, about: null, only: null, limit: null, cursor: null }

    const answer = await findRecords(input, reads)

    expect(answer.text).not.toMatch(/Ivana/)
    expect((JSON.parse(answer.text) as { records: Record<string, string>[] }).records.map((record) => record['note'])).toContain('Bought with Person 1')
    expect(assetsAssistant(reading).persons()).toEqual([])
  })
})

describe("Assets' report", () => {
  it('counts what the assets are worth on a day as the Overview and each page do, with how each value was reached and the loan on it', async () => {
    const desk = await assetsDesk(used)
    const reader = assetsReader(readingOf(desk))
    const worth = reader.reports.find((report) => report.id === 'worth')!
    const figures = worth.figures('2026-07-01')
    const book = desk.store.state.workbook!
    const day = civil('2026-07-01')
    const total = assetsTotal(book, day, INDEX, DESK_LOANS)
    const [flat] = assetsOnDay(book, day, INDEX, DESK_LOANS)

    expect(figureOf(figures, 'assets worth together')).toMatchObject({ cents: (total as { value: number }).value })
    expect(figures.find((figure) => figure.label.startsWith('home bought 2025-03-15: worth, from 2025-03-15, carried to'))).toMatchObject({ cents: flat!.value!.cents })
    expect(figureOf(figures, 'home bought 2025-03-15: owed on its bank loan')).toMatchObject({ cents: 12_000_000 })
    expect(figureOf(figures, 'home bought 2025-03-15: yours after its bank loan')).toMatchObject({ cents: flat!.equity.yours })
    expect(figureOf(figures, 'other asset bought 2022-06-01: worth, from the valuation of 2026-05-01')).toMatchObject({ cents: 1_550_000 })
    expect(figures.map((figure) => figure.label).join(' ')).not.toMatch(/Flat in Zagreb|Sailing boat/)
    expect(() => worth.figures('July')).toThrow(RangeError)
  })

  it('waits for the house price index and says when it failed', async () => {
    const desk = await assetsDesk(used)
    const waiting = assetsReader(readingOf(desk, { index: () => 'loading' })).reports[0]!.figures('2026-07-01')
    expect(waiting.map((figure) => figure.label)).toEqual(['assets worth together: waiting for the house price index, so there is no figure yet'])
    const failed = assetsReader(readingOf(desk, { index: () => 'failed' })).reports[0]!.figures('2026-07-01')
    expect(figureOf(failed, 'homes valued without the house price index, which did not load')).toMatchObject({ count: 1 })
    expect(figureOf(failed, 'home bought 2025-03-15: worth, from the price paid on 2025-03-15')).toMatchObject({ cents: 20_000_000 })
  })

  it('names a second asset alike with a number after it', async () => {
    const desk = await assetsDesk(used)
    const boat = desk.store.state.workbook!.readings.assets.facts.find((asset) => asset.id === EXAMPLE_RECORDS['asset-boat'])!
    await desk.store.write('A second boat', (unit) => unit.of(ASSET_WRITES).add({ ...boat, id: `${boat.id}-2` as typeof boat.id }))
    const labels = assetsReader(readingOf(desk))
      .reports[0]!.figures('2026-07-01')
      .map((figure) => figure.label)
    expect(labels.filter((label) => label.includes('other asset bought 2022-06-01') && label.includes('worth,'))).toHaveLength(2)
    expect(labels.some((label) => label.startsWith('other asset bought 2022-06-01 (2): worth'))).toBe(true)
  })
})
