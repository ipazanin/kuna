import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { WorkbookWriteRefused } from '../src/features/workbook/application/workbookWriter'
import { civil, euros } from './fixtures/ledger'
import { excelHarness, forgetCaches, googleHarness, workbookGrids } from './fixtures/writeBack'
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

const DESK = { date: civil('2026-10-10'), amount: euros(120.5), description: 'Desk lamp ', category: 'Equipment' }

describe.each([
  ['a Google Sheet', googleHarness],
  ['a workbook kept in this browser', excelHarness],
] as const)('owner writes to %s', (_name, harnessOf: (used: Set<string>, grids?: ReturnType<typeof workbookGrids>) => Promise<WriteBackHarness>) => {
  it('appends an advance that reads back as a cost in its category, and Undo clears it again', async () => {
    const { store } = await harnessOf(used, gridsWithOwnerTabs())

    const receipt = await store.addOwnerAdvance(DESK)

    expect(receipt).toEqual({ cells: { date: 46305, amount: 120.5, description: 'Desk lamp', category: 'equipment' }, sheetRow: 3 })
    expect(store.state.workbook?.ownerAdvances.map((advance) => [advance.date, advance.amount, advance.category, advance.bucket])).toEqual([
      ['2026-06-27', euros(40), 'equipment', 'operating'],
      ['2026-10-10', euros(120.5), 'equipment', 'operating'],
    ])

    await store.removeOwnerAdvance(receipt)

    expect(store.state.workbook?.ownerAdvances).toHaveLength(1)
    expect(store.state.workbook?.problems).toEqual([])
    await expect(store.removeOwnerAdvance(receipt)).rejects.toThrow('no longer on the owner-advances tab')
  })

  it('refuses an advance in a category outside the operating and taxes buckets, and one the tab does not define', async () => {
    const { store } = await harnessOf(used, gridsWithOwnerTabs())

    await expect(store.addOwnerAdvance({ ...DESK, category: 'revenue' })).rejects.toThrow('an advance counts as an operating cost or a tax')
    await expect(store.addOwnerAdvance({ ...DESK, category: 'snacks' })).rejects.toThrow(WorkbookWriteRefused)
    await expect(store.addOwnerAdvance({ ...DESK, amount: euros(0) })).rejects.toThrow('positive amount')
    expect(store.state.workbook?.ownerAdvances).toHaveLength(1)
  })

  it('moves both loan categories between owner pay and financing, and refuses once a bucket changed since the read', async () => {
    const { store } = await harnessOf(used, gridsWithOwnerTabs())
    const toFinancing = ['owner-loan-out', 'owner-loan-repaid'].map((category) => ({ category, expected: 'owner-pay' as const, bucket: 'financing' as const }))

    await store.changeBuckets(toFinancing)

    expect(store.state.workbook?.categories.filter((category) => category.slug.startsWith('owner-loan')).map((category) => category.bucket)).toEqual([
      'financing',
      'financing',
    ])
    await expect(store.changeBuckets(toFinancing)).rejects.toThrow('its bucket is now financing')
  })
})

describe('owner writes to a Google Sheet', () => {
  it('writes the date as a serial number and the bucket as one RAW cell, found by its header', async () => {
    const { store, sheets, writtenRanges } = await googleHarness(used, gridsWithOwnerTabs())

    await store.addOwnerAdvance(DESK)
    await store.changeBuckets([{ category: 'owner-loan-out', expected: 'owner-pay', bucket: 'financing' }])

    expect(sheets.requests.find((request) => request.kind === 'append')).toEqual({
      kind: 'append',
      range: "'owner-advances'!A:D",
      request: { valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS', values: [[46305, 120.5, 'Desk lamp', 'equipment']] },
    })
    expect(writtenRanges()).toEqual(['categories!C5'])
  })

  it('refuses an advance on a Sheet without an owner-advances tab, and a bucket for a category named twice', async () => {
    const grids = gridsWithOwnerTabs()
    const { 'owner-advances': _advances, ...withoutAdvances } = grids
    const { store } = await googleHarness(used, { ...withoutAdvances, categories: [...grids.categories!, ['owner-loan-out', 'owner', 'owner-pay', '']] })

    await expect(store.addOwnerAdvance(DESK)).rejects.toThrow('The Sheet has no owner-advances tab')
    await expect(store.changeBuckets([{ category: 'owner-loan-out', expected: 'owner-pay', bucket: 'financing' }])).rejects.toThrow('is on 2 rows')
  })
})
