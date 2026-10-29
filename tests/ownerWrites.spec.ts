import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { CATEGORY_WRITES } from '../src/apps/company/settings/application/namedRecordWrites'
import { ownerAdvanceOfDraft } from '../src/apps/company/packs/hr-doo/application/ownerAdvanceWrites'
import type { OwnerAdvanceDraft } from '../src/apps/company/packs/hr-doo/application/ownerAdvanceWrites'
import { OWNER_ADVANCE_WRITES } from '../src/apps/company/packs/hr-doo/domain/hrDooWrites'
import type { OwnerAdvanceEntry } from '../src/apps/company/packs/hr-doo/domain/ownerAdvancesReading'
import { canUndo, wasUndone } from '../src/shared/storage/application/createWorkbookStore'
import type { WorkbookStore } from '../src/shared/storage/application/createWorkbookStore'
import type { CompanyBooks } from '../src/apps/company/workbook/domain/readWorkbook'
import { WorkbookWriteRefused } from '../src/shared/storage/application/workbookWriteRefused'
import type { DefinedBucket } from '../src/apps/company/workbook/domain/bucket'
import type { CategoryRecord } from '../src/apps/company/workbook/domain/categoriesReading'
import { recordWithId } from '../src/shared/storage/domain/recordsRead'
import { recordsOfKindIn } from '../src/apps/company/workbook/domain/readWorkbook'
import { OWNER_ADVANCE_RECORDS } from '../src/apps/company/packs/hr-doo/domain/hrDooKinds'
import { categoryIdOf } from '../src/apps/company/workbook/domain/workbook'
import { cellsOf } from './fixtures/recordWrites'
import { civil, euros } from './fixtures/ledger'
import { withIds } from './fixtures/rowIds'
import { AN_ID, browserHarness, forgetCaches, driveHarness, workbookGrids } from './fixtures/writeBack'
import type { WriteBackHarness } from './fixtures/writeBack'

const used = new Set<string>()

afterEach(async () => {
  await forgetCaches(used)
})

function gridsWithOwnerTabs(): ReturnType<typeof workbookGrids> {
  const grids = workbookGrids()
  return {
    ...grids,
    categories: [
      ['category', 'family', 'bucket', 'roles'],
      ['equipment', 'operating', 'operating', ''],
      ['ai-services', 'operating', 'operating', ''],
      ['revenue', 'income', 'income', 'revenue'],
      ['owner-loan-out', 'owner', 'owner-pay', 'owner-loan-out'],
      ['owner-loan-repaid', 'owner', 'owner-pay', 'owner-loan-repaid'],
    ],
    'owner-advances': withIds('advance', [
      ['date', 'amount', 'description', 'category'],
      [46200, 40, 'Printer paper', 'equipment'],
    ]),
  }
}

function loanCategory(store: WorkbookStore<CompanyBooks>, slug: string): CategoryRecord {
  return recordWithId(store.state.records!.categories, categoryIdOf({ slug }))!.record
}

/** The bucket of the loan categories set as the switch on Settings, General sets it. */
function switchLoans(store: WorkbookStore<CompanyBooks>, bucket: DefinedBucket, categories = ['owner-loan-out', 'owner-loan-repaid']) {
  const before = categories.map((slug) => loanCategory(store, slug))
  return store.write('Loans switched', (unit) => before.forEach((category) => unit.of(CATEGORY_WRITES).change(category, { ...category, bucket })))
}

const DESK = { date: civil('2026-10-10'), amount: euros(117.3), description: 'Desk lamp ', category: 'Equipment' }

/** An advance appended as Add advance appends it. */
function addAdvance(store: WorkbookStore<CompanyBooks>, draft: OwnerAdvanceDraft) {
  return store.write('Advance added', (unit) => unit.of(OWNER_ADVANCE_WRITES).add(ownerAdvanceOfDraft(draft, store.state.workbook!.categories)))
}

describe.each([
  ['a file on Drive', driveHarness],
  ['a workbook kept in this browser', browserHarness],
] as const)('owner writes to %s', (_name, harnessOf: (used: Set<string>, grids?: ReturnType<typeof workbookGrids>) => Promise<WriteBackHarness>) => {
  it('appends an advance that reads back as a cost in its category, and Undo clears it again', async () => {
    const { store } = await harnessOf(used, gridsWithOwnerTabs())

    const receipt = await addAdvance(store, DESK)

    expect(cellsOf(receipt, 'add')).toEqual([{ date: 46305, amount: 117.3, description: 'Desk lamp', category: 'equipment', id: AN_ID }])
    expect(store.state.workbook?.ownerAdvances.map((advance) => [advance.date, advance.amount, advance.category, advance.bucket])).toEqual([
      ['2026-06-27', euros(40), 'equipment', 'operating'],
      ['2026-10-10', euros(117.3), 'equipment', 'operating'],
    ])

    await store.undo(store.state.writes[0]!)

    expect(store.state.workbook?.ownerAdvances).toHaveLength(1)
    expect(store.state.workbook?.problems).toEqual([])
    const added = receipt!.records[0]!.change as { readonly after: OwnerAdvanceEntry }
    await expect(store.write('Removed', (unit) => unit.of(OWNER_ADVANCE_WRITES).remove(added.after))).rejects.toThrow('is no longer in the workbook')
  })

  it('changes an advance in place by its id, deletes it, and Undo of the delete brings it back with the same id', async () => {
    const { store } = await harnessOf(used, gridsWithOwnerTabs())
    const before = recordsOfKindIn(store.state.records!, OWNER_ADVANCE_RECORDS).records[0]!.record

    const changed = await store.write('Advance changed', (unit) =>
      unit
        .of(OWNER_ADVANCE_WRITES)
        .change(before, ownerAdvanceOfDraft({ date: before.date, amount: euros(42.5), description: 'Printer paper and toner ', category: 'ai-services' }, store.state.workbook!.categories, before)),
    )

    expect(cellsOf(changed, 'change')).toEqual([expect.objectContaining({ date: 46200, amount: 42.5, description: 'Printer paper and toner', category: 'ai-services' })])
    expect(store.state.workbook?.ownerAdvances.map((advance) => [advance.id, advance.amount, advance.category])).toEqual([[before.id, euros(42.5), 'ai-services']])

    const after = (changed!.records[0]!.change as { readonly after: OwnerAdvanceEntry }).after
    await store.write('Advance deleted', (unit) => unit.of(OWNER_ADVANCE_WRITES).remove(after))
    expect(store.state.workbook?.ownerAdvances).toEqual([])

    await store.undo(store.state.writes[0]!)
    expect(store.state.workbook?.ownerAdvances.map((advance) => [advance.id, advance.amount, advance.description])).toEqual([[before.id, euros(42.5), 'Printer paper and toner']])
  })

  it('refuses a negative amount, which is a private share and belongs on the splits tab', async () => {
    const { store } = await harnessOf(used, gridsWithOwnerTabs())

    await expect(addAdvance(store, { ...DESK, amount: euros(-12.8), description: 'Private share of the online order' })).rejects.toThrow('belongs on the splits tab')
    expect(store.state.workbook?.ownerAdvances.map((advance) => advance.amount)).toEqual([euros(40)])
  })

  it('refuses an advance in a category outside the operating and taxes buckets, and one the tab does not define', async () => {
    const { store } = await harnessOf(used, gridsWithOwnerTabs())

    await expect(addAdvance(store, { ...DESK, category: 'revenue' })).rejects.toThrow('an advance counts as an operating cost or a tax')
    await expect(addAdvance(store, { ...DESK, category: 'snacks' })).rejects.toThrow(WorkbookWriteRefused)
    await expect(addAdvance(store, { ...DESK, amount: euros(0) })).rejects.toThrow('the amount is zero')
    expect(store.state.workbook?.ownerAdvances).toHaveLength(1)
  })

  it('moves both loan categories between owner pay and financing, and refuses once a bucket changed since the read', async () => {
    const { store } = await harnessOf(used, gridsWithOwnerTabs())
    const stale = loanCategory(store, 'owner-loan-out')

    await switchLoans(store, 'financing')

    expect(store.state.workbook?.categories.filter((category) => category.slug.startsWith('owner-loan')).map((category) => category.bucket)).toEqual(['financing', 'financing'])
    await expect(store.write('Switched', (unit) => unit.of(CATEGORY_WRITES).change(stale, { ...stale, bucket: 'financing' }))).rejects.toThrow(
      'The category "owner-loan-out" changed since the app read it',
    )
  })

  it('lists an advance, its undo and the loan switch among the session writes, and undoes them from there', async () => {
    const { store } = await harnessOf(used, gridsWithOwnerTabs())
    await addAdvance(store, DESK)
    await switchLoans(store, 'financing')
    const [switched, added] = store.state.writes

    expect(store.state.writes.map((write) => write.receipt.records[0]!.change.kind.name)).toEqual(['category', 'hr-doo.owner-advance'])
    expect(canUndo(switched!, store.state.writes)).toBe(true)

    await store.undo(switched!)
    await store.undo(added!)

    expect(store.state.writes.map((write) => [canUndo(write, store.state.writes), wasUndone(write, store.state.writes)])).toEqual([
      [false, false],
      [false, false],
      [false, true],
      [false, true],
    ])
    expect(store.state.workbook?.categories.filter((category) => category.slug.startsWith('owner-loan')).map((category) => category.bucket)).toEqual(['owner-pay', 'owner-pay'])
    expect(store.state.workbook?.ownerAdvances).toHaveLength(1)
    await expect(store.undo(added!)).rejects.toThrow(WorkbookWriteRefused)
  })
})
