import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { CATEGORY_WRITES } from '../src/features/settings/application/namedRecordWrites'
import { categoriesOfDrafts, categoryDraftsOf, pickedColour } from '../src/features/settings/domain/categoryDrafts'
import { categoryColourRefusals } from '../src/features/settings/domain/categoryGuards'
import { categoryColourOf, isPaletteColour } from '../src/features/workbook/domain/categoryColour'
import { readCategories } from '../src/features/workbook/domain/categoriesReading'
import { storedOf } from '../src/features/workbook/domain/recordsRead'
import { CATEGORY_RECORDS } from '../src/features/workbook/domain/recordKind'
import type { CellValue } from '../src/features/workbook/infrastructure/workbookSnapshot'
import { recordsOfRows, spreadsheetTabOfKind } from '../src/features/workbook/infrastructure/spreadsheetTab'
import { addRows as add, editRow as edit } from './fixtures/recordWrites'
import { browserHarness, forgetCaches, driveHarness, workbookGrids } from './fixtures/writeBack'
import type { WriteBackHarness } from './fixtures/writeBack'

const used = new Set<string>()

afterEach(async () => {
  await forgetCaches(used)
})

/** The write-back workbook with a pastel colour from the Sheet on equipment and a blank one on the rest. */
function withColours(): Record<string, CellValue[][]> {
  return {
    ...workbookGrids(),
    categories: [
      ['category', 'family', 'bucket', 'colour', 'label'],
      ['equipment', 'operating', 'operating', '#DCE9F9', ''],
      ['ai-services', 'operating', 'operating', '', ''],
      ['revenue', 'income', 'income', '', ''],
    ],
  }
}

describe('CategoryColour', () => {
  it('reads a swatch by its light hex in any case, and anything else as the bucket colour, keeping it as stored', () => {
    expect(categoryColourOf('#2A78D6')).toEqual({ swatch: { name: 'Blue', hex: '#2a78d6', slot: 3 }, stored: '#2A78D6' })
    expect(categoryColourOf('#a3adb9').swatch).toEqual({ name: 'Grey', hex: '#a3adb9', slot: null })
    expect(categoryColourOf('#dce9f9')).toEqual({ swatch: null, stored: '#dce9f9' })
    expect(categoryColourOf('blue')).toEqual({ swatch: null, stored: 'blue' })
    expect(categoryColourOf('')).toEqual({ swatch: null, stored: '' })
  })

  it('lets a save write a swatch or a blank, and nothing else', () => {
    expect(['', '#008300', '#E34948'].map(isPaletteColour)).toEqual([true, true, true])
    expect(['#dce9f9', 'blue', '#12345'].map(isPaletteColour)).toEqual([false, false, false])
  })

  it('reads a category with a colour outside the palette with no problem', () => {
    const read = recordsOfRows(spreadsheetTabOfKind(CATEGORY_RECORDS), [{ sheetRow: 2, cells: { category: 'equipment', family: 'operating', bucket: 'operating', colour: '#dce9f9' } }])

    expect(readCategories(read)).toMatchObject({ facts: [{ slug: 'equipment', colour: { swatch: null, stored: '#dce9f9' } }], problems: [] })
  })

  it('refuses a colour a change gives outside the palette, and leaves one the change keeps alone', () => {
    const cells = (colour: string) => ({ slug: 'equipment', bucket: 'operating', colour })

    expect(categoryColourRefusals([{ before: cells('#dce9f9'), after: cells('#12345') }, { before: null, after: { ...cells('blue'), slug: 'paper' } }])).toEqual([
      '"equipment" takes one of the nine colours of the palette, or none for its bucket\'s colour, not "#12345".',
      '"paper" takes one of the nine colours of the palette, or none for its bucket\'s colour, not "blue".',
    ])
    expect(categoryColourRefusals([{ before: cells('#dce9f9'), after: cells('#dce9f9') }, { before: cells('#dce9f9'), after: cells('#2a78d6') }, { before: cells('#2a78d6'), after: cells('') }])).toEqual([])
  })

  it('keeps the colour the editor opened with when a save leaves it alone', () => {
    const stored = storedOf(recordsOfRows(spreadsheetTabOfKind(CATEGORY_RECORDS), [{ sheetRow: 2, cells: { category: 'equipment', family: 'operating', bucket: 'operating', colour: '#dce9f9' } }]))
    const [draft] = categoryDraftsOf(stored)

    expect(categoriesOfDrafts(stored, [{ ...draft!, label: 'Tools' }])[0]).toMatchObject({ record: { label: 'Tools', colour: { swatch: null, stored: '#dce9f9' } } })
  })

  it('keeps a colour outside the palette when Bucket colour is picked after a swatch, and clears a swatch', () => {
    const stored = storedOf(
      recordsOfRows(spreadsheetTabOfKind(CATEGORY_RECORDS), [
        { sheetRow: 2, cells: { category: 'equipment', family: 'operating', bucket: 'operating', colour: '#dce9f9' } },
        { sheetRow: 3, cells: { category: 'paper', family: 'operating', bucket: 'operating', colour: '#2a78d6' } },
      ]),
    )
    const [pastel, blue] = categoryDraftsOf(stored)

    expect(pickedColour(pastel!, '#eb6834', stored)).toBe('#eb6834')
    expect(pickedColour({ ...pastel!, colour: '#eb6834' }, '', stored)).toBe('#dce9f9')
    expect(pickedColour(blue!, '', stored)).toBe('')
    expect(pickedColour({ ...pastel!, saved: null }, '', stored)).toBe('')
  })
})

describe.each([
  ['a file on Drive', driveHarness],
  ['a workbook kept in this browser', browserHarness],
] as const)('category colours in %s', (_name, harnessOf: (used: Set<string>, grids?: Record<string, CellValue[][]>) => Promise<WriteBackHarness>) => {
  const colourCells = (harness: WriteBackHarness) => harness.store.state.snapshot?.document.records.category?.map((record) => record.colour ?? '')

  it('writes a picked swatch, leaves a colour from the Sheet alone when another field changes, and Undo puts the old colour back', async () => {
    const harness = await harnessOf(used, withColours())

    await edit(harness.store, CATEGORY_WRITES, 2, { label: 'Tools' })
    expect(colourCells(harness)).toEqual(['#DCE9F9', '', ''])

    await edit(harness.store, CATEGORY_WRITES, 2, { colour: '#2a78d6' })
    expect(colourCells(harness)).toEqual(['#2a78d6', '', ''])
    expect(harness.store.state.workbook?.categories[0]?.colour.swatch?.name).toBe('Blue')

    await harness.store.undo(harness.store.state.writes[0]!)
    expect(colourCells(harness)).toEqual(['#DCE9F9', '', ''])
    expect(harness.store.state.workbook?.problems).toEqual([])
  })

  it('refuses a colour outside the palette, on a change and on a new category', async () => {
    const harness = await harnessOf(used, withColours())

    await expect(edit(harness.store, CATEGORY_WRITES, 3, { colour: '#12345' })).rejects.toThrow('"ai-services" takes one of the nine colours of the palette')
    await expect(add(harness.store, CATEGORY_WRITES, { category: 'paper', family: 'operating', bucket: 'operating', colour: 'blue' })).rejects.toThrow('"paper" takes one of the nine colours of the palette')
    expect(colourCells(harness)).toEqual(['#DCE9F9', '', ''])
  })
})
