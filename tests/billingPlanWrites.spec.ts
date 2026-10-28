import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { BILLING_RECORDS } from '../src/apps/company/workbook/domain/coreKinds'
import type { DocumentCopy } from '../src/shared/storage/infrastructure/documentRecordStorage'
import { BILLING_WRITES, newBillingItem } from '../src/apps/company/billingPlan/application/billingWrites'
import type { BillingItemDraft } from '../src/apps/company/billingPlan/domain/fillRestOfYear'
import { canUndo, wasUndone } from '../src/apps/company/workbook/application/createWorkbookStore'
import type { WorkbookStore } from '../src/apps/company/workbook/application/createWorkbookStore'
import { WorkbookWriteRefused } from '../src/shared/storage/application/workbookWriteRefused'
import type { BillingItem } from '../src/apps/company/workbook/domain/billingPlan'
import type { CellValue } from '../src/apps/company/workbook/infrastructure/workbookSnapshot'
import { civil, euros } from './fixtures/ledger'
import { cellsOf, recordOnRow } from './fixtures/recordWrites'
import { withIds } from './fixtures/rowIds'
import { AN_ID, browserHarness, forgetCaches, driveHarness, workbookGrids } from './fixtures/writeBack'
import type { WriteBackHarness } from './fixtures/writeBack'
import { recordIdOf } from '../src/shared/storage/domain/recordId'

type Store = WorkbookStore<DocumentCopy>

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
  ['a file on Drive', driveHarness],
  ['a workbook kept in this browser', browserHarness],
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
