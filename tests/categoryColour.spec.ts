import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { CATEGORY_WRITES } from '../src/apps/company/categories/application/categoryWrites'
import { categoriesOfDrafts, categoryDraftsOf, pickedColour } from '../src/apps/company/categories/domain/categoryDrafts'
import { categoryColourRefusals } from '../src/apps/company/categories/domain/categoryGuards'
import { categoryColourOf, isCategoryColour } from '../src/apps/company/workbook/domain/categoryColour'
import { readCategories } from '../src/apps/company/workbook/domain/categoriesReading'
import { CATEGORY_RECORDS } from '../src/apps/company/workbook/domain/coreKinds'
import { storedOf } from '../src/shared/storage/domain/recordsRead'
import { SWATCHES } from '../src/shared/charts/swatches'
import type { CellValue } from '../src/apps/company/workbook/infrastructure/workbookSnapshot'

/** The palette's codes, which a refused colour lists. */
const CODES = SWATCHES.map((swatch) => swatch.hex).join(', ')
import { recordsOfRows, spreadsheetTabOfKind } from '../src/apps/company/workbook/infrastructure/spreadsheetTab'
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
  it('reads a swatch or an own colour by its light hex in any case, and anything else as the bucket colour, keeping it as stored', () => {
    expect(categoryColourOf('#2A78D6')).toEqual({ swatch: { name: 'Blue', hex: '#2a78d6', slot: 3, own: false }, stored: '#2A78D6' })
    expect(categoryColourOf('#858F9D').swatch).toEqual({ name: 'Grey', hex: '#858f9d', slot: null, own: false })
    expect(categoryColourOf('#7A3E12').swatch).toEqual({ name: 'Own colour #7A3E12', hex: '#7a3e12', slot: null, own: true })
    expect(categoryColourOf('#dce9f9')).toEqual({ swatch: null, stored: '#dce9f9' })
    expect(categoryColourOf('blue')).toEqual({ swatch: null, stored: 'blue' })
    expect(categoryColourOf('')).toEqual({ swatch: null, stored: '' })
  })

  it('lets a save write a swatch, an own colour that shows in the light theme or a blank, and nothing else', () => {
    expect(['', '#008300', '#E34948', '#7a3e12'].map(isCategoryColour)).toEqual([true, true, true, true])
    expect(['#dce9f9', 'blue', '#12345'].map(isCategoryColour)).toEqual([false, false, false])
  })

  it('reads a category with a colour outside the palette with no problem', () => {
    const read = recordsOfRows(spreadsheetTabOfKind(CATEGORY_RECORDS), [{ sheetRow: 2, cells: { category: 'equipment', family: 'operating', bucket: 'operating', colour: '#dce9f9' } }])

    expect(readCategories(read)).toMatchObject({ facts: [{ slug: 'equipment', colour: { swatch: null, stored: '#dce9f9' } }], problems: [] })
  })

  it('refuses a colour a change gives that is no swatch, and leaves one the change keeps alone', () => {
    const cells = (colour: string) => ({ slug: 'equipment', bucket: 'operating', colour })

    expect(
      categoryColourRefusals([
        { before: cells('#dce9f9'), after: cells('#12345') },
        { before: null, after: { ...cells('blue'), slug: 'paper' } },
      ]),
    ).toEqual([
      `"equipment" takes one of the 13 colours of the palette, ${CODES}, an own colour as #rrggbb that keeps 3:1 in the light theme, or none for its bucket's colour, not "#12345".`,
      `"paper" takes one of the 13 colours of the palette, ${CODES}, an own colour as #rrggbb that keeps 3:1 in the light theme, or none for its bucket's colour, not "blue".`,
    ])
    expect(
      categoryColourRefusals([
        { before: cells('#dce9f9'), after: cells('#dce9f9') },
        { before: cells('#dce9f9'), after: cells('#2a78d6') },
        { before: cells('#2a78d6'), after: cells('') },
      ]),
    ).toEqual([])
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

  it('refuses a colour that is no swatch, on a change and on a new category', async () => {
    const harness = await harnessOf(used, withColours())

    await expect(edit(harness.store, CATEGORY_WRITES, 3, { colour: '#12345' })).rejects.toThrow('"ai-services" takes one of the 13 colours of the palette')
    await expect(add(harness.store, CATEGORY_WRITES, { category: 'paper', family: 'operating', bucket: 'operating', colour: 'blue' })).rejects.toThrow(
      '"paper" takes one of the 13 colours of the palette',
    )
    expect(colourCells(harness)).toEqual(['#DCE9F9', '', ''])
  })
})
