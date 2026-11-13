import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { SPENDING_OPERATIONS } from '../src/apps/spending/assistant/operations/spendingOperations'
import { moveToItems } from '../src/apps/spending/entries/application/rowRecords'
import { isBeforeItems, moveBlockers } from '../src/apps/spending/workbook/domain/beforeItems'
import { isSplit, rowItemsOf } from '../src/apps/spending/workbook/domain/rowItems'
import type { SpendingBook } from '../src/apps/spending/workbook/domain/readSpendingBook'
import { recordsChangeInWords } from '../src/shared/storage/presentation/recordsChangeInWords'
import { EXAMPLE_RECORDS, attachedPhoto, deskPorts, spendingDesk } from './fixtures/spendingDesk'
import type { DeskShape, SpendingDesk } from './fixtures/spendingDesk'
import { exampleInput } from './fixtures/exampleInput'
import { filedRows } from './fixtures/spending'
import { forgetCaches } from './fixtures/writeBack'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { ITEM_RECORDS } from '../src/apps/spending/workbook/domain/spendingKinds'

const used = new Set<string>()
afterEach(async () => {
  vi.restoreAllMocks()
  await forgetCaches(used)
})

/** Ids made the same way on each desk, so the same write on either gives the same records. */
function countedIds(): void {
  let made = 0
  vi.spyOn(crypto, 'randomUUID').mockImplementation(() => `00000000-0000-4000-8000-${String((made += 1)).padStart(12, '0')}` as ReturnType<typeof crypto.randomUUID>)
}

const byId = <R extends { readonly id: string }>(records: readonly R[]): R[] => [...records].sort((one, other) => one.id.localeCompare(other.id))

/** What the book says, the same in either shape: each row as its items file it, every item, and the receipts. */
function seen(book: SpendingBook) {
  return { rows: byId(filedRows(book)), items: byId(book.items), receipts: byId(book.receipts), problems: book.problems }
}

/** The desk once the operation's example is written, with the ids it made counted from one. */
async function afterExample(shape: DeskShape, name: string): Promise<SpendingDesk> {
  const desk = await spendingDesk(used, deskPorts(), shape)
  countedIds()
  const operation = SPENDING_OPERATIONS.find((candidate) => candidate.name === name)!
  const answer = await desk.propose([{ op: name, input: exampleInput(operation, desk, EXAMPLE_RECORDS, attachedPhoto().id) }], [attachedPhoto()])
  expect(answer.isError, answer.text).toBe(false)
  expect((await desk.accept()).kind).toBe('done')
  return desk
}

/** The operations that write rows or their items, each through one of the writers that know both shapes. */
const ENTRY_OPERATIONS = SPENDING_OPERATIONS.map((operation) => operation.name).filter((name) =>
  [
    'add-entry',
    'change-entry',
    'add-transfer',
    'change-transfer',
    'delete-entry',
    'split-entry',
    'remove-split',
    'remove-receipt',
    'add-receipt',
    'link-entry',
    'unlink-entry',
    'join-rows',
    'pair-rows',
    'unpair-rows',
    'not-cash',
    'move-to-cash',
    'place-waiting-receipt',
    'remove-waiting-receipt',
    'add-rule',
    'change-rule',
    'delete-rule',
    'delete-category',
    'import-statement',
    'change-account',
  ].includes(name),
)

describe('a write to a file from before items and to a file moved to items', () => {
  it('covers the operations that write entries', () => {
    expect(ENTRY_OPERATIONS).toHaveLength(24)
  })

  it.each(ENTRY_OPERATIONS)('leaves the same book in either shape, and the file from before items in its shape: %s', async (name) => {
    const moved = await afterExample('items', name)
    const before = await afterExample('before-items', name)

    expect(seen(before.store.state.workbook!)).toEqual(seen(moved.store.state.workbook!))
    const records = before.store.state.records!
    expect(isBeforeItems(records)).toBe(true)
    expect(records.items.records).toEqual([])
    const book = before.store.state.workbook!
    const itemsOf = rowItemsOf(book)
    const splitRows = new Set(book.transactions.filter((row) => isSplit(itemsOf(row))).map((row) => row.id))
    expect(records.lines.records.every(({ record }) => record.transaction === null || splitRows.has(record.transaction))).toBe(true)
  })
})

describe('the move to items', () => {
  it('writes the book a file moved to items reads, in one write that one Undo takes back', async () => {
    const moved = await spendingDesk(used, deskPorts(), 'items')
    const desk = await spendingDesk(used, deskPorts(), 'before-items')
    const { store } = desk
    const old = store.state.records!
    expect(moveBlockers(store.state.workbook!)).toEqual({ leftOut: 0, splitLegs: 0 })

    const receipt = await store.write('Moved', (unit) => moveToItems(unit, store.state.workbook!))

    expect(isBeforeItems(store.state.records!)).toBe(false)
    expect(store.state.records!.lines.records).toEqual([])
    expect(seen(store.state.workbook!)).toEqual(seen(moved.store.state.workbook!))
    expect(store.state.records!.transactions.records.map(({ fields }) => fields)).toEqual(moved.store.state.records!.transactions.records.map(({ fields }) => fields))
    expect(recordsChangeInWords(receipt!, null)).toMatch(/^Changed 11 entries/)
    await store.undo(store.state.writes.at(-1)!)
    expect(store.state.records!.transactions.records.map(({ fields }) => fields)).toEqual(old.transactions.records.map(({ fields }) => fields))
    expect(store.state.records!.lines.records.map(({ fields }) => fields)).toEqual(old.lines.records.map(({ fields }) => fields))
    expect(store.state.records!.items.records).toEqual([])
  })

  it('waits while a row or a line the reader leaves out would be left behind', async () => {
    const desk = await spendingDesk(used, deskPorts(), 'before-items')
    const book = desk.store.state.workbook!
    const [row] = book.transactions
    const lost = { ...book, transactions: book.transactions.filter((kept) => kept !== row) }
    expect(moveBlockers(lost)).toEqual({ leftOut: 1, splitLegs: 0 })
  })

  it('waits while a transfer between accounts is split, and names it apart from what is left out', async () => {
    const desk = await spendingDesk(used, deskPorts(), 'before-items')
    const book = desk.store.state.workbook!
    const leg = book.transactions.find((row) => row.pair !== null)!
    const whole = book.items.find((item) => item.transaction === leg.id)!
    const parts = [whole, { ...whole, id: recordIdOf(ITEM_RECORDS, 'made-up-second-part') }]
    expect(moveBlockers({ ...book, items: [...book.items.filter((item) => item.transaction !== leg.id), ...parts] })).toEqual({ leftOut: 0, splitLegs: 1 })
  })
})
