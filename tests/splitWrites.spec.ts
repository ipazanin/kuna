import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { writeSplit as writeSplitParts } from '../src/apps/company/transactions/application/splitWrites'
import { WorkbookWriteRefused } from '../src/shared/storage/application/workbookWriteRefused'
import { recordWithId } from '../src/shared/storage/domain/recordsRead'
import type { SplitTabRow } from '../src/apps/company/workbook/domain/splitsReading'
import type { Transaction } from '../src/apps/company/workbook/domain/workbook'
import type { WorkbookStore } from '../src/shared/storage/application/createWorkbookStore'
import type { CompanyBooks } from '../src/apps/company/workbook/domain/readWorkbook'
import type { CellValue } from '../src/apps/company/workbook/infrastructure/workbookSnapshot'
import { cellsOf } from './fixtures/recordWrites'
import { euros } from './fixtures/ledger'
import { AN_ID, browserHarness, forgetCaches, driveHarness, workbookGrids } from './fixtures/writeBack'
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

function rowOf(store: WorkbookStore<CompanyBooks>, counterparty: string): Transaction {
  return store.state.workbook!.transactions.find((row) => row.counterparty === counterparty)!
}

/** The parts the row's split holds, larger first, as the split editor reads them. */
function currentParts(store: WorkbookStore<CompanyBooks>, row: Transaction): SplitTabRow[] {
  const split = store.state.workbook!.splits.find((candidate) => candidate.row.id === row.id)
  return (split?.parts ?? []).map((part) => recordWithId(store.state.records!.splits, part.id)!.record)
}

function writeSplit(store: WorkbookStore<CompanyBooks>, row: Transaction, parts: readonly (readonly [number, string, string?])[]) {
  const current = currentParts(store, row)
  const drafts = parts.map(([amount, category, note = ''], index) => ({ amount: euros(amount), category, note, opened: current[index] ?? null }))
  return store.write('Split', (unit) => writeSplitParts(unit, row, current, drafts, store.state.workbook!.categories))
}

describe.each([
  ['a file on Drive', driveHarness],
  ['a workbook kept in this browser', browserHarness],
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
    expect(store.state.records?.splits).toEqual({ records: [], refused: [] })
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
    expect(store.state.records?.splits).toEqual({ records: [], refused: [] })
  })
})
