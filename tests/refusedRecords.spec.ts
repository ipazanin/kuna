import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { writeDrafts } from '../src/features/settings/application/draftWrites'
import { CATEGORY_WRITES } from '../src/features/settings/application/namedRecordWrites'
import { categoriesOfDrafts, categoryDraftsOf } from '../src/features/settings/domain/categoryDrafts'
import { storedOf } from '../src/features/workbook/domain/recordsRead'
import { recordIdOf } from '../src/features/workbook/domain/recordId'
import { CATEGORY_RECORDS } from '../src/features/workbook/domain/recordKind'
import { fakeWorkbookValues } from '../src/features/workbook/infrastructure/fake/fakeWorkbook'
import { excelHarness, forgetCaches, googleHarness } from './fixtures/writeBack'
import type { WriteBackHarness } from './fixtures/writeBack'

const used = new Set<string>()

afterEach(async () => {
  await forgetCaches(used)
})

/** The fake workbook with the bucket of `consulting` misspelt, as a person might type it in the Sheet. */
function withMisspeltBucket(source: 'google' | 'excel'): ReturnType<typeof fakeWorkbookValues> {
  const values = fakeWorkbookValues(source)
  const [header, ...rows] = values.categories
  const bucket = header!.indexOf('bucket')
  return { ...values, categories: [header!, ...rows.map((row) => (row[0] === 'consulting' ? row.map((cell, column) => (column === bucket ? 'operatng' : cell)) : row))] }
}

describe.each([
  ['a Google Sheet', 'google', googleHarness],
  ['a workbook kept in this browser', 'excel', excelHarness],
] as const)('a category the domain refuses, in %s', (_name, source, harnessOf: (used: Set<string>, grids: ReturnType<typeof fakeWorkbookValues>) => Promise<WriteBackHarness>) => {
  it('still shows in the categories editor as stored, and saving it fixed writes the one cell', async () => {
    const { store, writtenRanges } = await harnessOf(used, withMisspeltBucket(source))
    const records = store.state.records!.categories

    expect(records.refused).toEqual([expect.objectContaining({ id: recordIdOf(CATEGORY_RECORDS, 'consulting'), label: 'consulting', reason: '"operatng" is not a bucket' })])
    expect(store.state.workbook?.categories.some((category) => category.slug === 'consulting')).toBe(false)

    const stored = storedOf(records)
    const drafts = categoryDraftsOf(stored)
    expect(drafts.find((draft) => draft.category === 'consulting')?.bucket).toBe('operatng')

    const made = categoriesOfDrafts(
      stored,
      drafts.map((draft) => (draft.category === 'consulting' ? { ...draft, bucket: 'operating' } : draft)),
    ).flatMap((draft) => ('record' in draft ? [draft] : []))
    expect(made).toHaveLength(stored.length)
    const receipt = await store.write('Categories saved', (unit) => writeDrafts(unit.of(CATEGORY_WRITES), stored, made))
    expect(receipt?.records.map(({ change }) => change.verb)).toEqual(['repair'])

    if (source === 'google') {
      const row = withMisspeltBucket(source).categories.findIndex((cells) => cells[0] === 'consulting') + 1
      expect(writtenRanges()).toEqual([`categories!C${row}`])
    }
    expect(store.state.records!.categories.refused).toEqual([])
    expect(store.state.workbook?.categories.find((category) => category.slug === 'consulting')?.bucket).toBe('operating')
  })
})
