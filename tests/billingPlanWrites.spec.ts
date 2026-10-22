import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { BILLING_PLAN_ROWS, billingCellsOf } from '../src/features/billingPlan/application/billingPlanRows'
import { rowCellsOf } from '../src/features/workbook/application/tabRowWrites'
import { canUndo, wasUndone } from '../src/features/workbook/application/workbookStore'
import type { WorkbookStore } from '../src/features/workbook/application/workbookStore'
import { WorkbookWriteRefused } from '../src/features/workbook/application/workbookWriter'
import type { RowAt, RowCells, RowChange } from '../src/features/workbook/domain/rowChanges'
import type { CellValue } from '../src/features/workbook/infrastructure/workbookSnapshot'
import { civil, euros } from './fixtures/ledger'
import { AN_ID, cellData, dateFormat, excelHarness, forgetCaches, googleHarness, sentRequests, workbookGrids } from './fixtures/writeBack'
import type { WriteBackHarness } from './fixtures/writeBack'

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
    'outgoing-plan': [
      ['item', 'date', 'amount', 'client', 'description'],
      ['Monthly Fee', 46295, 4000, 'acme', 'Sep 2026'],
      ['Bonus', 46300, 833.333333, 'acme', 'Bonus share'],
    ],
  }
}

const OCTOBER_FEE = billingCellsOf({ item: 'Monthly Fee', date: civil('2026-10-31'), amount: euros(4000), client: 'Acme', description: 'Oct 2026 ' })

function planRowAt(store: WorkbookStore, sheetRow: number): RowAt {
  const row = store.state.snapshot?.['outgoing-plan'].find((candidate) => candidate.sheetRow === sheetRow)
  if (row === undefined) {
    throw new Error(`No plan row ${sheetRow}`)
  }
  return { sheetRow, cells: rowCellsOf(row, BILLING_PLAN_ROWS.columns) }
}

function addRows(store: WorkbookStore, added: readonly RowCells[]) {
  return store.changeRows(BILLING_PLAN_ROWS, { added, changed: [], removed: [] })
}

function changeRow(store: WorkbookStore, change: RowChange) {
  return store.changeRows(BILLING_PLAN_ROWS, { added: [], changed: [change], removed: [] })
}

function removeRow(store: WorkbookStore, row: RowAt) {
  return store.changeRows(BILLING_PLAN_ROWS, { added: [], changed: [], removed: [row] })
}

function plan(store: WorkbookStore): [string, string, number][] {
  return store.state.workbook?.billingPlan.map((row) => [row.item, row.date, row.amount]) ?? []
}

describe.each([
  ['a Google Sheet', googleHarness],
  ['a workbook kept in this browser', excelHarness],
] as const)('billing plan writes to %s', (_name, harnessOf: (used: Set<string>, grids?: Record<string, CellValue[][]>) => Promise<WriteBackHarness>) => {
  it('appends rows that read back as plan rows, and Undo clears them again', async () => {
    const { store } = await harnessOf(used, gridsWithBillingPlan())
    const november = { ...OCTOBER_FEE, date: 46356, description: 'Nov 2026' }

    const receipt = await addRows(store, [OCTOBER_FEE, november])

    expect(receipt?.added).toEqual([
      { sheetRow: 4, cells: { item: 'Monthly Fee', date: 46326, amount: 4000, client: 'acme', description: 'Oct 2026', id: AN_ID } },
      { sheetRow: 5, cells: { ...november, id: AN_ID } },
    ])
    expect(plan(store)).toEqual([
      ['Monthly Fee', '2026-09-30', euros(4000)],
      ['Bonus', '2026-10-05', euros(833.33)],
      ['Monthly Fee', '2026-10-31', euros(4000)],
      ['Monthly Fee', '2026-11-30', euros(4000)],
    ])

    const [added] = store.state.writes
    expect(added).toMatchObject({ kind: 'rows', receipt, undid: null })
    await store.undo(added!)

    expect(plan(store)).toHaveLength(2)
    expect(store.state.writes.map((write) => [write.kind === 'rows' && write.receipt.removed.length, canUndo(write, store.state.writes), wasUndone(write, store.state.writes)])).toEqual([
      [2, false, false],
      [0, false, true],
    ])
    expect(store.state.workbook?.problems).toEqual([])
  })

  it('refuses a row whose client is not on the clients tab, or whose amount is not above zero, and writes none of them', async () => {
    const { store } = await harnessOf(used, gridsWithBillingPlan())

    await expect(addRows(store, [OCTOBER_FEE, { ...OCTOBER_FEE, client: 'globex' }])).rejects.toThrow('"globex" is not on the clients tab')
    await expect(addRows(store, [{ ...OCTOBER_FEE, amount: 0 }])).rejects.toThrow('amount must be more than zero')
    expect(plan(store)).toHaveLength(2)
    expect(store.state.writes).toEqual([])
  })

  it('changes only the cells that differ, keeps the row in place, and Undo puts back what it held', async () => {
    const { store } = await harnessOf(used, gridsWithBillingPlan())
    const before = planRowAt(store, 3)

    await changeRow(store, { sheetRow: 3, before: before.cells, after: { ...before.cells, item: 'Yearly Bonus', description: '' } })

    expect(store.state.workbook?.billingPlan[1]).toMatchObject({ item: 'Yearly Bonus', amount: euros(833.33), description: '', sheetRow: 3 })
    const [changed] = store.state.writes
    expect(changed).toMatchObject({ kind: 'rows', receipt: { changed: [{ sheetRow: 3, before: before.cells }] } })

    await store.undo(changed!)

    expect(store.state.workbook?.billingPlan[1]).toMatchObject({ item: 'Bonus', description: 'Bonus share', sheetRow: 3 })
    expect(wasUndone(changed!, store.state.writes)).toBe(true)
  })

  it('refuses a change to a row that no longer holds what the app read', async () => {
    const { store } = await harnessOf(used, gridsWithBillingPlan())
    const before = planRowAt(store, 2)

    await changeRow(store, { sheetRow: 2, before: before.cells, after: { ...before.cells, amount: 4100 } })

    await expect(changeRow(store, { sheetRow: 2, before: before.cells, after: { ...before.cells, amount: 4200 } })).rejects.toThrow(
      'is no longer on the outgoing-plan tab as the app read it',
    )
    expect(store.state.workbook?.billingPlan[0]?.amount).toBe(euros(4100))
  })

  it('deletes a row by taking it out, so the rows below move up, and Undo puts it back on its own row', async () => {
    const { store } = await harnessOf(used, gridsWithBillingPlan())

    const receipt = await removeRow(store, planRowAt(store, 2))

    expect(receipt?.removed).toEqual([{ sheetRow: 2, cells: { item: 'Monthly Fee', date: 46295, amount: 4000, client: 'acme', description: 'Sep 2026', id: '' } }])
    expect(store.state.workbook?.billingPlan.map((row) => [row.item, row.sheetRow])).toEqual([['Bonus', 2]])
    await expect(removeRow(store, planRowAt(store, 2))).resolves.toBeDefined()
    expect(plan(store)).toEqual([])

    const deleted = store.state.writes.find((write) => write.kind === 'rows' && write.receipt === receipt)
    await store.undo(deleted!)

    expect(store.state.workbook?.billingPlan.map((row) => [row.item, row.sheetRow])).toEqual([['Monthly Fee', 2]])
    expect(store.state.writes[0]).toMatchObject({ kind: 'rows', undid: receipt })
    await expect(store.undo(deleted!)).rejects.toThrow(WorkbookWriteRefused)
  })
})

describe('billing plan writes to a Google Sheet', () => {
  it('finds a row again after rows were inserted above it, and refuses when two rows hold it', async () => {
    const { store, sheets, writtenRanges } = await googleHarness(used, gridsWithBillingPlan())
    const fee = planRowAt(store, 2)
    sheets.grids['outgoing-plan']!.splice(1, 0, ['Hotel', 46290, 120, 'acme', 'Inserted in the Sheet'])

    await removeRow(store, fee)

    expect(writtenRanges()).toEqual([])
    expect(sheets.grids['outgoing-plan']!.map((row) => row[4])).toEqual(['description', 'Inserted in the Sheet', 'Bonus share'])

    sheets.grids['outgoing-plan']!.push(['Bonus', 46300, 833.333333, 'acme', 'Bonus share'], ['Bonus', 46300, 833.333333, 'acme', 'Bonus share'])
    await expect(removeRow(store, { sheetRow: 99, cells: planRowAt(store, 3).cells })).rejects.toThrow('3 rows of the outgoing-plan tab hold')
  })

  it('appends below the last row, the date as a serial number, with a new id under an id header the tab lacked', async () => {
    const { store, sheets } = await googleHarness(used, gridsWithBillingPlan())

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

  it('appends every row of a fill in one request, so they land together or not at all', async () => {
    const { store, sheets } = await googleHarness(used, gridsWithBillingPlan())

    await addRows(store, [OCTOBER_FEE, { ...OCTOBER_FEE, date: 46356, description: 'Nov 2026' }])

    const appends = sentRequests(sheets).flatMap((request) => ('appendCells' in request ? [request.appendCells] : []))
    expect(appends).toHaveLength(1)
    expect(appends[0]?.rows.map((row) => row.values[4])).toEqual([cellData('Oct 2026'), cellData('Nov 2026')])
  })

  it('writes one cell when one changes, and never the formula value of a cell left alone', async () => {
    const { store, writtenRanges } = await googleHarness(used, gridsWithBillingPlan())
    const bonus = planRowAt(store, 3)

    await changeRow(store, { sheetRow: 3, before: bonus.cells, after: { ...bonus.cells, date: 46310 } })

    expect(writtenRanges()).toEqual(["'outgoing-plan'!B3"])
  })

  it('refuses every write to a Sheet without an outgoing-plan tab', async () => {
    const { 'outgoing-plan': _plan, ...withoutPlan } = gridsWithBillingPlan()
    const { store } = await googleHarness(used, withoutPlan)

    await expect(addRows(store, [OCTOBER_FEE])).rejects.toThrow('The workbook has no outgoing-plan tab')
  })
})
