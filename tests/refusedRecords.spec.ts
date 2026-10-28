import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { writeDrafts } from '../src/apps/company/settings/application/draftWrites'
import { CATEGORY_WRITES } from '../src/apps/company/settings/application/namedRecordWrites'
import { categoriesOfDrafts, categoryDraftsOf } from '../src/apps/company/settings/domain/categoryDrafts'
import { CATEGORY_RECORDS } from '../src/apps/company/workbook/domain/coreKinds'
import { storedOf } from '../src/shared/storage/domain/recordsRead'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import type { WorkbookDocument } from '../src/shared/storage/infrastructure/documentFormat'
import { fakeWorkbookDocument } from '../src/apps/company/workbook/infrastructure/fake/fakeWorkbook'
import { browserHarness, forgetCaches, driveHarness } from './fixtures/writeBack'
import type { WriteBackHarness } from './fixtures/writeBack'

const used = new Set<string>()

afterEach(async () => {
  await forgetCaches(used)
})

/** The fake workbook with the bucket of `consulting` misspelt, as a person might type it in a file. */
function withMisspeltBucket(source: 'drive' | 'browser'): WorkbookDocument {
  const document = fakeWorkbookDocument('2026-10-16T08:00:00.000Z', source)
  const categories = (document.records.category ?? []).map((record) => (record.category === 'consulting' ? { ...record, bucket: 'operatng' } : record))
  return { ...document, records: { ...document.records, category: categories } }
}

describe.each([
  ['a file on Drive', 'drive', driveHarness],
  ['a workbook kept in this browser', 'browser', browserHarness],
] as const)('a category the domain refuses, in %s', (_name, source, harnessOf: (used: Set<string>, seed: WorkbookDocument) => Promise<WriteBackHarness>) => {
  it('still shows in the categories editor as stored, and saving it fixed changes only its bucket', async () => {
    const { store, held } = await harnessOf(used, withMisspeltBucket(source))
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

    const before = withMisspeltBucket(source).records.category!.find((record) => record.category === 'consulting')
    expect((await held()).records.category!.find((record) => record.category === 'consulting')).toEqual({ ...before, bucket: 'operating' })
    expect(store.state.records!.categories.refused).toEqual([])
    expect(store.state.workbook?.categories.find((category) => category.slug === 'consulting')?.bucket).toBe('operating')
  })
})
