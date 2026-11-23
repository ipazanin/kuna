import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { deleteInto } from '../src/apps/spending/categories/application/categoryWrites'
import { deleteEvent } from '../src/apps/spending/events/application/eventWrites'
import { deleteLabel } from '../src/apps/spending/labels/application/labelWrites'
import { addSharedCost, changeSharedCost, deleteSharedCost, joinSharedCost, leaveSharedCost, newSharedCost } from '../src/apps/spending/sharedCosts/application/sharedCostWrites'
import { spendingFigures } from '../src/apps/spending/analytics/domain/spendingFigures'
import { fileRows } from '../src/apps/spending/statements/application/statementWrites'
import { codecOfSpendingKind } from '../src/apps/spending/workbook/application/spendingCodecs'
import { BY_DAYS } from '../src/apps/spending/workbook/domain/event'
import type { SpendingEvent } from '../src/apps/spending/workbook/domain/event'
import { waitsOnReview } from '../src/apps/spending/workbook/domain/rowItems'
import { ACCOUNT_RECORDS, CATEGORY_RECORDS, EVENT_RECORDS, ITEM_RECORDS, LABEL_RECORDS, TRANSACTION_RECORDS } from '../src/apps/spending/workbook/domain/spendingKinds'
import { BLANK_CELLS, storedRowOf } from '../src/apps/spending/workbook/domain/transaction'
import type { StoredRow } from '../src/apps/spending/workbook/domain/transaction'
import type { TransactionItem } from '../src/apps/spending/workbook/domain/transactionItem'
import { spendingDocumentOf } from '../src/apps/spending/workbook/infrastructure/spendingDocument'
import type { Label } from '../src/shared/categorising/domain/labels'
import { monthKey } from '../src/shared/calendar/monthKey'
import { accountMoneyFromAmount } from '../src/shared/money/accountMoney'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import type { RecordKind } from '../src/shared/storage/domain/recordKind'
import { civil, euros } from './fixtures/ledger'
import { ACCOUNTS, CATEGORIES, OTP, RATES, bookItems, category, row } from './fixtures/spending'
import { SPENDING, browserHarness, forgetCaches } from './fixtures/writeBack'

const used = new Set<string>()
afterEach(async () => forgetCaches(used))

const GIFTS = category('Family and gifts/Gifts')
const EATING_OUT = category('Food/Eating out')
const FILED_IN = category('In a shared cost')
const PARTY: Label = { id: recordIdOf(LABEL_RECORDS, 'label-party'), name: 'Party' }
const BIRTHDAY: SpendingEvent = { id: recordIdOf(EVENT_RECORDS, 'event-birthday'), name: 'Birthday week', days: { from: civil('2026-11-18'), to: civil('2026-11-24') } }

const bookshop = row(OTP, '2026-11-20', -40.14, 'Family and gifts/Gifts', { payee: 'Bookshop' })
const toyShop = row(OTP, '2026-11-20', -81.1, 'Family and gifts/Gifts', { payee: 'Toy shop' })
const marko = row(OTP, '2026-11-25', 57.08, null, { payee: 'Marko' })
/** A dinner split in two: the gift part joins, the meal part stays under Eating out. */
const dinner = row(OTP, '2026-11-21', -60, 'Food/Eating out', { payee: 'Harbour bistro' })
const [meal, cake] = [
  { ...bookItems([dinner])[0]!, amount: accountMoneyFromAmount(-40) },
  { ...bookItems([dinner])[0]!, id: recordIdOf(ITEM_RECORDS, 'dinner-cake'), amount: accountMoneyFromAmount(-20), category: GIFTS.id, labels: [PARTY.id] },
] satisfies TransactionItem[]

function stored<R>(kind: RecordKind<R>, records: readonly R[]) {
  const codec = codecOfSpendingKind(kind)
  return { [kind.name]: records.map((record) => codec.fieldsOf(record)) }
}

async function storeWith(rows: readonly StoredRow[], items: readonly TransactionItem[] = []) {
  const document = spendingDocumentOf('2026-11-04T09:00:00.000Z', {
    ...stored(ACCOUNT_RECORDS, ACCOUNTS),
    ...stored(CATEGORY_RECORDS, CATEGORIES),
    ...stored(LABEL_RECORDS, [PARTY]),
    ...stored(EVENT_RECORDS, [BIRTHDAY]),
    ...stored(
      TRANSACTION_RECORDS,
      rows.map((held) => storedRowOf(held, BLANK_CELLS)),
    ),
    ...stored(ITEM_RECORDS, bookItems(rows, items)),
  })
  return (await browserHarness(used, document, SPENDING)).store
}

const GIFT = newSharedCost({ day: civil('2026-11-20'), payee: ' Ana ', category: GIFTS.id, labels: [], event: BY_DAYS, note: '', settled: false })

describe('making a shared cost', () => {
  it('adds it and puts rows in it in one write, each part under In a shared cost, and one Undo takes both back', async () => {
    const store = await storeWith([bookshop, toyShop, marko])
    const book = () => store.state.workbook!

    await store.write('Shared', (unit) => {
      addSharedCost(unit, GIFT)
      joinSharedCost(unit, store.state.records!, book().categories, [bookshop, toyShop, marko], GIFT, 'en')
    })

    expect(book().problems).toEqual([])
    expect(book().sharedCosts).toEqual([{ ...GIFT, payee: 'Ana' }])
    expect(book().items.map((item) => [item.category, item.sharedCost])).toEqual([
      [FILED_IN.id, GIFT.id],
      [FILED_IN.id, GIFT.id],
      [FILED_IN.id, GIFT.id],
    ])
    expect(book().transactions.map((held) => held.categorisedBy)).toEqual(['person', 'person', 'person'])
    // 40.14 and 81.10 paid, 57.08 back: 64.16 counts under Gifts.
    expect(spendingFigures(book(), RATES).totalsOf(monthKey(2026, 11)).byCategory.get(GIFTS.id)).toEqual(euros(64.16))

    await store.undo(store.state.writes[0]!)

    expect(book().sharedCosts).toEqual([])
    expect(book().items.map((item) => [item.category, item.sharedCost])).toEqual([
      [GIFTS.id, null],
      [GIFTS.id, null],
      [null, null],
    ])
  })

  it('puts one part of a split entry in it and leaves the other under its own category', async () => {
    const store = await storeWith([dinner], [meal, cake])
    const book = () => store.state.workbook!

    await store.write('Shared', (unit) => {
      addSharedCost(unit, GIFT)
      joinSharedCost(unit, store.state.records!, book().categories, [dinner], GIFT, 'en', new Set([cake.id]))
    })

    expect(book().items.map((item) => [item.category, item.sharedCost, item.labels])).toEqual([
      [EATING_OUT.id, null, []],
      [FILED_IN.id, GIFT.id, [PARTY.id]],
    ])
  })

  it('refuses a part linked to a record in another app, so an asset page and a shared cost never count the same money', async () => {
    const linked = row(OTP, '2026-11-20', -30, 'Family and gifts/Gifts', { payee: 'Toy shop', link: { app: 'assets', kind: 'asset', key: 'made-up-car', due: null } })
    const store = await storeWith([linked])

    await expect(
      store.write('Shared', (unit) => {
        addSharedCost(unit, GIFT)
        joinSharedCost(unit, store.state.records!, store.state.workbook!.categories, [linked], GIFT, 'en')
      }),
    ).rejects.toThrow()
    expect(store.state.workbook!.sharedCosts).toEqual([])
  })

  it('refuses a shared cost under a fixed category, which would count nowhere', async () => {
    const store = await storeWith([bookshop])

    await expect(store.write('Shared', (unit) => addSharedCost(unit, { ...GIFT, category: category('Between my accounts').id }))).rejects.toThrow()
  })
})

describe('changing a shared cost', () => {
  it('sets Settled and a new day, and counts its members on the new day', async () => {
    const store = await storeWith([bookshop])
    const book = () => store.state.workbook!
    await store.write('Shared', (unit) => {
      addSharedCost(unit, GIFT)
      joinSharedCost(unit, store.state.records!, book().categories, [bookshop], GIFT, 'en')
    })

    await store.write('Changed', (unit) => changeSharedCost(unit, book().sharedCosts[0]!, { ...book().sharedCosts[0]!, day: civil('2026-12-01'), settled: true }))

    expect(book().sharedCosts[0]).toMatchObject({ day: civil('2026-12-01'), settled: true })
    const figures = spendingFigures(book(), RATES)
    expect([figures.totalsOf(monthKey(2026, 11)).spent, figures.totalsOf(monthKey(2026, 12)).spent]).toEqual([euros(0), euros(40.14)])
  })

  it("gives a part that leaves the shared cost's category, and its own label back", async () => {
    const store = await storeWith([dinner], [meal, cake])
    const book = () => store.state.workbook!
    await store.write('Shared', (unit) => {
      addSharedCost(unit, { ...GIFT, category: EATING_OUT.id })
      joinSharedCost(unit, store.state.records!, book().categories, [dinner], GIFT, 'en', new Set([cake.id]))
    })

    await store.write('Left', (unit) => leaveSharedCost(unit, store.state.records!, book().sharedCosts, [dinner], new Set([cake.id])))

    expect(book().items.map((item) => [item.category, item.sharedCost, item.labels])).toEqual([
      [EATING_OUT.id, null, []],
      [EATING_OUT.id, null, [PARTY.id]],
    ])
  })
})

describe('deleting a shared cost', () => {
  it('sends its members back to To review with their labels, files only the waiting part again, and one Undo puts it all back', async () => {
    const store = await storeWith([dinner, bookshop], [meal, cake])
    const book = () => store.state.workbook!
    await store.write('Shared', (unit) => {
      addSharedCost(unit, GIFT)
      joinSharedCost(unit, store.state.records!, book().categories, [dinner, bookshop], GIFT, 'en', new Set([cake.id]))
    })

    await store.write('Deleted', (unit) => deleteSharedCost(unit, store.state.records!, book().sharedCosts[0]!))
    const deleted = store.state.writes[0]!

    expect(book().problems).toEqual([])
    expect(book().sharedCosts).toEqual([])
    const itemsOf = (held: StoredRow) => book().items.filter((item) => item.transaction === held.id)
    expect(itemsOf(dinner).map((item) => [item.category, item.sharedCost, item.labels])).toEqual([
      [EATING_OUT.id, null, []],
      [null, null, [PARTY.id]],
    ])
    expect([waitsOnReview(itemsOf(dinner)), waitsOnReview(itemsOf(bookshop))]).toEqual([true, true])
    expect(spendingFigures(book(), RATES).totalsOf(monthKey(2026, 11)).spent).toEqual(euros(40))

    await store.write('Filed', (unit) => fileRows(unit, store.state.records!, [book().transactions.find((held) => held.id === dinner.id)!], GIFTS))

    expect(itemsOf(dinner).map((item) => item.category)).toEqual([EATING_OUT.id, GIFTS.id])

    await store.undo(store.state.writes[0]!)
    await store.undo(deleted)

    expect(book().sharedCosts).toHaveLength(1)
    expect(itemsOf(dinner).map((item) => item.sharedCost)).toEqual([null, GIFT.id])
    expect(itemsOf(bookshop).map((item) => item.sharedCost)).toEqual([GIFT.id])
  })
})

describe('deleting what a shared cost names', () => {
  it('moves it to the category its own is deleted into, and takes off a deleted label and event', async () => {
    const store = await storeWith([bookshop])
    const book = () => store.state.workbook!
    await store.write('Shared', (unit) => addSharedCost(unit, { ...GIFT, labels: [PARTY.id], event: BIRTHDAY.id }))

    await store.write('Label', (unit) => deleteLabel(unit, store.state.records!, PARTY))
    await store.write('Event', (unit) => deleteEvent(unit, store.state.records!, BIRTHDAY))
    await store.write('Category', (unit) => deleteInto(unit, store.state.records!, GIFTS, EATING_OUT))

    expect(book().problems).toEqual([])
    expect(book().sharedCosts[0]).toMatchObject({ category: EATING_OUT.id, labels: [], event: BY_DAYS })
  })
})
