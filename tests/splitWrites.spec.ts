import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { writeSplit as writeSplitParts } from '../src/features/transactions/application/splitWrites'
import { WorkbookWriteRefused } from '../src/features/workbook/application/workbookWriteRefused'
import { recordWithId } from '../src/features/workbook/domain/recordsRead'
import type { SplitTabRow } from '../src/features/workbook/domain/splitsReading'
import type { Transaction } from '../src/features/workbook/domain/workbook'
import type { WorkbookStore } from '../src/features/workbook/application/createWorkbookStore'
import type { WorkbookCopy } from '../src/features/workbook/application/workbookPorts'
import type { CellValue } from '../src/features/workbook/infrastructure/workbookSnapshot'
import { cellsOf } from './fixtures/recordWrites'
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

function rowOf(store: WorkbookStore<WorkbookCopy>, counterparty: string): Transaction {
  return store.state.workbook!.transactions.find((row) => row.counterparty === counterparty)!
}

/** The parts the row's split holds, larger first, as the split editor reads them. */
function currentParts(store: WorkbookStore<WorkbookCopy>, row: Transaction): SplitTabRow[] {
  const split = store.state.workbook!.splits.find((candidate) => candidate.row.id === row.id)
  return (split?.parts ?? []).map((part) => recordWithId(store.state.records!.splits, part.id)!.record)
}

function writeSplit(store: WorkbookStore<WorkbookCopy>, row: Transaction, parts: readonly (readonly [number, string, string?])[], addMissingKinds = false) {
  const drafts = parts.map(([amount, category, note = '']) => ({ amount: euros(amount), category, note }))
  const current = currentParts(store, row)
  return store.write('Split', (unit) => writeSplitParts(unit, row, current, drafts), { addMissingKinds })
}

describe.each([
  ['a Google Sheet', googleHarness],
  ['a workbook kept in this browser', excelHarness],
] as const)('split writes to %s', (_name, harnessOf: (used: Set<string>, grids?: Record<string, CellValue[][]>) => Promise<WriteBackHarness>) => {
  it('adds a split whose parts read back in the row’s place, and Undo takes it back', async () => {
    const { store } = await harnessOf(used, grids())
    const model = rowOf(store, 'MODEL API INC')

    const receipt = await writeSplit(store, model, [[-12, 'ai-services', 'Seats'], [-8, 'owner-loan-out', 'The owner’s seat']])

    expect(cellsOf(receipt, 'add')).toEqual([
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

    expect(cellsOf(edited, 'change').map((cells) => [cells.category, cells.amount, cells.note ?? ''])).toEqual([['ai-services', -10, 'Seats'], ['owner-loan-out', -6, '']])
    expect(store.state.workbook?.splits[0]?.parts.map((part) => [part.amount, part.category, part.note])).toEqual([
      [euros(-10), 'ai-services', 'Seats'],
      [euros(-6), 'owner-loan-out', ''],
      [euros(-4), 'equipment', 'A cable'],
    ])

    await writeSplit(store, model, [[-14, 'ai-services'], [-6, 'owner-loan-out']])
    expect(store.state.workbook?.splits[0]?.parts.map((part) => part.amount)).toEqual([euros(-14), euros(-6)])

    await writeSplit(store, model, [])
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
      'The main row of 2026-10-03 for -100.00 stays whole, since the asset "Desk" claims it as payment.',
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
})
