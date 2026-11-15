import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { removeSplitOf } from '../src/apps/spending/entries/application/entryWrites'
import { writeRows } from '../src/apps/spending/entries/application/rowRecords'
import { addEvent, changeEvent, chooseEvent, deleteEvent } from '../src/apps/spending/events/application/eventWrites'
import { newEvent } from '../src/apps/spending/events/domain/events'
import { codecOfSpendingKind } from '../src/apps/spending/workbook/application/spendingCodecs'
import { carriedChoices } from '../src/apps/spending/workbook/domain/carriedChoices'
import { BY_DAYS, OUT_OF_EVENTS } from '../src/apps/spending/workbook/domain/event'
import type { SpendingEvent } from '../src/apps/spending/workbook/domain/event'
import { EVENT_CODEC } from '../src/apps/spending/workbook/domain/eventReading'
import { ITEM_CODEC } from '../src/apps/spending/workbook/domain/transactionItemReading'
import type { SpendingBooks } from '../src/apps/spending/workbook/domain/spendingBooks'
import { ACCOUNT_RECORDS, CATEGORY_RECORDS, EVENT_RECORDS, ITEM_RECORDS, TRANSACTION_RECORDS } from '../src/apps/spending/workbook/domain/spendingKinds'
import { BLANK_CELLS, storedRowOf } from '../src/apps/spending/workbook/domain/transaction'
import type { StoredRow } from '../src/apps/spending/workbook/domain/transaction'
import type { TransactionItem } from '../src/apps/spending/workbook/domain/transactionItem'
import { spendingDocumentOf } from '../src/apps/spending/workbook/infrastructure/spendingDocument'
import { accountMoneyFromAmount } from '../src/shared/money/accountMoney'
import type { WorkbookStore } from '../src/shared/storage/application/createWorkbookStore'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import type { RecordKind } from '../src/shared/storage/domain/recordKind'
import { storedFieldsOfValues } from '../src/shared/storage/domain/storedFields'
import { civil } from './fixtures/ledger'
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
const PRAGUE: SpendingEvent = { id: recordIdOf(EVENT_RECORDS, 'prague'), name: 'Prague', days: { from: civil('2026-10-10'), to: civil('2026-10-14') } }

async function storeWith(rows: readonly StoredRow[], events: readonly SpendingEvent[] = [], items = wholeItems(rows)): Promise<WorkbookStore<SpendingBooks>> {
  const document = spendingDocumentOf('2026-11-04T09:00:00.000Z', {
    ...stored(ACCOUNT_RECORDS, ACCOUNTS_BY_HAND),
    ...stored(CATEGORY_RECORDS, CATEGORIES),
    ...stored(EVENT_RECORDS, events),
    ...stored(
      TRANSACTION_RECORDS,
      rows.map((held) => storedRowOf(held, BLANK_CELLS)),
    ),
    ...stored(ITEM_RECORDS, items),
  })
  const { store } = await browserHarness(used, document, SPENDING)
  return store
}

const choicesOf = (store: WorkbookStore<SpendingBooks>) => store.state.workbook!.items.map((item) => item.event)

describe('an event as the file stores it', () => {
  it('round-trips its name and days', () => {
    const fields = EVENT_CODEC.fieldsOf(PRAGUE)

    expect(fields).toMatchObject({ name: 'Prague', from: '2026-10-10', to: '2026-10-14' })
    expect(EVENT_CODEC.make(storedFieldsOfValues(fields), PRAGUE.id)).toEqual(PRAGUE)
  })

  it('leaves out an event whose last day is before its first, and says why', async () => {
    const store = await storeWith([dinner], [{ ...PRAGUE, days: { from: PRAGUE.days.to, to: PRAGUE.days.from } }])
    const book = store.state.workbook!

    expect(book.events).toEqual([])
    expect(book.problems.map((problem) => [problem.kind, problem.reason])).toEqual([['event', 'its last day is before its first']])
  })

  it("keeps an item's choice in its event field: none by its days, out, or the event's key", () => {
    const [whole] = wholeItems([dinner])

    expect(ITEM_CODEC.fieldsOf(whole!)).not.toHaveProperty('event')
    for (const choice of [OUT_OF_EVENTS, PRAGUE.id] as const) {
      const fields = ITEM_CODEC.fieldsOf({ ...whole!, event: choice })
      expect(fields['event']).toBe(choice === OUT_OF_EVENTS ? 'out' : 'prague')
      expect(ITEM_CODEC.make(storedFieldsOfValues(fields), whole!.id).event).toBe(choice)
    }
  })
})

describe('writing events', () => {
  it('adds an event, changes its days and name, and refuses days that end before they start', async () => {
    const store = await storeWith([dinner])
    const prague = newEvent(' Prague ', PRAGUE.days)

    await store.write('Added', (unit) => addEvent(unit, prague))
    expect(store.state.workbook!.events).toEqual([{ ...prague, name: 'Prague' }])

    const days = { from: civil('2026-10-11'), to: civil('2026-10-15') }
    await store.write('Changed', (unit) => changeEvent(unit, store.state.workbook!.events[0]!, { name: 'Praha', days }))
    expect(store.state.workbook!.events).toEqual([{ id: prague.id, name: 'Praha', days }])

    await expect(store.write('Changed', (unit) => changeEvent(unit, store.state.workbook!.events[0]!, { name: 'Praha', days: { from: days.to, to: days.from } }))).rejects.toThrow()
    expect(store.state.workbook!.problems).toEqual([])
  })

  it('puts a row in an event, takes another out of every event and puts it back on its day, each in one write', async () => {
    const store = await storeWith([dinner, hotel], [PRAGUE])

    await store.write('In', (unit) => chooseEvent(unit, store.state.records!, [dinner], PRAGUE.id))
    await store.write('Out', (unit) => chooseEvent(unit, store.state.records!, [hotel], OUT_OF_EVENTS))
    expect(choicesOf(store)).toEqual([PRAGUE.id, OUT_OF_EVENTS])

    await store.write('Back', (unit) => chooseEvent(unit, store.state.records!, [hotel], BY_DAYS))
    expect(choicesOf(store)).toEqual([PRAGUE.id, BY_DAYS])
  })

  it('deletes an event and puts every part it held by hand back on its day, and one Undo puts both back', async () => {
    const store = await storeWith([dinner, hotel], [PRAGUE], [{ ...wholeItems([dinner])[0]!, event: PRAGUE.id }, ...wholeItems([hotel])])

    const written = await store.write('Deleted', (unit) => deleteEvent(unit, store.state.records!, PRAGUE))
    expect(store.state.workbook!.events).toEqual([])
    expect(choicesOf(store)).toEqual([BY_DAYS, BY_DAYS])

    await store.undo(store.state.writes.find((write) => write.receipt === written)!)
    expect(store.state.workbook!.events).toEqual([PRAGUE])
    expect(choicesOf(store)).toEqual([PRAGUE.id, BY_DAYS])
  })

  it('keeps an item that names an event the file lacks, doubted, and lets it join an event by its day', async () => {
    const store = await storeWith([dinner], [], [{ ...wholeItems([dinner])[0]!, event: PRAGUE.id }])
    const book = store.state.workbook!

    expect(book.transactions).toHaveLength(1)
    expect(book.problems.map((problem) => [problem.kind, problem.reason])).toEqual([['item', 'names an event prague that is not in the file, so it joins an event by its day']])
  })
})

describe('what a person chose for money, through a re-split', () => {
  const [whole] = wholeItems([hotel])
  const part = (key: string, amount: number, fields: Partial<TransactionItem> = {}): TransactionItem => ({
    ...whole!,
    id: recordIdOf(ITEM_RECORDS, key),
    amount: accountMoneyFromAmount(amount),
    ...fields,
  })

  it('lets a part that kept its id keep its own choice, and gives a new part the choice of the largest part it took money from', () => {
    const found = [part('room', -250, { event: PRAGUE.id }), part('tax', -50, { event: OUT_OF_EVENTS })]
    const left = [part('room', -200, { event: PRAGUE.id }), part('tax', -50, { event: OUT_OF_EVENTS }), part('breakfast', -50)]

    expect(carriedChoices(found, left).map((item) => [item.id, item.event])).toEqual([
      [found[0]!.id, PRAGUE.id],
      [found[1]!.id, OUT_OF_EVENTS],
      [left[2]!.id, PRAGUE.id],
    ])
  })

  it('keeps a row put in an event in it when it is split and when the split comes off', async () => {
    const store = await storeWith([hotel], [PRAGUE], [{ ...whole!, event: OUT_OF_EVENTS }])
    const entry = () => store.state.workbook!.transactions[0]!

    await store.write('Split', (unit) =>
      writeRows(unit, store.state.records!, [{ before: entry(), after: entry(), items: [part('room', -250, { event: BY_DAYS }), part('breakfast', -50, { event: BY_DAYS })] }]),
    )
    expect(choicesOf(store)).toEqual([OUT_OF_EVENTS, OUT_OF_EVENTS])

    await store.write('Unsplit', (unit) => removeSplitOf(unit, store.state.records!, entry()))
    expect(choicesOf(store)).toEqual([OUT_OF_EVENTS])
  })

  it('keeps the choice a new part already has', () => {
    const found = [part('room', -300, { event: PRAGUE.id })]
    const left = [part('room', -200, { event: PRAGUE.id }), part('breakfast', -100, { event: OUT_OF_EVENTS })]

    expect(carriedChoices(found, left).map((item) => item.event)).toEqual([PRAGUE.id, OUT_OF_EVENTS])
  })
})
