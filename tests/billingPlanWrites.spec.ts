import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { BILLING_WRITES, newBillingItem } from '../src/features/billingPlan/application/billingWrites'
import type { BillingItemDraft } from '../src/features/billingPlan/domain/fillRestOfYear'
import { canUndo, wasUndone } from '../src/features/workbook/application/createWorkbookStore'
import type { WorkbookStore } from '../src/features/workbook/application/createWorkbookStore'
import { WorkbookWriteRefused } from '../src/features/workbook/application/workbookWriteRefused'
import type { BillingItem } from '../src/features/workbook/domain/billingPlan'
import type { CellValue, WorkbookSnapshot } from '../src/features/workbook/infrastructure/workbookSnapshot'
import { civil, euros } from './fixtures/ledger'
import { cellsOf, recordOnRow } from './fixtures/recordWrites'
import { withIds } from './fixtures/rowIds'
import { AN_ID, cellData, dateFormat, excelHarness, forgetCaches, googleHarness, sentRequests, workbookGrids } from './fixtures/writeBack'
import type { WriteBackHarness } from './fixtures/writeBack'
import { recordIdOf } from '../src/features/workbook/domain/recordId'
import { BILLING_RECORDS } from '../src/features/workbook/domain/recordKind'

type Store = WorkbookStore<WorkbookSnapshot>

const used = new Set<string>()

afterEach(async () => {
  await forgetCaches(used)
})

/** Two plan rows, the second a formula's value. */
function gridsWithBillingPlan(): Record<string, CellValue[][]> {
  return {
    ...workbookGrids(),
    clients: [
      ['client', 'name', 'iban'],
      ['acme', 'Acme Studio', 'XX00FAKE0000000099'],
    ],
    'outgoing-plan': withIds('item', [
      ['item', 'date', 'amount', 'client', 'description'],
      ['Monthly Fee', 46295, 4000, 'acme', 'Sep 2026'],
      ['Bonus', 46300, 833.333333, 'acme', 'Bonus share'],
    ]),
  }
}

const OCTOBER_FEE: BillingItemDraft = { item: 'Monthly Fee', date: civil('2026-10-31'), amount: euros(4000), client: 'Acme', description: 'Oct 2026 ' }

function planRowAt(store: Store, sheetRow: number): BillingItem {
  return recordOnRow(store, BILLING_RECORDS, sheetRow)
}

function addRows(store: Store, added: readonly BillingItemDraft[]) {
  return store.write('Added', (unit) => added.forEach((draft) => unit.of(BILLING_WRITES).add(newBillingItem(draft))))
}

function changeRow(store: Store, change: { readonly before: BillingItem; readonly after: BillingItem }) {
  return store.write('Changed', (unit) => unit.of(BILLING_WRITES).change(change.before, change.after))
}

function removeRow(store: Store, row: BillingItem) {
  return store.write('Removed', (unit) => unit.of(BILLING_WRITES).remove(row))
}

function plan(store: Store): [string, string, number][] {
  return store.state.workbook?.billingPlan.map((row) => [row.item, row.date, row.amount]) ?? []
}

describe.each([
  ['a Google Sheet', googleHarness],
  ['a workbook kept in this browser', excelHarness],
] as const)('billing plan writes to %s', (_name, harnessOf: (used: Set<string>, grids?: Record<string, CellValue[][]>) => Promise<WriteBackHarness>) => {
  it('appends rows that read back as plan rows, and Undo clears them again', async () => {
    const { store } = await harnessOf(used, gridsWithBillingPlan())
    const november = { ...OCTOBER_FEE, date: civil('2026-11-30'), description: 'Nov 2026' }

    const receipt = await addRows(store, [OCTOBER_FEE, november])

    expect(cellsOf(receipt, 'add')).toEqual([
      { item: 'Monthly Fee', date: 46326, amount: 4000, client: 'acme', description: 'Oct 2026', id: AN_ID },
      { item: 'Monthly Fee', date: 46356, amount: 4000, client: 'acme', description: 'Nov 2026', id: AN_ID },
    ])
    expect(plan(store)).toEqual([
      ['Monthly Fee', '2026-09-30', euros(4000)],
      ['Bonus', '2026-10-05', euros(833.33)],
      ['Monthly Fee', '2026-10-31', euros(4000)],
      ['Monthly Fee', '2026-11-30', euros(4000)],
    ])

    const [added] = store.state.writes
    expect(added).toMatchObject({ receipt, undid: null })
    await store.undo(added!)

    expect(plan(store)).toHaveLength(2)
    expect(store.state.writes.map((write) => [cellsOf(write.receipt, 'remove').length, canUndo(write, store.state.writes), wasUndone(write, store.state.writes)])).toEqual([
      [2, false, false],
      [0, false, true],
    ])
    expect(store.state.workbook?.problems).toEqual([])
  })

  it('refuses a row whose client is not on the clients tab, or whose amount is not above zero, and writes none of them', async () => {
    const { store } = await harnessOf(used, gridsWithBillingPlan())

    await expect(addRows(store, [OCTOBER_FEE, { ...OCTOBER_FEE, client: 'globex' }])).rejects.toThrow('"globex" is not on the clients tab')
    await expect(addRows(store, [{ ...OCTOBER_FEE, amount: euros(0) }])).rejects.toThrow('amount must be more than zero')
    expect(plan(store)).toHaveLength(2)
    expect(store.state.writes).toEqual([])
  })

  it('changes only the cells that differ, keeps the row in place, and Undo puts back what it held', async () => {
    const { store } = await harnessOf(used, gridsWithBillingPlan())
    const before = planRowAt(store, 3)

    await changeRow(store, { before, after: { ...before, item: 'Yearly Bonus', description: '' } })

    expect(store.state.workbook?.billingPlan[1]).toMatchObject({ item: 'Yearly Bonus', amount: euros(833.33), description: '' })
    const [changed] = store.state.writes
    expect(changed).toMatchObject({ receipt: { records: [{ change: { verb: 'change', before } }] } })

    await store.undo(changed!)

    expect(store.state.workbook?.billingPlan[1]).toMatchObject({ item: 'Bonus', description: 'Bonus share' })
    expect(wasUndone(changed!, store.state.writes)).toBe(true)
  })

  it('refuses a change to a row that no longer holds what the app read', async () => {
    const { store } = await harnessOf(used, gridsWithBillingPlan())
    const before = planRowAt(store, 2)

    await changeRow(store, { before, after: { ...before, amount: euros(4100) } })

    await expect(changeRow(store, { before, after: { ...before, amount: euros(4200) } })).rejects.toThrow('changed since the app read it')
    expect(store.state.workbook?.billingPlan[0]?.amount).toBe(euros(4100))
  })

  it('deletes a row by taking it out, so the rows below move up, and Undo puts it back at the foot with its id', async () => {
    const { store } = await harnessOf(used, gridsWithBillingPlan())

    const receipt = await removeRow(store, planRowAt(store, 2))

    expect(cellsOf(receipt, 'remove')).toEqual([{ item: 'Monthly Fee', date: 46295, amount: 4000, client: 'acme', description: 'Sep 2026', id: 'item-2' }])
    expect(store.state.workbook?.billingPlan.map((row) => row.item)).toEqual(['Bonus'])
    await expect(removeRow(store, planRowAt(store, 2))).resolves.toBeDefined()
    expect(plan(store)).toEqual([])

    const deleted = store.state.writes.find((write) => write.receipt === receipt)
    await store.undo(deleted!)

    expect(store.state.workbook?.billingPlan.map((row) => [row.item, row.id])).toEqual([['Monthly Fee', recordIdOf(BILLING_RECORDS, 'item-2')]])
    expect(store.state.writes[0]).toMatchObject({ undid: receipt })
    await expect(store.undo(deleted!)).rejects.toThrow(WorkbookWriteRefused)
  })
})

describe('billing plan writes to a Google Sheet', () => {
  it('finds a row again by its id after rows were inserted above it, and refuses when copies hold its id', async () => {
    const { store, sheets, writtenRanges } = await googleHarness(used, gridsWithBillingPlan())
    const fee = planRowAt(store, 2)
    sheets.grids['outgoing-plan']!.splice(1, 0, ['Hotel', 46290, 120, 'acme', 'Inserted in the Sheet', 'hotel-id'])

    await removeRow(store, fee)

    expect(writtenRanges()).toEqual([])
    expect(sheets.grids['outgoing-plan']!.map((row) => row[4])).toEqual(['description', 'Inserted in the Sheet', 'Bonus share'])

    const bonus = sheets.grids['outgoing-plan']![2]!
    sheets.grids['outgoing-plan']!.push([...bonus], [...bonus])
    await expect(removeRow(store, planRowAt(store, 3))).rejects.toThrow('3 records hold the plan row "Bonus, acme, 2026-10-05, 833.333333", so the app cannot tell which one is meant.')
  })

  it('appends below the last row, the date as a serial number, with a new id under an id header the tab lacked', async () => {
    const { store, sheets } = await googleHarness(used, { ...gridsWithBillingPlan(), 'outgoing-plan': [['item', 'date', 'amount', 'client', 'description']] })

    await addRows(store, [OCTOBER_FEE])

    const sheetId = (await sheets.sheetGrids()).get('outgoing-plan')!.sheetId
    const added = sheets.grids['outgoing-plan']!.length - 1
    expect(sentRequests(sheets)).toEqual([
      { updateCells: { start: { sheetId, rowIndex: 0, columnIndex: 5 }, rows: [{ values: [cellData('id')] }], fields: 'userEnteredValue' } },
      {
        appendCells: {
          sheetId,
          rows: [{ values: [...['Monthly Fee', 46326, 4000, 'acme', 'Oct 2026'].map(cellData), { userEnteredValue: { stringValue: AN_ID } }] }],
          fields: 'userEnteredValue',
        },
      },
      dateFormat(sheetId, added, 1),
    ])
    expect(sheets.formats['outgoing-plan']?.[added]?.[1]).toBe('yyyy-mm-dd')
  })

  it('adds a grid column for the id header when the tab has none free', async () => {
    const { store, sheets } = await googleHarness(used, { ...gridsWithBillingPlan(), 'outgoing-plan': [['item', 'date', 'amount', 'client', 'description']] })
    sheets.columnCounts['outgoing-plan'] = 5

    await addRows(store, [OCTOBER_FEE])

    const sheetId = (await sheets.sheetGrids()).get('outgoing-plan')!.sheetId
    expect(sentRequests(sheets).slice(0, 2)).toEqual([
      { appendDimension: { sheetId, dimension: 'COLUMNS', length: 1 } },
      { updateCells: { start: { sheetId, rowIndex: 0, columnIndex: 5 }, rows: [{ values: [cellData('id')] }], fields: 'userEnteredValue' } },
    ])
    expect(sheets.columnCounts['outgoing-plan']).toBe(6)
    expect(sheets.grids['outgoing-plan']![1]).toEqual(['Monthly Fee', 46326, 4000, 'acme', 'Oct 2026', AN_ID])
  })

  it('appends every row of a fill in one request, so they land together or not at all', async () => {
    const { store, sheets } = await googleHarness(used, gridsWithBillingPlan())

    await addRows(store, [OCTOBER_FEE, { ...OCTOBER_FEE, date: civil('2026-11-30'), description: 'Nov 2026' }])

    const appends = sentRequests(sheets).flatMap((request) => ('appendCells' in request ? [request.appendCells] : []))
    expect(appends).toHaveLength(1)
    expect(appends[0]?.rows.map((row) => row.values[4])).toEqual([cellData('Oct 2026'), cellData('Nov 2026')])
  })

  it('writes one cell when one changes, and never the formula value of a cell left alone', async () => {
    const { store, writtenRanges } = await googleHarness(used, gridsWithBillingPlan())
    const bonus = planRowAt(store, 3)

    await changeRow(store, { before: bonus, after: { ...bonus, date: civil('2026-10-15') } })

    expect(writtenRanges()).toEqual(["'outgoing-plan'!B3"])
  })

  it('refuses every write to a Sheet without an outgoing-plan tab', async () => {
    const { 'outgoing-plan': _plan, ...withoutPlan } = gridsWithBillingPlan()
    const { store } = await googleHarness(used, withoutPlan)

    await expect(addRows(store, [OCTOBER_FEE])).rejects.toThrow('The workbook has no outgoing-plan tab')
  })
})
