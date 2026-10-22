import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { SPLIT_ROWS, splitCellsOf, splitRowsChange } from '../src/features/transactions/application/splitRows'
import { rowCellsOf } from '../src/features/workbook/application/tabRowWrites'
import { WorkbookWriteRefused } from '../src/features/workbook/application/workbookWriteRefused'
import type { RowCells } from '../src/features/workbook/domain/rowChanges'
import type { Transaction } from '../src/features/workbook/domain/workbook'
import type { WorkbookStore } from '../src/features/workbook/application/workbookStore'
import type { CellValue } from '../src/features/workbook/infrastructure/workbookSnapshot'
import { euros } from './fixtures/ledger'
import { AN_ID, dateFormat, excelHarness, forgetCaches, googleHarness, sentRequests, workbookGrids } from './fixtures/writeBack'
import { withIds } from './fixtures/rowIds'
import type { WriteBackHarness } from './fixtures/writeBack'

const used = new Set<string>()

afterEach(async () => {
  await forgetCaches(used)
})

const SPLIT_HEADER: CellValue[] = ['date', 'account', 'row_amount', 'row_balance', 'amount', 'category', 'note']

function grids(withSplitsTab = true): Record<string, CellValue[][]> {
  return {
    ...workbookGrids(),
    categories: [
      ['category', 'family', 'bucket', 'roles'],
      ['equipment', 'operating', 'operating', 'capital-purchase'],
      ['ai-services', 'operating', 'operating', ''],
      ['revenue', 'income', 'income', 'revenue'],
      ['owner-loan-out', 'owner', 'owner-pay', 'owner-loan-out'],
    ],
    assets: withIds('asset', [
      ['asset', 'bought', 'cost_net', 'group', 'ledger_reference'],
      ['Desk', 46298, 80, 'equipment', 'Desk'],
    ]),
    ...(withSplitsTab ? { splits: [SPLIT_HEADER] } : {}),
  }
}

function rowOf(store: WorkbookStore, counterparty: string): Transaction {
  return store.state.workbook!.transactions.find((row) => row.counterparty === counterparty)!
}

function currentRows(store: WorkbookStore): RowCells[] {
  return store.state.snapshot!.splits.map((row) => rowCellsOf(row, SPLIT_ROWS))
}

function writeSplit(store: WorkbookStore, row: Transaction, parts: readonly (readonly [number, string, string?])[], addMissingTab = false) {
  const drafts = parts.map(([amount, category, note = '']) => ({ amount: euros(amount), category, note }))
  return store.changeRows(SPLIT_ROWS, splitRowsChange(row, currentRows(store), drafts), addMissingTab)
}

describe.each([
  ['a Google Sheet', googleHarness],
  ['a workbook kept in this browser', excelHarness],
] as const)('split writes to %s', (_name, harnessOf: (used: Set<string>, grids?: Record<string, CellValue[][]>) => Promise<WriteBackHarness>) => {
  it('adds a split whose parts read back in the row’s place, and Undo takes it back', async () => {
    const { store } = await harnessOf(used, grids())
    const model = rowOf(store, 'MODEL API INC')

    const receipt = await writeSplit(store, model, [[-12, 'ai-services', 'Seats'], [-8, 'owner-loan-out', 'The owner’s seat']])

    expect(receipt?.added).toEqual([
      { date: 46299, account: 'main', row_amount: -20, row_balance: 1038.9, amount: -12, category: 'ai-services', note: 'Seats', id: AN_ID },
      { date: 46299, account: 'main', row_amount: -20, row_balance: 1038.9, amount: -8, category: 'owner-loan-out', note: 'The owner’s seat', id: AN_ID },
    ])
    expect(store.state.workbook?.splits.map((split) => [split.row.id, split.parts.map((part) => [part.amount, part.category])])).toEqual([
      [
        model.id,
        [
          [euros(-12), 'ai-services'],
          [euros(-8), 'owner-loan-out'],
        ],
      ],
    ])

    await store.undo(store.state.writes[0]!)

    expect(store.state.workbook?.splits).toEqual([])
    expect(store.state.snapshot?.splits).toEqual([])
  })

  it('edits a split in place, adding and dropping parts, and deletes it', async () => {
    const { store } = await harnessOf(used, grids())
    const model = rowOf(store, 'MODEL API INC')
    await writeSplit(store, model, [[-12, 'ai-services'], [-8, 'owner-loan-out']])

    const edited = await writeSplit(store, model, [[-10, 'ai-services', 'Seats'], [-6, 'owner-loan-out'], [-4, 'equipment', 'A cable']])

    expect(edited?.changed.map((change) => [change.after.category, change.after.amount, change.after.note])).toEqual([['ai-services', -10, 'Seats'], ['owner-loan-out', -6, '']])
    expect(store.state.workbook?.splits[0]?.parts.map((part) => [part.amount, part.category, part.note])).toEqual([
      [euros(-10), 'ai-services', 'Seats'],
      [euros(-6), 'owner-loan-out', ''],
      [euros(-4), 'equipment', 'A cable'],
    ])

    await writeSplit(store, model, [[-14, 'ai-services'], [-6, 'owner-loan-out']])
    expect(store.state.workbook?.splits[0]?.parts.map((part) => part.amount)).toEqual([euros(-14), euros(-6)])

    await store.changeRows(SPLIT_ROWS, { added: [], changed: [], removed: currentRows(store) })
    expect(store.state.workbook?.splits).toEqual([])
    await store.undo(store.state.writes[0]!)
    expect(store.state.workbook?.splits[0]?.parts.map((part) => part.amount)).toEqual([euros(-14), euros(-6)])
  })

  it('refuses parts that do not add up to the row, and a split of a row an asset claims', async () => {
    const { store } = await harnessOf(used, grids())

    await expect(writeSplit(store, rowOf(store, 'MODEL API INC'), [[-12, 'ai-services'], [-6, 'owner-loan-out']])).rejects.toThrow(
      'the parts add up to -18.00 and the row is -20.00',
    )
    await expect(writeSplit(store, rowOf(store, 'Desk Co'), [[-80, 'equipment'], [-20, 'ai-services']])).rejects.toThrow(
      '"Desk" on the assets tab claims the main row of 2026-10-03 for -100.00 as payment, so the row stays whole.',
    )
    await expect(writeSplit(store, rowOf(store, 'MODEL API INC'), [[-12, 'ai-services'], [-8, 'snacks']])).rejects.toThrow(WorkbookWriteRefused)
    expect(store.state.snapshot?.splits).toEqual([])
  })
})

describe('split writes to a Google Sheet', () => {
  it('adds the splits tab with the template’s header first when the person agreed', async () => {
    const { store, sheets } = await googleHarness(used, grids(false))

    await expect(writeSplit(store, rowOf(store, 'MODEL API INC'), [[-12, 'ai-services'], [-8, 'owner-loan-out']])).rejects.toThrow('The workbook has no splits tab')
    await writeSplit(store, rowOf(store, 'MODEL API INC'), [[-12, 'ai-services'], [-8, 'owner-loan-out']], true)

    const splits = (await sheets.sheetGrids()).get('splits')!.sheetId
    expect(sentRequests(sheets).map((request) => Object.keys(request)[0])).toEqual(['addSheet', 'updateCells', 'appendCells', 'repeatCell'])
    expect(sentRequests(sheets)[3]).toEqual(dateFormat(splits, 1, 0, 2))
    expect(sentRequests(sheets)[0]).toEqual({ addSheet: { properties: { sheetId: splits, title: 'splits' } } })
    expect(sentRequests(sheets)[2]).toMatchObject({ appendCells: { sheetId: splits } })
    expect(sheets.grids.splits?.[0]).toEqual([...SPLIT_HEADER, 'id'])
    expect(store.state.workbook?.splits).toHaveLength(1)
  })

  it('writes each part as a date serial and plain numbers, the key copied from the row', () => {
    const row = { date: '2026-10-07', account: 'main', amount: euros(-20), balance: euros(1038.9) } as Pick<Transaction, 'date' | 'account' | 'amount' | 'balance'>

    expect(splitCellsOf(row, { amount: euros(-8), category: 'owner-loan-out', note: ' Seat ' })).toEqual({
      date: 46302,
      account: 'main',
      row_amount: -20,
      row_balance: 1038.9,
      amount: -8,
      category: 'owner-loan-out',
      note: 'Seat',
    })
  })
})
