import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { SPLIT_WRITES, removeSplit, writeSplit as writeSplitParts } from '../src/apps/company/transactions/application/splitWrites'
import { canUndo } from '../src/shared/storage/application/createWorkbookStore'
import { WorkbookWriteRefused } from '../src/shared/storage/application/workbookWriteRefused'
import { storedSplitOf } from '../src/apps/company/workbook/domain/rowItems'
import type { Transaction } from '../src/apps/company/workbook/domain/workbook'
import { SPLIT_PART_RECORDS } from '../src/apps/company/workbook/domain/coreKinds'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { ownerShareOf } from '../src/apps/company/owner-share/domain/ownerShare'
import type { StoredItem } from '../src/apps/company/workbook/domain/splits'
import { recordWithId } from '../src/shared/storage/domain/recordsRead'
import type { PartReplacement } from '../src/shared/categorising/domain/partReplacements'
import type { RecordId } from '../src/shared/storage/domain/recordId'
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

function writeSplit(store: WorkbookStore<CompanyBooks>, row: Transaction, parts: readonly (readonly [number, string, string?])[]) {
  const stored = storedSplitOf(store.state.records!, store.state.workbook!, row)
  const drafts = parts.map(([amount, category, note = ''], index) => ({ amount: euros(amount), category, note, opened: stored.parts[index] ?? null }))
  return store.write('Split', (unit) => writeSplitParts(unit, store.state.records!, row, stored, drafts, store.state.workbook!.categories))
}

describe.each([
  ['a file on Drive', driveHarness],
  ['a workbook kept in this browser', browserHarness],
] as const)('split writes to %s', (_name, harnessOf: (used: Set<string>, grids?: Record<string, CellValue[][]>) => Promise<WriteBackHarness>) => {
  it('adds a split whose parts read back in the row’s place, and Undo takes it back', async () => {
    const { store } = await harnessOf(used, grids())
    const model = rowOf(store, 'MODEL API INC')

    const receipt = await writeSplit(store, model, [
      [-12, 'ai-services', 'Seats'],
      [-8, 'owner-loan-out', 'The owner’s seat'],
    ])

    expect(cellsOf(receipt, 'add')).toEqual([
      { date: 46299, account: 'main', row_amount: -20, row_balance: 1038.9, row_id: model.rowId, amount: -12, category: 'ai-services', note: 'Seats', id: AN_ID },
      { date: 46299, account: 'main', row_amount: -20, row_balance: 1038.9, row_id: model.rowId, amount: -8, category: 'owner-loan-out', note: 'The owner’s seat', id: AN_ID },
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
    await writeSplit(store, model, [
      [-12, 'ai-services'],
      [-8, 'owner-loan-out'],
    ])

    const edited = await writeSplit(store, model, [
      [-10, 'ai-services', 'Seats'],
      [-6, 'owner-loan-out'],
      [-4, 'equipment', 'A cable'],
    ])

    expect(cellsOf(edited, 'change').map((cells) => [cells.category, cells.amount, cells.note ?? ''])).toEqual([
      ['ai-services', -10, 'Seats'],
      ['owner-loan-out', -6, ''],
    ])
    expect(store.state.workbook?.splits[0]?.parts.map((part) => [part.amount, part.category, part.note])).toEqual([
      [euros(-10), 'ai-services', 'Seats'],
      [euros(-6), 'owner-loan-out', ''],
      [euros(-4), 'equipment', 'A cable'],
    ])

    await writeSplit(store, model, [
      [-14, 'ai-services'],
      [-6, 'owner-loan-out'],
    ])
    expect(store.state.workbook?.splits[0]?.parts.map((part) => part.amount)).toEqual([euros(-14), euros(-6)])

    await writeSplit(store, model, [])
    expect(store.state.workbook?.splits).toEqual([])
    await store.undo(store.state.writes[0]!)
    expect(store.state.workbook?.splits[0]?.parts.map((part) => part.amount)).toEqual([euros(-14), euros(-6)])
  })

  it('refuses parts that do not add up to the row, and a split of a row an asset claims', async () => {
    const { store } = await harnessOf(used, grids())

    await expect(
      writeSplit(store, rowOf(store, 'MODEL API INC'), [
        [-12, 'ai-services'],
        [-6, 'owner-loan-out'],
      ]),
    ).rejects.toThrow('the parts add up to -18.00 and the row is -20.00')
    await expect(
      writeSplit(store, rowOf(store, 'Desk Co'), [
        [-80, 'equipment'],
        [-20, 'ai-services'],
      ]),
    ).rejects.toThrow('The main row of 2026-10-03 for -100.00 stays whole, since the asset "Desk" claims it as payment.')
    await expect(
      writeSplit(store, rowOf(store, 'MODEL API INC'), [
        [-12, 'ai-services'],
        [-8, 'snacks'],
      ]),
    ).rejects.toThrow(WorkbookWriteRefused)
    expect(store.state.records?.splits).toEqual({ records: [], refused: [] })
  })

  it('replaces the parts of a split the guards refused, so the row splits again with only the new parts', async () => {
    const { store } = await harnessOf(used, {
      ...grids(),
      splits: withIds('split', [SPLIT_HEADER, [46299, 'main', -20, 1038.9, -12, 'ai-services', 'Seats'], [46299, 'main', -20, 1038.9, -6, 'owner-loan-out', '']]),
    })
    const model = rowOf(store, 'MODEL API INC')
    expect(store.state.workbook?.splits).toEqual([])

    await writeSplit(store, model, [
      [-14, 'ai-services', 'Seats'],
      [-6, 'owner-loan-out'],
    ])

    expect(store.state.records?.splits.records.map(({ record }) => [record.amount, record.category, record.note])).toEqual([
      [euros(-14), 'ai-services', 'Seats'],
      [euros(-6), 'owner-loan-out', ''],
    ])
    expect(store.state.workbook?.splits.map((split) => [split.row.id, split.parts.map((part) => part.amount)])).toEqual([[model.id, [euros(-14), euros(-6)]]])

    expect(canUndo(store.state.writes[0]!, store.state.writes)).toBe(false)
  })

  it('names the stored parts that cannot be read, which keep a split of the row from counting', async () => {
    const { store } = await harnessOf(used, {
      ...grids(),
      splits: withIds('split', [SPLIT_HEADER, [46299, 'main', -20, 1038.9, -14, 'ai-services', ''], [46299, 'main', -20, 1038.9, 'six', 'owner-loan-out', '']]),
    })
    const model = rowOf(store, 'MODEL API INC')

    const stored = storedSplitOf(store.state.records!, store.state.workbook!, model)

    expect([stored.parts.map((part) => part.amount), stored.refused, stored.unreadable]).toEqual([[euros(-14)], true, 1])
    expect(storedSplitOf(store.state.records!, store.state.workbook!, rowOf(store, 'Desk Co'))).toEqual({ parts: [], refused: false, unreadable: 0 })
  })
})

describe('which split part keeps its id', () => {
  /** Writes the parts, each opened from the stored part it names, and gives what each part replaces. */
  async function writeOpened(store: WorkbookStore<CompanyBooks>, row: Transaction, parts: readonly (readonly [number, string, RecordId | null])[]): Promise<readonly PartReplacement<RecordId>[]> {
    const stored = storedSplitOf(store.state.records!, store.state.workbook!, row)
    const opened = (id: RecordId | null): StoredItem | null => stored.parts.find((part) => part.id === id) ?? null
    const drafts = parts.map(([amount, category, id]) => ({ amount: euros(amount), category, note: '', opened: opened(id) }))
    let replaced: readonly PartReplacement<RecordId>[] = []
    await store.write('Split', (unit) => (replaced = writeSplitParts(unit, store.state.records!, row, stored, drafts, store.state.workbook!.categories)))
    return replaced
  }
  const partsOf = (store: WorkbookStore<CompanyBooks>, row: Transaction) => store.state.workbook!.splits.find((split) => split.row.id === row.id)?.parts ?? []

  it('gives the first part of a row not yet split the id of the part the row stood for, and the others replace it', async () => {
    const { store } = await browserHarness(used, grids())
    const model = rowOf(store, 'MODEL API INC')
    const whole = recordIdOf(SPLIT_PART_RECORDS, model.rowId!)

    const replaced = await writeOpened(store, model, [
      [-8, 'owner-loan-out', null],
      [-12, 'ai-services', null],
    ])

    const [larger, smaller] = partsOf(store, model)
    expect(smaller!.id).toBe(whole)
    expect(whole).toBe(`split-part:${model.rowId}`)
    expect(replaced).toEqual([{ part: larger!.id, replaces: [whole] }])
  })

  it('keeps the id of a part it was opened from when it changes amount and category, though the parts then sort the other way', async () => {
    const { store } = await browserHarness(used, grids())
    const model = rowOf(store, 'MODEL API INC')
    await writeOpened(store, model, [
      [-12, 'ai-services', null],
      [-8, 'owner-loan-out', null],
    ])
    const [seats, owners] = partsOf(store, model)

    const replaced = await writeOpened(store, model, [
      [-5, 'equipment', seats!.id],
      [-15, 'owner-loan-out', owners!.id],
    ])

    expect(partsOf(store, model).map((part) => [part.id, part.amount, part.category])).toEqual([
      [owners!.id, euros(-15), 'owner-loan-out'],
      [seats!.id, euros(-5), 'equipment'],
    ])
    expect(replaced).toEqual([{ part: owners!.id, replaces: [seats!.id] }])
  })

  it('lets a new part replace the parts the write removed or made smaller', async () => {
    const { store } = await browserHarness(used, grids())
    const model = rowOf(store, 'MODEL API INC')
    await writeOpened(store, model, [
      [-10, 'ai-services', null],
      [-6, 'owner-loan-out', null],
      [-4, 'equipment', null],
    ])
    const [seats, owners, cable] = partsOf(store, model)

    const replaced = await writeOpened(store, model, [
      [-10, 'ai-services', seats!.id],
      [-3, 'owner-loan-out', owners!.id],
      [-7, 'equipment', null],
    ])

    const added = partsOf(store, model).find((part) => ![seats!.id, owners!.id].includes(part.id))!
    expect(replaced).toEqual([{ part: added.id, replaces: [owners!.id, cable!.id] }])
  })

  it('leaves the row as the one part it stands for when the split comes off, which replaces every part it had', async () => {
    const { store } = await browserHarness(used, grids())
    const model = rowOf(store, 'MODEL API INC')
    await writeOpened(store, model, [
      [-12, 'ai-services', null],
      [-8, 'owner-loan-out', null],
    ])
    const [seats, owners] = partsOf(store, model)

    const replaced = await writeOpened(store, model, [])

    expect(partsOf(store, model)).toEqual([])
    expect(seats!.id).toBe(recordIdOf(SPLIT_PART_RECORDS, model.rowId!))
    expect(replaced).toEqual([{ part: recordIdOf(SPLIT_PART_RECORDS, model.rowId!), replaces: [owners!.id] }])
  })
})

describe('a split taken off', () => {
  async function splitModel(parts: readonly (readonly [number, string])[]) {
    const { store } = await browserHarness(used, grids())
    await writeSplit(store, rowOf(store, 'MODEL API INC'), parts)
    const remove = () => {
      const row = rowOf(store, 'MODEL API INC')
      const stored = storedSplitOf(store.state.records!, store.state.workbook!, row)
      return store.write('Removed', (unit) => removeSplit(unit, { records: store.state.records!, workbook: store.state.workbook! }, row, stored))
    }
    return { store, remove }
  }

  it('files the row whole under the category most of its money was in, by the person, and Undo puts the split and the category back', async () => {
    const { store, remove } = await splitModel([
      [-8, 'ai-services'],
      [-12, 'owner-loan-out'],
    ])

    const written = await remove()

    expect(store.state.workbook!.splits).toEqual([])
    expect(rowOf(store, 'MODEL API INC')).toMatchObject({ category: 'owner-loan-out', flaggedBy: store.state.workbook!.settings.reviewLabel })
    await store.undo(store.state.writes.find((write) => write.receipt === written)!)
    expect(rowOf(store, 'MODEL API INC')).toMatchObject({ category: 'ai-services', flaggedBy: 'ai' })
    expect(store.state.workbook!.splits[0]?.parts.map((part) => part.category)).toEqual(['owner-loan-out', 'ai-services'])
  })

  it("takes the owner share of the part whose category it takes, not the category's default", async () => {
    const { store, remove } = await splitModel([
      [-8, 'ai-services'],
      [-12, 'owner-loan-out'],
    ])
    const row = rowOf(store, 'MODEL API INC')
    const stored = storedSplitOf(store.state.records!, store.state.workbook!, row)
    const larger = recordWithId(store.state.records!.splits, stored.parts.find((part) => part.category === 'owner-loan-out')!.id)!.record
    await store.write('Shared', (unit) => unit.of(SPLIT_WRITES).change(larger, { ...larger, ownerShare: ownerShareOf(30) }))

    await remove()

    expect(rowOf(store, 'MODEL API INC')).toMatchObject({ category: 'owner-loan-out', ownerShare: 30 })
  })

  it('takes the category of the first part in part order on a tie, and adds up the parts of one category first', async () => {
    const tie = await splitModel([
      [-10, 'owner-loan-out'],
      [-10, 'equipment'],
    ])
    await tie.remove()
    expect(rowOf(tie.store, 'MODEL API INC').category).toBe('equipment')

    const summed = await splitModel([
      [-9, 'owner-loan-out'],
      [-6, 'equipment'],
      [-5, 'equipment'],
    ])
    await summed.remove()
    expect(rowOf(summed.store, 'MODEL API INC').category).toBe('equipment')
  })

  it('leaves the row as it was when most of the money was already in its category', async () => {
    const { store, remove } = await splitModel([
      [-15, 'ai-services'],
      [-5, 'owner-loan-out'],
    ])

    const written = await remove()

    expect(rowOf(store, 'MODEL API INC')).toMatchObject({ category: 'ai-services', flaggedBy: 'ai' })
    expect(cellsOf(written, 'change')).toEqual([])
  })
})
