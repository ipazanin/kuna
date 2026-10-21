import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { CATEGORY_ROWS } from '../src/features/settings/application/workbookTabRows'
import { OWNER_ADVANCE_ROWS, ownerAdvanceCellsOf } from '../src/features/workbook/application/ownerAdvanceRows'
import type { OwnerAdvanceDraft } from '../src/features/workbook/application/ownerAdvanceRows'
import { rowCellsOf } from '../src/features/workbook/application/tabRowWrites'
import { canUndo, wasUndone } from '../src/features/workbook/application/workbookStore'
import type { WorkbookStore } from '../src/features/workbook/application/workbookStore'
import { WorkbookWriteRefused } from '../src/features/workbook/application/workbookWriter'
import { civil, euros } from './fixtures/ledger'
import { cellData, excelHarness, forgetCaches, googleHarness, sentRequests, workbookGrids } from './fixtures/writeBack'
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
    'owner-advances': [
      ['date', 'amount', 'description', 'category'],
      [46200, 40, 'Printer paper', 'equipment'],
    ],
  }
}

/** The bucket cells of the loan categories set as the switch on Workbook, General sets them. */
function switchLoans(store: WorkbookStore, bucket: string, categories = ['owner-loan-out', 'owner-loan-repaid']) {
  const changed = categories.map((category) => {
    const row = store.state.snapshot!.categories.find((candidate) => candidate.cells.category === category)!
    const before = rowCellsOf(row, CATEGORY_ROWS.columns)
    return { sheetRow: row.sheetRow, before, after: { ...before, bucket } }
  })
  return store.changeRows(CATEGORY_ROWS, { added: [], changed, removed: [] })
}

const DESK = { date: civil('2026-10-10'), amount: euros(117.3), description: 'Desk lamp ', category: 'Equipment' }

/** An advance appended as Add advance appends it. */
function addAdvance(store: WorkbookStore, draft: OwnerAdvanceDraft) {
  return store.changeRows(OWNER_ADVANCE_ROWS, { added: [ownerAdvanceCellsOf(draft)], changed: [], removed: [] })
}

describe.each([
  ['a Google Sheet', googleHarness],
  ['a workbook kept in this browser', excelHarness],
] as const)('owner writes to %s', (_name, harnessOf: (used: Set<string>, grids?: ReturnType<typeof workbookGrids>) => Promise<WriteBackHarness>) => {
  it('appends an advance that reads back as a cost in its category, and Undo clears it again', async () => {
    const { store } = await harnessOf(used, gridsWithOwnerTabs())

    const receipt = await addAdvance(store, DESK)

    expect(receipt?.added).toEqual([{ sheetRow: 3, cells: { date: 46305, amount: 117.3, description: 'Desk lamp', category: 'equipment' } }])
    expect(store.state.workbook?.ownerAdvances.map((advance) => [advance.date, advance.amount, advance.category, advance.bucket])).toEqual([
      ['2026-06-27', euros(40), 'equipment', 'operating'],
      ['2026-10-10', euros(117.3), 'equipment', 'operating'],
    ])

    await store.undo(store.state.writes[0]!)

    expect(store.state.workbook?.ownerAdvances).toHaveLength(1)
    expect(store.state.workbook?.problems).toEqual([])
    await expect(store.changeRows(OWNER_ADVANCE_ROWS, { added: [], changed: [], removed: receipt!.added })).rejects.toThrow('is no longer on the owner-advances tab')
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
    const stale = store.state.snapshot!.categories.find((row) => row.cells.category === 'owner-loan-out')!

    await switchLoans(store, 'financing')

    expect(store.state.workbook?.categories.filter((category) => category.slug.startsWith('owner-loan')).map((category) => category.bucket)).toEqual([
      'financing',
      'financing',
    ])
    const before = rowCellsOf(stale, CATEGORY_ROWS.columns)
    await expect(
      store.changeRows(CATEGORY_ROWS, { added: [], changed: [{ sheetRow: stale.sheetRow, before, after: { ...before, bucket: 'financing' } }], removed: [] }),
    ).rejects.toThrow('The category "owner-loan-out" is no longer on the categories tab as the app read it')
  })

  it('lists an advance, its undo and the loan switch among the session writes, and undoes them from there', async () => {
    const { store } = await harnessOf(used, gridsWithOwnerTabs())
    await addAdvance(store, DESK)
    await switchLoans(store, 'financing')
    const [switched, added] = store.state.writes

    expect(store.state.writes.map((write) => (write.kind === 'rows' ? write.rules.tab : write.kind))).toEqual(['categories', 'owner-advances'])
    expect(canUndo(switched!, store.state.writes)).toBe(true)

    await store.undo(switched!)
    await store.undo(added!)

    expect(store.state.writes.map((write) => [canUndo(write, store.state.writes), wasUndone(write, store.state.writes)])).toEqual([
      [false, false],
      [false, false],
      [false, true],
      [false, true],
    ])
    expect(store.state.workbook?.categories.filter((category) => category.slug.startsWith('owner-loan')).map((category) => category.bucket)).toEqual([
      'owner-pay',
      'owner-pay',
    ])
    expect(store.state.workbook?.ownerAdvances).toHaveLength(1)
    await expect(store.undo(added!)).rejects.toThrow(WorkbookWriteRefused)
  })
})

describe('owner writes to a Google Sheet', () => {
  it('finds a loan category again after a row was inserted above it in the Sheet', async () => {
    const { store, sheets, writtenRanges } = await googleHarness(used, gridsWithOwnerTabs())
    sheets.grids.categories!.splice(1, 0, ['travel', 'operating', 'operating', ''])

    await switchLoans(store, 'financing', ['owner-loan-out'])

    expect(writtenRanges()).toEqual(['categories!C6'])
  })

  it('writes the date as a serial number and the bucket as one cell, found by its header', async () => {
    const { store, sheets, writtenRanges } = await googleHarness(used, gridsWithOwnerTabs())

    await addAdvance(store, DESK)
    await switchLoans(store, 'financing', ['owner-loan-out'])

    expect(sentRequests(sheets).find((request) => 'appendCells' in request)).toEqual({
      appendCells: { sheetId: (await sheets.sheetIds()).get('owner-advances'), rows: [{ values: [46305, 117.3, 'Desk lamp', 'equipment'].map(cellData) }], fields: 'userEnteredValue' },
    })
    expect(writtenRanges()).toEqual(['categories!C5'])
  })

  it('refuses an advance on a Sheet without an owner-advances tab, and a bucket for a category row that two rows match', async () => {
    const grids = gridsWithOwnerTabs()
    const { 'owner-advances': _advances, ...withoutAdvances } = grids
    const { store, sheets } = await googleHarness(used, withoutAdvances)
    sheets.grids.categories!.splice(1, 0, ['travel', 'operating', 'operating', ''])
    sheets.grids.categories!.push(['owner-loan-out', 'owner', 'owner-pay', 'owner-loan-out'])

    await expect(addAdvance(store, DESK)).rejects.toThrow('The workbook has no owner-advances tab')
    await expect(switchLoans(store, 'financing', ['owner-loan-out'])).rejects.toThrow('2 rows of the categories tab hold the category "owner-loan-out"')
  })
})
