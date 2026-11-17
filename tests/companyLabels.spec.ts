import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { labelTotals } from '../src/apps/company/labels/domain/labelTotals'
import { DEFAULT_FILTERS } from '../src/apps/company/filters/domain/filterState'
import { installedPack } from '../src/apps/company/packs/packContribution'
import { ITEM_WRITES, heldLabels, itemChanged, writeRowItems } from '../src/apps/company/transactions/application/itemWrites'
import { removeSplit, writeSplit } from '../src/apps/company/transactions/application/splitWrites'
import { countedLedger } from '../src/apps/company/transactions/domain/countedLedger'
import { LABEL_RECORDS } from '../src/apps/company/workbook/domain/coreKinds'
import { storedItemsOfRow } from '../src/apps/company/workbook/domain/rowItems'
import { wholeItemId } from '../src/apps/company/workbook/domain/splits'
import { newItemRecord } from '../src/apps/company/workbook/domain/splitsReading'
import { storedSplitsOf } from '../src/apps/company/workbook/domain/storedSplits'
import { fakeWorkbookDocument, fakeWorkbookDocumentBeforeItems } from '../src/apps/company/workbook/infrastructure/fake/fakeWorkbook'
import { WorkbookWriteRefused } from '../src/shared/storage/application/workbookWriteRefused'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { recordsOf } from '../src/shared/storage/domain/recordsRead'
import { euros } from './fixtures/ledger'
import { browserHarness, forgetCaches } from './fixtures/writeBack'

const used = new Set<string>()
afterEach(async () => forgetCaches(used))

const SAVED = '2026-10-16T09:00:00.000Z'

async function itemsBooks() {
  const { store } = await browserHarness(used, fakeWorkbookDocument(SAVED, 'browser'))
  const conference = store.state.workbook!.labels.find((label) => label.name === 'Berlin conference')!
  return { store, conference }
}

describe('Company labels as the books read them', () => {
  it('reads the labels tab and the labels each counted item carries, and books from before items carry none', async () => {
    const { store, conference } = await itemsBooks()
    const { labels, itemLabels } = store.state.workbook!
    expect(labels.map((label) => label.name)).toEqual(['Berlin conference', 'Office 2027'])
    expect([...itemLabels.values()]).toEqual([[conference.id], [conference.id], [conference.id], [conference.id]])

    const before = await browserHarness(used, fakeWorkbookDocumentBeforeItems(SAVED, 'browser'))
    expect(before.store.state.workbook!.itemLabels.size).toBe(0)
  })

  it('reports an item that names a label the labels tab lacks, which then carries none', async () => {
    const document = fakeWorkbookDocument(SAVED, 'browser')
    const { store } = await browserHarness(used, { ...document, records: { ...document.records, label: [] } })
    expect(store.state.workbook!.itemLabels.size).toBe(0)
    expect(store.state.workbook!.problems.filter((problem) => problem.tab === 'items' && problem.reason.includes('no label'))).toHaveLength(4)
  })

  it('counts each label as the cash screens count profit and loss, a label nothing carries first', async () => {
    const { store } = await itemsBooks()
    const workbook = store.state.workbook!
    const cash = countedLedger(workbook, DEFAULT_FILTERS, installedPack().vatOnPrivateShare)!.workbook.transactions
    const [office, conference] = labelTotals(cash, workbook.itemLabels, workbook.labels)

    expect(office).toMatchObject({ label: { name: 'Office 2027' }, parts: 0, latest: null })
    // The lunch 62.28, the flight 355.81 and the gadget 38.90 are operating cost. The owner's repayment part is financing, listed but counted nowhere.
    expect(conference).toMatchObject({ label: { name: 'Berlin conference' }, parts: 4, latest: '2026-10-05' })
    expect(conference!.profitAndLoss.operating).toBe(euros(456.99))
    expect(conference!.profitAndLoss.income).toBe(0)
  })
})

describe('writing items that carry labels', () => {
  it('carries a label to the new part of a re-split and back to the one item when the split comes off', async () => {
    const { store, conference } = await itemsBooks()
    const flightRow = store.state.workbook!.transactions.find((row) => row.counterparty === 'AIRLINE EXAMPLE')!
    const drafts = [
      { amount: euros(-255.81), category: 'travel', note: '', opened: null },
      { amount: euros(-100), category: 'travel', note: 'Seat and bag', opened: null },
    ]
    await store.write('Split', (unit) => writeSplit(unit, store.state.records!, flightRow, storedSplitsOf(store.state.records!)(flightRow), drafts, store.state.workbook!.categories))
    expect(storedItemsOfRow(store.state.records!.items, flightRow).map((item) => item.labels)).toEqual([[conference.id], [conference.id]])

    const split = store.state.workbook!.transactions.find((row) => row.id === flightRow.id)!
    const books = { records: store.state.records!, workbook: store.state.workbook! }
    await store.write('Unsplit', (unit) => removeSplit(unit, books, split, storedSplitsOf(books.records)(split)))
    expect(storedItemsOfRow(store.state.records!.items, flightRow).map((item) => item.labels)).toEqual([[conference.id]])
  })

  it('keeps the labels of the item a refile keeps, as the held item carries them', async () => {
    const { store, conference } = await itemsBooks()
    const flightRow = store.state.workbook!.transactions.find((row) => row.counterparty === 'AIRLINE EXAMPLE')!
    expect(heldLabels(store.state.records!, flightRow)(wholeItemId(flightRow))).toEqual([conference.id])
    expect(heldLabels(store.state.records!, flightRow)(null)).toEqual([])
  })

  it('lets a label go on an item the pack files, which keeps the rest of what it holds', async () => {
    const { store, conference } = await itemsBooks()
    const repayment = store.state.workbook!.transactions.find((row) => row.description === 'Refund of the design tool and the printer paper')!
    const [, second] = storedItemsOfRow(store.state.records!.items, repayment)
    await store.write('Labelled', (unit) => unit.of(ITEM_WRITES).change(second!, { ...second!, labels: [conference.id] }))
    expect(storedItemsOfRow(store.state.records!.items, repayment).map((item) => item.labels)).toEqual([[conference.id], [conference.id]])
  })

  it('refuses a label on books from before items, which keep none', async () => {
    const { store } = await browserHarness(used, fakeWorkbookDocumentBeforeItems(SAVED, 'browser'))
    const row = store.state.workbook!.transactions.find((candidate) => candidate.counterparty === 'AIRLINE EXAMPLE')!
    const item = { id: wholeItemId(row), amount: row.amount, category: row.category, note: '', ownerShare: row.ownerShare, labels: [recordIdOf(LABEL_RECORDS, 'berlin')] }
    await expect(store.write('Labelled', (unit) => writeRowItems(unit, store.state.records!, row, storedSplitsOf(store.state.records!)(row), [item]))).rejects.toThrow(WorkbookWriteRefused)
    expect(recordsOf(store.state.records!.items)).toEqual([])
  })

  it('counts a change of labels alone as a change of the item', () => {
    const held = newItemRecord('row', recordIdOf(LABEL_RECORDS, 'x'), { amount: euros(-10), category: 'travel', note: '', ownerShare: null })
    expect(itemChanged(held, { ...held })).toBe(false)
    expect(itemChanged(held, { ...held, labels: [recordIdOf(LABEL_RECORDS, 'berlin')] })).toBe(true)
  })
})
