import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { LABEL_WRITES, addLabel, deleteLabel, labelPackRecords, labelRows, relabelItem, renameLabel } from '../src/apps/company/labels/application/labelWrites'
import { newLabel } from '../src/apps/company/labels/domain/labels'
import { labelTotals } from '../src/apps/company/labels/domain/labelTotals'
import { labelFigure } from '../src/shared/categorising/domain/labels'
import { bucketTotals } from '../src/apps/company/workbook/domain/bucketTotals'
import { DEFAULT_FILTERS } from '../src/apps/company/filters/domain/filterState'
import { installedPack } from '../src/apps/company/packs/packContribution'
import { ITEM_WRITES, heldLabels, itemChanged, writeRowItems } from '../src/apps/company/transactions/application/itemWrites'
import { removeSplit, writeSplit } from '../src/apps/company/transactions/application/splitWrites'
import { fileRows } from '../src/apps/company/transactions/application/fileRows'
import { recategorisation } from '../src/apps/company/transactions/domain/verdictChanges'
import { countedLedger } from '../src/apps/company/transactions/domain/countedLedger'
import { LABEL_RECORDS } from '../src/apps/company/workbook/domain/coreKinds'
import { storedItemsOfRow } from '../src/apps/company/workbook/domain/rowItems'
import { recordsOfKindIn } from '../src/apps/company/workbook/domain/readWorkbook'
import { OWNER_ADVANCE_RECORDS } from '../src/apps/company/packs/hr-doo/domain/hrDooKinds'
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
    expect(labels.map((label) => label.name)).toEqual(['Berlin conference', 'New office 2027'])
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
    const cash = countedLedger(workbook, DEFAULT_FILTERS, installedPack().vatOnPrivateShare)!.workbook
    const [office, conference] = labelTotals(cash.transactions, cash.ownerAdvances, workbook.itemLabels, workbook.labels)

    expect(office).toMatchObject({ label: { name: 'New office 2027' }, parts: 0, latest: null })
    // The lunch 62.28, the flight 355.81, the gadget 38.90 and the train tickets the owner paid privately 212.50 are operating cost.
    // The owner's repayment part is financing, listed but counted nowhere.
    expect(conference).toMatchObject({ label: { name: 'Berlin conference' }, parts: 5, latest: '2026-10-05' })
    expect(conference!.profitAndLoss.operating).toBe(euros(669.49))
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

describe('writing labels', () => {
  const itemLabelsOf = (store: Awaited<ReturnType<typeof itemsBooks>>['store'], counterparty: string) => {
    const row = store.state.workbook!.transactions.find((candidate) => candidate.counterparty === counterparty)!
    return storedItemsOfRow(store.state.records!.items, row).map((item) => item.labels)
  }

  it('adds a label and puts it on every part of a row in one write, and one Undo takes back both', async () => {
    const { store } = await itemsBooks()
    const row = store.state.workbook!.transactions.find((candidate) => candidate.counterparty === 'GADGET CORNER')!
    const workshop = newLabel(' Workshop ')
    const written = await store.write('Labelled', (unit) => {
      addLabel(unit, workshop)
      labelRows(unit, store.state.records!, [row], workshop.id, true)
    })
    expect(store.state.workbook!.labels.map((label) => label.name)).toContain('Workshop')
    expect(itemLabelsOf(store, 'GADGET CORNER').every((labels) => labels.includes(workshop.id))).toBe(true)

    await store.undo(store.state.writes.find((write) => write.receipt === written)!)
    expect(store.state.workbook!.labels.map((label) => label.name)).not.toContain('Workshop')
    expect(itemLabelsOf(store, 'GADGET CORNER').some((labels) => labels.includes(workshop.id))).toBe(false)
  })

  it('refuses a name another label has once folded, and a blank one', async () => {
    const { store, conference } = await itemsBooks()
    await expect(store.write('Added', (unit) => addLabel(unit, newLabel('berlin CONFERENCE')))).rejects.toThrow(WorkbookWriteRefused)
    await expect(store.write('Renamed', (unit) => renameLabel(unit, conference, '  '))).rejects.toThrow(WorkbookWriteRefused)
    await store.write('Renamed', (unit) => renameLabel(unit, conference, 'Berlin 2027 '))
    expect(store.state.workbook!.labels.map((label) => label.name)).toEqual(['Berlin 2027', 'New office 2027'])
  })

  it('deletes a label with every part it is on in one write, and one Undo puts both back', async () => {
    const { store, conference } = await itemsBooks()
    const written = await store.write('Deleted', (unit) => deleteLabel(unit, store.state.records!, conference))
    expect(store.state.workbook!.labels.map((label) => label.name)).toEqual(['New office 2027'])
    expect(store.state.workbook!.itemLabels.size).toBe(0)

    await store.undo(store.state.writes.find((write) => write.receipt === written)!)
    expect(store.state.workbook!.labels.map((label) => label.name).sort()).toEqual(['Berlin conference', 'New office 2027'])
    expect(store.state.workbook!.itemLabels.size).toBe(4)
  })

  it('refuses to take out a label a part still carries', async () => {
    const { store } = await itemsBooks()
    const conference = recordsOf(store.state.records!.labels).find((label) => label.name === 'Berlin conference')!
    await expect(store.write('Removed', (unit) => unit.of(LABEL_WRITES).remove(conference))).rejects.toThrow(WorkbookWriteRefused)
  })

  it('takes a label off the one part a write names, and leaves the other parts of the row as they are', async () => {
    const { store, conference } = await itemsBooks()
    const repayment = store.state.workbook!.transactions.find((row) => row.description === 'Refund of the design tool and the printer paper')!
    const [first, second] = storedItemsOfRow(store.state.records!.items, repayment)
    await store.write('Labelled', (unit) => labelRows(unit, store.state.records!, [repayment], conference.id, true, new Set([second!.id])))
    const after = storedItemsOfRow(store.state.records!.items, repayment)
    expect(after.find((item) => item.id === first!.id)!.labels).toEqual(first!.labels)
    expect(after.find((item) => item.id === second!.id)!.labels).toEqual([conference.id])
  })

  it('refuses to label rows of books from before items', async () => {
    const { store } = await browserHarness(used, fakeWorkbookDocumentBeforeItems(SAVED, 'browser'))
    const row = store.state.workbook!.transactions[0]!
    await expect(store.write('Labelled', (unit) => labelRows(unit, store.state.records!, [row], recordIdOf(LABEL_RECORDS, 'berlin'), true))).rejects.toThrow(WorkbookWriteRefused)
  })
})

describe('labels as the row dialogs give them', () => {
  it('stores the labels the split dialog gives each part, so a new part keeps what it was given and none is carried back', async () => {
    const { store, conference } = await itemsBooks()
    const flightRow = store.state.workbook!.transactions.find((row) => row.counterparty === 'AIRLINE EXAMPLE')!
    const drafts = [
      { amount: euros(-255.81), category: 'travel', note: '', opened: null, labels: [conference.id] },
      { amount: euros(-100), category: 'travel', note: 'Seat and bag', opened: null, labels: [] },
    ]
    await store.write('Split', (unit) => writeSplit(unit, store.state.records!, flightRow, storedSplitsOf(store.state.records!)(flightRow), drafts, store.state.workbook!.categories))
    expect(storedItemsOfRow(store.state.records!.items, flightRow).map((item) => item.labels)).toEqual([[conference.id], []])
  })

  it('keeps a label taken off a part that grows, which a write would otherwise carry back from the part it took money from', async () => {
    const { store, conference } = await itemsBooks()
    const flightRow = store.state.workbook!.transactions.find((row) => row.counterparty === 'AIRLINE EXAMPLE')!
    const first = [
      { amount: euros(-255.81), category: 'travel', note: '', opened: null, labels: [conference.id] },
      { amount: euros(-100), category: 'travel', note: 'Seat and bag', opened: null, labels: [] },
    ]
    await store.write('Split', (unit) => writeSplit(unit, store.state.records!, flightRow, storedSplitsOf(store.state.records!)(flightRow), first, store.state.workbook!.categories))
    const stored = storedSplitsOf(store.state.records!)(flightRow)
    const [large, small] = stored.parts
    const grown = [
      { amount: euros(-155.81), category: 'travel', note: '', opened: large!, labels: [conference.id] },
      { amount: euros(-200), category: 'travel', note: 'Seat and bag', opened: small!, labels: [] },
    ]
    await store.write('Grown', (unit) => writeSplit(unit, store.state.records!, flightRow, stored, grown, store.state.workbook!.categories))
    const after = storedItemsOfRow(store.state.records!.items, flightRow)
    expect(after.find((item) => item.id === small!.id)!.labels).toEqual([])
  })

  it('refiles a row of one item with the labels its dialog gives, and sets labels alone without refiling it', async () => {
    const { store, conference } = await itemsBooks()
    const records = () => store.state.records!
    const row = store.state.workbook!.transactions.find((candidate) => candidate.counterparty === 'GADGET CORNER')!
    const [item] = storedItemsOfRow(records().items, row)
    await store.write('Labelled', (unit) => relabelItem(unit, records(), item!, [conference.id]))
    expect(storedItemsOfRow(records().items, row)[0]!.labels).toEqual([conference.id])

    const workbook = store.state.workbook!
    const refiled = workbook.transactions.find((candidate) => candidate.id === row.id)!
    const verdict = recategorisation(refiled, 'office', workbook.settings)
    await store.write('Refiled', (unit) => fileRows(unit, { records: records(), workbook }, [verdict], workbook.categories, new Map([[row.id, []]])))
    expect(storedItemsOfRow(records().items, row).map((held) => [held.category, held.labels])).toEqual([['office', []]])
  })

  it('refuses to set labels on books from before items', async () => {
    const { store } = await browserHarness(used, fakeWorkbookDocumentBeforeItems(SAVED, 'browser'))
    const item = newItemRecord('row', recordIdOf(LABEL_RECORDS, 'x'), { amount: euros(-10), category: 'travel', note: '', ownerShare: null })
    await expect(store.write('Labelled', (unit) => relabelItem(unit, store.state.records!, item, [recordIdOf(LABEL_RECORDS, 'berlin')]))).rejects.toThrow(WorkbookWriteRefused)
  })
})

describe('labels on the costs the owner paid', () => {
  const advancesOf = (store: Awaited<ReturnType<typeof itemsBooks>>['store']) => recordsOf(recordsOfKindIn(store.state.records!, OWNER_ADVANCE_RECORDS))

  it('reads the labels a cost carries, and puts one on or takes it off in one write', async () => {
    const { store, conference } = await itemsBooks()
    const office = store.state.workbook!.labels.find((label) => label.name === 'New office 2027')!
    const [train, design] = store.state.workbook!.ownerAdvances
    expect(train!.labels).toEqual([conference.id])

    await store.write('Labelled', (unit) => labelPackRecords(unit, store.state.records!, new Set([train!.id, design!.id]), office.id, true))
    expect(store.state.workbook!.ownerAdvances.slice(0, 2).map((advance) => advance.labels)).toEqual([[conference.id, office.id], [office.id]])

    await store.write('Unlabelled', (unit) => labelPackRecords(unit, store.state.records!, new Set([design!.id]), office.id, false))
    expect(store.state.workbook!.ownerAdvances[1]!.labels).toBeUndefined()
  })

  it('deletes a label off the costs that carry it in the same write, and refuses to take one out a cost still carries', async () => {
    const { store, conference } = await itemsBooks()
    const held = recordsOf(store.state.records!.labels).find((label) => label.name === 'Berlin conference')!
    await store.write('Unlabelled items', (unit) => {
      for (const item of recordsOf(store.state.records!.items).filter((candidate) => candidate.labels.includes(conference.id))) relabelItem(unit, store.state.records!, item, [])
    })
    await expect(store.write('Removed', (unit) => unit.of(LABEL_WRITES).remove(held))).rejects.toThrow(WorkbookWriteRefused)

    await store.write('Deleted', (unit) => deleteLabel(unit, store.state.records!, conference))
    expect(advancesOf(store).some((advance) => advance.labels !== undefined)).toBe(false)
  })

  it('reports a label of a cost that the labels tab lacks, which the cost then does not carry', async () => {
    const document = fakeWorkbookDocument(SAVED, 'browser')
    const { store } = await browserHarness(used, { ...document, records: { ...document.records, label: [] } })
    expect(store.state.workbook!.ownerAdvances[0]!.labels).toBeUndefined()
    expect(store.state.workbook!.problems.filter((problem) => problem.tab === 'owner-advances' && problem.reason.includes('no label'))).toHaveLength(1)
  })
})

describe("a label's leading figure", () => {
  it('is its costs when it has no income, so a plain cost reads in ink and not as a loss', () => {
    const costsOnly = bucketTotals([
      { bucket: 'operating', amount: euros(-120) },
      { bucket: 'owner-pay', amount: euros(-30) },
    ])
    expect(labelFigure(costsOnly.income, costsOnly.cost)).toEqual({ counts: 'costs', amount: euros(150) })
  })

  it('is its result, income less costs, once it has income', () => {
    const withIncome = bucketTotals([
      { bucket: 'income', amount: euros(100) },
      { bucket: 'operating', amount: euros(-150) },
    ])
    expect(labelFigure(withIncome.income, withIncome.cost)).toEqual({ counts: 'result', amount: euros(-50) })
  })
})
