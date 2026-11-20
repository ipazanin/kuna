import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { addOwnerAdvance, advanceCategories } from '../src/apps/company/facts'
import { OWNER_ADVANCE_RECORDS } from '../src/apps/company/packs/hr-doo/domain/hrDooKinds'
import { fakeStaffOf } from '../src/apps/company/packs/hr-doo/infrastructure/fake/fakeStaff'
import { ADVANCE_BUCKETS } from '../src/apps/company/workbook/domain/workbook'
import type { CompanyBooks } from '../src/apps/company/workbook/domain/readWorkbook'
import { fakeWorkbookDocument } from '../src/apps/company/workbook/infrastructure/fake/fakeWorkbook'
import type { WorkbookStore } from '../src/shared/storage/application/createWorkbookStore'
import { keyOfRecordId } from '../src/shared/storage/domain/recordId'
import { civil, euros } from './fixtures/ledger'
import { browserHarness, forgetCaches } from './fixtures/writeBack'

const company = vi.hoisted(() => ({ store: null as unknown }))
vi.mock('../src/apps/company/workbook/application/workbookStore', () => ({
  useWorkbook: () => company.store ?? { state: { workbook: null, records: null, status: 'opening' } },
}))

const SAVED = '2026-10-16T09:00:00.000Z'

describe('the costs the owner paid that Spending adds in Company', () => {
  const used = new Set<string>()
  afterEach(async () => {
    company.store = null
    await forgetCaches(used)
  })

  async function openCompany(): Promise<WorkbookStore<CompanyBooks>> {
    const { store } = await browserHarness(used, fakeWorkbookDocument(SAVED, 'browser', fakeStaffOf('one-employee')))
    company.store = store
    return store
  }

  it('offers only the categories a cost the owner paid may count in, and none while Company is not open', async () => {
    expect(advanceCategories()).toEqual([])
    const store = await openCompany()
    const offered = advanceCategories()
    const bucketOf = new Map(store.state.workbook!.categories.map((category) => [category.slug, category.bucket]))

    expect(offered.length).toBeGreaterThan(0)
    expect(offered.every((category) => (ADVANCE_BUCKETS as readonly string[]).includes(bucketOf.get(category.slug) ?? ''))).toBe(true)
  })

  it('adds the cost as an owner advance in a write of its own, names it by the link a row stores, and Undo takes it back', async () => {
    const store = await openCompany()
    const before = store.state.workbook!.ownerAdvances.length
    const [category] = advanceCategories()
    const added = await addOwnerAdvance({ day: civil('2026-09-14'), amount: euros(42.5), description: 'Printer paper', category: category!.slug }, 'Owner advance added from Spending')

    const advance = store.state.workbook!.ownerAdvances.find((held) => added.link.key === keyOfRecordId(OWNER_ADVANCE_RECORDS, held.id))
    expect(added.link).toMatchObject({ app: 'company', kind: OWNER_ADVANCE_RECORDS.name, due: null })
    expect(advance).toMatchObject({ date: civil('2026-09-14'), amount: euros(42.5), description: 'Printer paper', category: category!.slug })
    expect(store.state.workbook!.ownerAdvances).toHaveLength(before + 1)
    await added.undo()
    expect(store.state.workbook!.ownerAdvances).toHaveLength(before)
  })

  it('refuses a category a cost the owner paid may not count in, and writes nothing', async () => {
    const store = await openCompany()
    const revenue = store.state.workbook!.categories.find((category) => !(ADVANCE_BUCKETS as readonly string[]).includes(category.bucket))!
    const before = store.state.workbook!.ownerAdvances.length

    await expect(addOwnerAdvance({ day: civil('2026-09-14'), amount: euros(10), description: '', category: revenue.slug }, 'Owner advance added from Spending')).rejects.toThrow(
      'operating or tax category',
    )
    expect(store.state.workbook!.ownerAdvances).toHaveLength(before)
  })
})
