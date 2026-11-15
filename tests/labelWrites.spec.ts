import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { addLabel, deleteLabel, labelRows, renameLabel } from '../src/apps/spending/labels/application/labelWrites'
import { labelNameProblem } from '../src/apps/spending/labels/domain/labels'
import { codecOfSpendingKind } from '../src/apps/spending/workbook/application/spendingCodecs'
import { ITEM_CODEC } from '../src/apps/spending/workbook/domain/transactionItemReading'
import type { Label } from '../src/apps/spending/workbook/domain/label'
import type { SpendingBooks } from '../src/apps/spending/workbook/domain/spendingBooks'
import { ACCOUNT_RECORDS, CATEGORY_RECORDS, ITEM_RECORDS, LABEL_RECORDS, TRANSACTION_RECORDS } from '../src/apps/spending/workbook/domain/spendingKinds'
import { BLANK_CELLS, storedRowOf } from '../src/apps/spending/workbook/domain/transaction'
import type { StoredRow } from '../src/apps/spending/workbook/domain/transaction'
import { spendingDocumentOf } from '../src/apps/spending/workbook/infrastructure/spendingDocument'
import type { WorkbookStore } from '../src/shared/storage/application/createWorkbookStore'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import type { RecordKind } from '../src/shared/storage/domain/recordKind'
import { storedFieldsOfValues } from '../src/shared/storage/domain/storedFields'
import { ACCOUNTS_BY_HAND, CATEGORIES, row, wholeItems } from './fixtures/spending'
import { SPENDING, browserHarness, forgetCaches } from './fixtures/writeBack'

const [OTP] = ACCOUNTS_BY_HAND

const used = new Set<string>()
afterEach(async () => forgetCaches(used))

function stored<R>(kind: RecordKind<R>, records: readonly R[]) {
  const codec = codecOfSpendingKind(kind)
  return { [kind.name]: records.map((record) => codec.fieldsOf(record)) }
}

const dinner = row(OTP!, '2026-10-12', -40, 'Food/Restaurants')
const hotel = row(OTP!, '2026-10-13', -300, 'Travel/Accommodation')
const PRAGUE: Label = { id: recordIdOf(LABEL_RECORDS, 'prague'), name: 'Prague' }

async function storeWith(rows: readonly StoredRow[], labels: readonly Label[] = [], items = wholeItems(rows)): Promise<WorkbookStore<SpendingBooks>> {
  const document = spendingDocumentOf('2026-11-04T09:00:00.000Z', {
    ...stored(ACCOUNT_RECORDS, ACCOUNTS_BY_HAND),
    ...stored(CATEGORY_RECORDS, CATEGORIES),
    ...stored(LABEL_RECORDS, labels),
    ...stored(
      TRANSACTION_RECORDS,
      rows.map((held) => storedRowOf(held, BLANK_CELLS)),
    ),
    ...stored(ITEM_RECORDS, items),
  })
  const { store } = await browserHarness(used, document, SPENDING)
  return store
}

const labelsOfItems = (store: WorkbookStore<SpendingBooks>) => store.state.workbook!.items.map((item) => item.labels)

describe("a label's name", () => {
  it('is not blank and no other label has it once folded, so Prague and prague are one label', () => {
    expect(labelNameProblem('  ', [PRAGUE], null)).toBe('blank')
    expect(labelNameProblem(' prague ', [PRAGUE], null)).toBe('taken')
    expect(labelNameProblem('Prague', [PRAGUE], PRAGUE.id)).toBeNull()
    expect(labelNameProblem('Praha', [PRAGUE], null)).toBeNull()
  })
})

describe('the labels of an item as the file stores them', () => {
  it('round-trips as keys separated by a bar, and an item with none stores no field', () => {
    const [whole] = wholeItems([dinner])
    const labelled = { ...whole!, labels: [PRAGUE.id, recordIdOf(LABEL_RECORDS, 'flat')] }
    const fields = ITEM_CODEC.fieldsOf(labelled)

    expect(fields['labels']).toBe('prague | flat')
    expect(ITEM_CODEC.make(storedFieldsOfValues(fields), labelled.id)).toEqual(labelled)
    expect(ITEM_CODEC.fieldsOf(whole!)).not.toHaveProperty('labels')
  })
})

describe('writing labels', () => {
  it('adds a label and puts it on every part of each picked row in one write, and takes it off again', async () => {
    const store = await storeWith([dinner, hotel])
    let label: Label | null = null

    await store.write('Labelled', (unit) => {
      label = addLabel(unit, ' Prague ')
      labelRows(unit, store.state.records!, [dinner, hotel], label.id, true)
    })
    expect(store.state.workbook!.labels).toEqual([{ id: label!.id, name: 'Prague' }])
    expect(labelsOfItems(store)).toEqual([[label!.id], [label!.id]])

    await store.write('Taken off', (unit) => labelRows(unit, store.state.records!, [hotel], label!.id, false))
    expect(labelsOfItems(store)).toEqual([[label!.id], []])
    expect(store.state.workbook!.problems).toEqual([])
  })

  it('refuses a name another label has once folded', async () => {
    const store = await storeWith([dinner], [PRAGUE, { id: recordIdOf(LABEL_RECORDS, 'flat'), name: 'New flat' }])
    const flat = store.state.workbook!.labels[1]!

    await expect(store.write('Renamed', (unit) => renameLabel(unit, flat, 'PRAGUE'))).rejects.toThrow()
    await expect(store.write('Added', (unit) => void addLabel(unit, 'prague'))).rejects.toThrow()
    expect(store.state.workbook!.labels.map((label) => label.name)).toEqual(['Prague', 'New flat'])
  })

  it('deletes a label with every item it is on in one write, and one Undo puts both back', async () => {
    const store = await storeWith([dinner, hotel], [PRAGUE], [{ ...wholeItems([dinner])[0]!, labels: [PRAGUE.id] }, ...wholeItems([hotel])])

    const written = await store.write('Deleted', (unit) => deleteLabel(unit, store.state.records!, PRAGUE))
    expect(store.state.workbook!.labels).toEqual([])
    expect(labelsOfItems(store)).toEqual([[], []])

    await store.undo(store.state.writes.find((write) => write.receipt === written)!)
    expect(store.state.workbook!.labels).toEqual([PRAGUE])
    expect(labelsOfItems(store)).toEqual([[PRAGUE.id], []])
  })

  it('keeps an item that names a label the file lacks, doubted, and shows it under no label', async () => {
    const store = await storeWith([dinner], [], [{ ...wholeItems([dinner])[0]!, labels: [PRAGUE.id] }])
    const book = store.state.workbook!

    expect(book.transactions).toHaveLength(1)
    expect(book.problems.map((problem) => [problem.kind, problem.reason])).toEqual([['item', 'names a label prague that is not in the file, so it shows under no label']])
  })
})
