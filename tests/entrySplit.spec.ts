import 'fake-indexeddb/auto'
import { BY_DAYS, OUT_OF_EVENTS } from '../src/apps/spending/workbook/domain/event'
import type { Label } from '../src/shared/categorising/domain/labels'
import { afterEach, describe, expect, it } from 'vitest'

import { spendingFigures } from '../src/apps/spending/analytics/domain/spendingFigures'
import { removeSplitOf, writeEntrySplit } from '../src/apps/spending/entries/application/entryWrites'
import { writeRows } from '../src/apps/spending/entries/application/rowRecords'
import { newLabel } from '../src/apps/spending/labels/domain/labels'
import { addLabel, labelRows } from '../src/apps/spending/labels/application/labelWrites'
import { plainLineOf } from '../src/apps/spending/workbook/domain/beforeItems'
import { differenceItem, entrySplit, newPartChoices } from '../src/apps/spending/entries/domain/entrySplit'
import { wholeRowItemId } from '../src/apps/spending/workbook/domain/rowItems'
import { mainCategoryOf } from '../src/shared/categorising/domain/mainCategory'
import type { EntrySplit, ItemDraft, PartChoices } from '../src/apps/spending/entries/domain/entrySplit'
import { splittableRows } from '../src/apps/spending/receipts/domain/receiptMatch'
import { rowPlace } from '../src/apps/spending/receipts/domain/receiptSplit'
import { codecOfSpendingKind } from '../src/apps/spending/workbook/application/spendingCodecs'
import type { TransactionItem } from '../src/apps/spending/workbook/domain/transactionItem'
import type { Receipt } from '../src/apps/spending/workbook/domain/receipt'
import type { SpendingBooks } from '../src/apps/spending/workbook/domain/spendingBooks'
import {
  ACCOUNT_RECORDS,
  CATEGORY_RECORDS,
  EVENT_RECORDS,
  ITEM_RECORDS,
  LABEL_RECORDS,
  LINE_RECORDS,
  RECEIPT_RECORDS,
  SHARED_COST_RECORDS,
  TRANSACTION_RECORDS,
} from '../src/apps/spending/workbook/domain/spendingKinds'
import { BLANK_CELLS, storedRowOf } from '../src/apps/spending/workbook/domain/transaction'
import type { StoredRow, Transaction } from '../src/apps/spending/workbook/domain/transaction'
import { spendingDocumentOf } from '../src/apps/spending/workbook/infrastructure/spendingDocument'
import { accountMoneyFromAmount } from '../src/shared/money/accountMoney'
import { moneyFromAmount } from '../src/shared/money/money'
import { NO_RATES } from '../src/shared/money/rateBook'
import type { WorkbookStore } from '../src/shared/storage/application/createWorkbookStore'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import type { RecordKind } from '../src/shared/storage/domain/recordKind'
import { month } from './fixtures/ledger'
import { ACCOUNTS, CATEGORIES, OTP, REVOLUT_USD, bookItems, category, filedRows, row, wholeItems } from './fixtures/spending'
import { SPENDING, browserHarness, forgetCaches } from './fixtures/writeBack'

const used = new Set<string>()
afterEach(async () => forgetCaches(used))

const GROCERIES = category('Food/Groceries')
const RESTAURANTS = category('Food/Eating out')
const FOOD = category('Food')
const COMPANY = CATEGORIES.find((held) => held.kind === 'company')!
const TRANSFER = CATEGORIES.find((held) => held.kind === 'transfer')!
const SALARY = category('Income/Salary')

const BOOK = { categories: CATEGORIES, receipts: [] as readonly Receipt[], items: [] as readonly TransactionItem[] }

/** The book of the one row, not split. */
const bookOf = (stored: StoredRow) => ({ ...BOOK, items: wholeItems([stored]) })

let keyPlace = 0
function keys(): () => string {
  return () => `5e5e0000-0000-4000-8000-${String((keyPlace += 1)).padStart(12, '0')}`
}

const part = (amount: number | 'rest', on: { readonly id: ItemDraft['category'] }, note = '', id: ItemDraft['id'] = null, choices?: PartChoices): ItemDraft => ({
  id,
  amount: amount === 'rest' ? 'rest' : accountMoneyFromAmount(amount),
  category: on.id,
  note,
  ...(choices === undefined ? {} : { choices }),
})

function splitOf(row: StoredRow | Transaction, drafts: readonly ItemDraft[], book: Pick<SpendingBooks['workbook'], 'categories' | 'receipts' | 'items'> = bookOf(row as StoredRow)): EntrySplit {
  const split = entrySplit(book, row, drafts, keys())
  if ('refused' in split) throw new Error(`refused: ${split.refused}`)
  return split
}

describe('an entry split by hand', () => {
  const spend = row(OTP, '2026-11-04', -100, 'Food/Groceries', { payee: 'Market' })

  it('places each part signed as the entry, gives the rest what is left, and files the row under the category with most of the money', () => {
    const split = splitOf(spend, [part(-20, GROCERIES, ' Bread '), part(-35.5, COMPANY), part('rest', RESTAURANTS)])

    expect(split.parts.map((held) => [held.amount, held.category, held.note, held.receipt])).toEqual([
      [accountMoneyFromAmount(-20), GROCERIES.id, 'Bread', null],
      [accountMoneyFromAmount(-35.5), COMPANY.id, '', null],
      [accountMoneyFromAmount(-44.5), RESTAURANTS.id, '', null],
    ])
    expect(split.parts.every((held) => held.transaction === spend.id)).toBe(true)
    expect(split.row).toEqual({ ...spend, categorisedBy: 'person' })
    expect(split.before).toEqual({ row: spend, items: wholeItems([spend]) })
    expect(split.parts[0]!.id).toBe(wholeRowItemId(spend))
  })

  it("keeps on each part it holds that part's own link, and gives a new part the entry's link only when its parts name one record", () => {
    const movement = { app: 'loans', kind: 'movement', key: 'made-up-movement', due: null }
    const extra = { app: 'loans', kind: 'extra-payment', key: 'made-up-extra', due: null }
    const [whole] = wholeItems([spend])
    const held = [
      { ...whole!, amount: accountMoneyFromAmount(-60), link: movement },
      { ...whole!, id: recordIdOf(ITEM_RECORDS, 'made-up-held'), amount: accountMoneyFromAmount(-40), link: extra },
    ]
    const drafts = [part(-50, GROCERIES, '', held[0]!.id), part(-30, GROCERIES, '', held[1]!.id), part('rest', RESTAURANTS)]
    expect(splitOf(spend, drafts, { ...BOOK, items: held }).parts.map((piece) => piece.link)).toEqual([movement, extra, null])

    const oneLink = held.map((piece) => ({ ...piece, link: movement }))
    expect(splitOf(spend, drafts, { ...BOOK, items: oneLink }).parts.map((piece) => piece.link)).toEqual([movement, movement, movement])
  })

  it('keeps a part left without a shared cost in its own while it keeps its id and category, and takes it out when its category changes or it is given none', () => {
    const shared = recordIdOf(SHARED_COST_RECORDS, 'made-up-shared')
    const [whole] = wholeItems([spend])
    const held = [
      { ...whole!, amount: accountMoneyFromAmount(-60), sharedCost: shared },
      { ...whole!, id: recordIdOf(ITEM_RECORDS, 'made-up-member'), amount: accountMoneyFromAmount(-40), sharedCost: shared },
    ]
    const book = { ...BOOK, items: held }
    const drafts = [part(-50, GROCERIES, 'Note only', held[0]!.id), part(-30, RESTAURANTS, '', held[1]!.id), part('rest', GROCERIES)]
    expect(splitOf(spend, drafts, book).parts.map((piece) => piece.sharedCost)).toEqual([shared, null, null])

    const takenOut = [{ ...drafts[0]!, sharedCost: null }, drafts[1]!, drafts[2]!]
    expect(splitOf(spend, takenOut, book).parts.map((piece) => piece.sharedCost)).toEqual([null, null, null])
  })

  it('gives each part the labels and event choice it was given', () => {
    const treat = recordIdOf(LABEL_RECORDS, 'treat')
    const trip = recordIdOf(EVENT_RECORDS, 'trip')
    const split = splitOf(spend, [part(-30, RESTAURANTS, '', null, { labels: [treat], event: trip }), part('rest', GROCERIES), part(-10, COMPANY, '', null, { labels: [], event: OUT_OF_EVENTS })])

    expect(split.parts.map((held) => [held.labels, held.ruleLabels, held.event])).toEqual([
      [[treat], [], trip],
      [[], [], BY_DAYS],
      [[], [], OUT_OF_EVENTS],
    ])
    expect([...split.chosen]).toEqual([split.parts[0]!.id, split.parts[2]!.id])
  })

  it('keeps on a part only those of its rule labels it still carries', () => {
    const [rule, kept, byHand] = ['rule', 'kept', 'by-hand'].map((key) => recordIdOf(LABEL_RECORDS, key))
    const [whole] = wholeItems([spend])
    const held = { ...whole!, labels: [rule!, kept!, byHand!], ruleLabels: [rule!, kept!] }

    const split = splitOf(spend, [part(-30, RESTAURANTS, '', held.id, { labels: [kept!, byHand!], event: BY_DAYS }), part('rest', GROCERIES, '', null, { labels: [rule!], event: BY_DAYS })], {
      ...BOOK,
      items: [held],
    })

    expect(split.parts.map((piece) => [piece.labels, piece.ruleLabels])).toEqual([
      [[kept, byHand], [kept]],
      [[rule], []],
    ])
  })

  it('starts a part added to a split with the labels every part carries and the event choice of the largest, so a label on one half stays there', () => {
    const [first, second] = ['first', 'second'].map((key) => recordIdOf(LABEL_RECORDS, key))
    const trip = recordIdOf(EVENT_RECORDS, 'trip')
    const [whole] = wholeItems([spend])
    const held: TransactionItem[] = [
      { ...whole!, amount: accountMoneyFromAmount(-30), labels: [first!], event: OUT_OF_EVENTS },
      { ...whole!, amount: accountMoneyFromAmount(-70), labels: [second!, first!], event: trip },
    ]

    expect(newPartChoices(held)).toEqual({ labels: [first], event: trip })
    expect(newPartChoices([])).toEqual({ labels: [], event: BY_DAYS })
  })

  it('splits money in as money in', () => {
    const refund = row(OTP, '2026-11-04', 50, 'Income/Salary')
    expect(splitOf(refund, [part(10, GROCERIES), part('rest', SALARY)]).parts.map((held) => held.amount)).toEqual([accountMoneyFromAmount(10), accountMoneyFromAmount(40)])
  })

  it.each([
    ['too-few', [part('rest', GROCERIES)]],
    ['one-rest', [part(-20, GROCERIES), part(-80, RESTAURANTS)]],
    ['zero-part', [part(0, GROCERIES), part('rest', RESTAURANTS)]],
    ['wrong-sign', [part(20, GROCERIES), part('rest', RESTAURANTS)]],
    ['over', [part(-100, GROCERIES), part('rest', RESTAURANTS)]],
    ['group-with-children', [part(-20, FOOD), part('rest', RESTAURANTS)]],
    ['between-accounts', [part(-20, TRANSFER), part('rest', RESTAURANTS)]],
    ['unknown-category', [{ ...part(-20, GROCERIES), category: recordIdOf(CATEGORY_RECORDS, 'gone') }, part('rest', RESTAURANTS)]],
  ] as const)('refuses as %s', (reason, drafts) => {
    expect(entrySplit(bookOf(spend), spend, drafts)).toEqual({ refused: reason })
  })

  it("refuses a transfer's leg and an entry a receipt split, which stay as they are", () => {
    const drafts = [part(-20, GROCERIES), part('rest', RESTAURANTS)]
    expect(entrySplit(bookOf(spend), { ...spend, pair: row(OTP, '2026-11-04', 100, null).id }, drafts)).toEqual({ refused: 'transfer-leg' })
    expect(entrySplit(bookOf({ ...spend, category: TRANSFER.id }), spend, drafts)).toEqual({ refused: 'transfer-leg' })
    const receipt = { id: recordIdOf(RECEIPT_RECORDS, 'receipt'), transaction: spend.id } as Receipt
    expect(entrySplit({ ...bookOf(spend), receipts: [receipt] }, spend, drafts)).toEqual({ refused: 'receipt' })
  })

  it('files the row under the first category on a tie', () => {
    const half = accountMoneyFromAmount(-50)
    expect(
      mainCategoryOf([
        { amount: half, category: GROCERIES.id },
        { amount: half, category: RESTAURANTS.id },
      ]),
    ).toBe(GROCERIES.id)
  })
})

describe('the Difference part', () => {
  const like = { transaction: row(OTP, '2026-11-04', -25, null).id, receipt: null, category: GROCERIES.id, link: null }

  it('takes what the whole adds past the parts, of either sign, and is not there when they add up', () => {
    expect(differenceItem(accountMoneyFromAmount(-25), [{ amount: accountMoneyFromAmount(-23.49) }], like, 'Difference', keys())).toMatchObject({
      amount: accountMoneyFromAmount(-1.51),
      category: GROCERIES.id,
      receipt: null,
      note: 'Difference',
    })
    expect(differenceItem(accountMoneyFromAmount(-20), [{ amount: accountMoneyFromAmount(-23.49) }], like, 'Difference')?.amount).toBe(accountMoneyFromAmount(3.49))
    expect(differenceItem(accountMoneyFromAmount(-25), [{ amount: accountMoneyFromAmount(-25) }], like, 'Difference')).toBeNull()
  })
})

function stored<R>(kind: RecordKind<R>, records: readonly R[]) {
  const codec = codecOfSpendingKind(kind)
  return { [kind.name]: records.map((record) => codec.fieldsOf(record)) }
}

/** Where the file keeps a row's parts: as items, or as lines of a file from before items. */
type Shape = 'items' | 'before-items'

async function storeWith(rows: readonly StoredRow[], parts: readonly TransactionItem[] = [], shape: Shape = 'before-items'): Promise<WorkbookStore<SpendingBooks>> {
  const entries =
    shape === 'before-items'
      ? { ...stored(TRANSACTION_RECORDS, rows), ...stored(LINE_RECORDS, parts.map(plainLineOf)) }
      : {
          ...stored(
            TRANSACTION_RECORDS,
            rows.map((held) => storedRowOf(held, BLANK_CELLS)),
          ),
          ...stored(ITEM_RECORDS, bookItems(rows, parts)),
        }
  const document = spendingDocumentOf('2026-11-04T09:00:00.000Z', {
    ...stored(ACCOUNT_RECORDS, ACCOUNTS),
    ...stored(CATEGORY_RECORDS, CATEGORIES),
    ...entries,
  })
  const { store } = await browserHarness(used, document, SPENDING)
  return store
}

describe('the file with parts no receipt split', () => {
  const spend = row(OTP, '2026-11-04', -100, 'Food/Groceries')
  const handParts = splitOf(spend, [part(-30, RESTAURANTS), part('rest', GROCERIES)]).parts

  it('stores a part with no receipt as a blank field, as an item and as a line of a file from before items', () => {
    expect([ITEM_RECORDS.name, LINE_RECORDS.name]).toEqual(['item', 'line'])
    expect(codecOfSpendingKind(ITEM_RECORDS).fieldsOf(handParts[0]!)).not.toHaveProperty('receipt')
    expect(codecOfSpendingKind(LINE_RECORDS).fieldsOf(plainLineOf(handParts[0]!))).not.toHaveProperty('receipt')
  })

  it('counts the parts in place of the entry and its category', async () => {
    const store = await storeWith([spend], handParts)
    const book = store.state.workbook!
    expect(book.problems).toEqual([])
    expect(book.items.map((held) => [held.receipt, held.amount])).toEqual([
      [null, accountMoneyFromAmount(-30)],
      [null, accountMoneyFromAmount(-70)],
    ])
    const totals = spendingFigures(book, NO_RATES).totalsOf(month('2026-11')).byCategory
    expect([totals.get(RESTAURANTS.id), totals.get(GROCERIES.id)]).toEqual([moneyFromAmount(30), moneyFromAmount(70)])
  })

  it('refuses parts that do not add up to the entry, and leaves out their sibling with them', async () => {
    const store = await storeWith([spend], [handParts[0]!, { ...handParts[1]!, amount: accountMoneyFromAmount(-60) }])
    const book = store.state.workbook!
    expect(book.items).toEqual(wholeItems([spend]))
    expect(book.problems.map((problem) => problem.reason)).toEqual([
      'the parts of its entry add up to -90.00, and the entry says -100.00',
      'the parts of its entry add up to -90.00, and the entry says -100.00',
    ])
  })

  it('counts a part of the other sign, as a discount is, once the parts add up to the entry', async () => {
    const discount = { ...handParts[1]!, id: recordIdOf(ITEM_RECORDS, keys()()), amount: accountMoneyFromAmount(10) }
    const store = await storeWith([spend], [handParts[0]!, { ...handParts[1]!, amount: accountMoneyFromAmount(-80) }, discount])
    const book = store.state.workbook!
    expect(book.problems).toEqual([])
    expect(book.items.map((held) => held.amount)).toEqual([accountMoneyFromAmount(-30), accountMoneyFromAmount(-80), accountMoneyFromAmount(10)])
  })

  it('lets a row split by hand take a receipt, whose lines then replace its parts', async () => {
    const other = row(OTP, '2026-11-04', -12, 'Food/Groceries')
    const store = await storeWith([spend, other], handParts)
    const book = store.state.workbook!
    expect(splittableRows(book).map((held) => held.id)).toEqual([spend.id, other.id])
    expect(rowPlace(spend, book.items)).toEqual({ row: spend, held: handParts })
  })
})

describe.each<Shape>(['items', 'before-items'])('writing a hand split to a file of %s', (shape) => {
  it('writes the row and its parts in one write, puts new parts in place of old ones, and removing the split keeps the row under its main category', async () => {
    const spend = row(OTP, '2026-11-04', -100, 'Food/Groceries')
    const store = await storeWith([spend], [], shape)
    const records = () => store.state.records!
    const book = () => store.state.workbook!

    await store.write('Split', (unit) => writeEntrySplit(unit, records(), splitOf(spend, [part(-60, RESTAURANTS), part(-25, COMPANY), part('rest', GROCERIES)])))
    expect(book().problems).toEqual([])
    expect(book().items.map((held) => held.amount)).toEqual([accountMoneyFromAmount(-60), accountMoneyFromAmount(-25), accountMoneyFromAmount(-15)])
    const split = book().transactions[0]!
    expect(filedRows(book())[0]).toMatchObject({ category: RESTAURANTS.id, categorisedBy: 'person', amount: spend.amount })

    await store.write('Split again', (unit) => writeEntrySplit(unit, records(), splitOf(split, [part(-10, GROCERIES), part('rest', COMPANY)], book())))
    expect(book().items.map((held) => [held.amount, held.category])).toEqual([
      [accountMoneyFromAmount(-10), GROCERIES.id],
      [accountMoneyFromAmount(-90), COMPANY.id],
    ])
    expect(filedRows(book())[0]!.category).toBe(COMPANY.id)

    await store.write('Removed', (unit) => removeSplitOf(unit, records(), book().transactions[0]!))
    expect(book().items).toEqual([{ ...wholeItems([spend])[0]!, category: COMPANY.id }])
    expect(filedRows(book())[0]).toMatchObject({ category: COMPANY.id, amount: spend.amount })
    expect(records().transactions.records[0]!.record.category).toBe(shape === 'before-items' ? COMPANY.id : null)
    expect([records().lines.records.length, records().items.records.length]).toEqual(shape === 'before-items' ? [0, 0] : [0, 1])
  })

  it("refuses a change to the entry's amount that its parts no longer add up to", async () => {
    const spend = row(REVOLUT_USD, '2026-11-04', -100, 'Food/Groceries')
    const store = await storeWith([spend], splitOf(spend, [part(-30, RESTAURANTS), part('rest', GROCERIES)]).parts, shape)
    const held = store.state.workbook!.transactions[0]!
    await expect(store.write('Changed', (unit) => writeRows(unit, store.state.records!, [{ before: held, after: { ...held, amount: accountMoneyFromAmount(-90) } }]))).rejects.toThrow(/add up/)
    const [first, second] = store.state.workbook!.items
    await expect(
      store.write('Changed', (unit) => writeRows(unit, store.state.records!, [{ before: held, after: held, items: [{ ...first!, amount: accountMoneyFromAmount(-20) }, second!] }])),
    ).rejects.toThrow(/add up/)
  })
})

describe.each<Shape>(['items', 'before-items'])('which part keeps its id in a file of %s', (shape) => {
  const spend = row(OTP, '2026-11-04', -100, 'Food/Groceries')
  const whole = wholeRowItemId(spend)

  async function splitOnFile() {
    const store = await storeWith([spend], [], shape)
    const records = () => store.state.records!
    const book = () => store.state.workbook!
    const write = (drafts: readonly ItemDraft[]) => store.write('Split', (unit) => writeEntrySplit(unit, records(), splitOf(book().transactions[0]!, drafts, book())))
    return { store, records, book, write }
  }

  it('gives the first part of an entry not yet split the id of the part the entry stood for', async () => {
    const { book, write } = await splitOnFile()

    await write([part(-60, RESTAURANTS), part('rest', GROCERIES)])

    expect(book().items[0]!.id).toBe(whole)
    expect(whole).toBe(recordIdOf(ITEM_RECORDS, spend.id.slice(`${TRANSACTION_RECORDS.name}:`.length)))
  })

  it('keeps the id of a part opened from the entry, even when its amount, category and words change, and the order of the parts with it', async () => {
    const { book, write } = await splitOnFile()
    await write([part(-60, RESTAURANTS), part('rest', GROCERIES)])
    const [big, small] = book().items

    await write([part('rest', COMPANY, 'Paper', small!.id), part(-30, RESTAURANTS, '', big!.id)])

    expect(book().items.map((held) => [held.id, held.amount, held.category, held.note])).toEqual([
      [big!.id, accountMoneyFromAmount(-30), RESTAURANTS.id, ''],
      [small!.id, accountMoneyFromAmount(-70), COMPANY.id, 'Paper'],
    ])
    expect(book().problems).toEqual([])
  })

  it('leaves the entry as the one part it stands for when the split comes off', async () => {
    const { store, records, book, write } = await splitOnFile()
    await write([part(-60, RESTAURANTS), part('rest', GROCERIES)])

    await store.write('Removed', (unit) => removeSplitOf(unit, records(), book().transactions[0]!))

    expect(book().items.map((held) => held.id)).toEqual([whole])
  })
})

describe('the labels of a split', () => {
  const spend = row(OTP, '2026-11-04', -100, 'Food/Groceries')

  async function labelledOnFile() {
    const store = await storeWith([spend], [], 'items')
    const records = () => store.state.records!
    const book = () => store.state.workbook!
    let trip: Label | null = null
    let flat: Label | null = null
    await store.write('Labelled', (unit) => {
      trip = newLabel('Prague')
      flat = newLabel('New flat')
      addLabel(unit, trip)
      addLabel(unit, flat)
      labelRows(unit, records(), [spend], trip.id, true)
    })
    const write = (drafts: readonly ItemDraft[]) => store.write('Split', (unit) => writeEntrySplit(unit, records(), splitOf(book().transactions[0]!, drafts, book())))
    return { store, records, book, write, trip: trip!, flat: flat! }
  }
  const labelsOf = (items: readonly TransactionItem[]) => items.map((held) => held.labels)

  it('gives every part split off the labels of the part it took money from', async () => {
    const { book, write, trip } = await labelledOnFile()

    await write([part(-60, RESTAURANTS), part('rest', GROCERIES)])

    expect(labelsOf(book().items)).toEqual([[trip.id], [trip.id]])
    expect(book().problems).toEqual([])
  })

  it('lets a part nobody set labels on keep its own when it kept its id and did not grow, and take the labels of the parts it replaces when it grew', async () => {
    const { store, records, book, write, trip, flat } = await labelledOnFile()
    await write([part(-50, RESTAURANTS), part(-30, COMPANY), part('rest', GROCERIES)])
    const [restaurant, company, groceries] = book().items
    await store.write('Relabelled', (unit) =>
      writeRows(unit, records(), [{ before: book().transactions[0]!, after: book().transactions[0]!, items: [restaurant!, { ...company!, labels: [flat.id] }, { ...groceries!, labels: [] }] }]),
    )

    await write([part(-40, RESTAURANTS, '', restaurant!.id), part(-20, GROCERIES, '', groceries!.id), part('rest', SALARY)])

    expect(book().items.map((held) => [held.id, held.labels])).toEqual([
      [restaurant!.id, [trip.id]],
      [groceries!.id, []],
      [expect.any(String), [trip.id, flat.id]],
    ])
  })

  it('writes the labels and event set on each part as they are, so a label taken off stays off and a new part takes nothing of the part it took money from', async () => {
    const { book, write, flat } = await labelledOnFile()
    const [whole] = book().items

    await write([part(-60, RESTAURANTS, '', whole!.id, { labels: [], event: BY_DAYS }), part('rest', GROCERIES, '', null, { labels: [flat.id], event: OUT_OF_EVENTS })])

    expect(book().items.map((held) => [held.labels, held.event])).toEqual([
      [[], BY_DAYS],
      [[flat.id], OUT_OF_EVENTS],
    ])
  })

  it('keeps the labels set on a part that grew, where a part that grew with none set takes those of the parts it replaces', async () => {
    const { store, records, book, write, trip, flat } = await labelledOnFile()
    await write([part(-50, RESTAURANTS), part(-30, COMPANY), part('rest', GROCERIES)])
    const [restaurant, company] = book().items
    await store.write('Relabelled', (unit) =>
      writeRows(unit, records(), [{ before: book().transactions[0]!, after: book().transactions[0]!, items: [restaurant!, { ...company!, labels: [flat.id] }, book().items[2]!] }]),
    )

    await write([part(-70, RESTAURANTS, '', restaurant!.id, { labels: restaurant!.labels, event: restaurant!.event }), part('rest', GROCERIES, '', book().items[2]!.id)])

    expect(labelsOf(book().items)).toEqual([[trip.id], [trip.id, flat.id]])
  })

  it('gives the one part left when the split comes off every label of its parts', async () => {
    const { store, records, book, write, trip, flat } = await labelledOnFile()
    await write([part(-60, RESTAURANTS), part('rest', GROCERIES)])
    const [first, second] = book().items
    await store.write('Relabelled', (unit) => writeRows(unit, records(), [{ before: book().transactions[0]!, after: book().transactions[0]!, items: [first!, { ...second!, labels: [flat.id] }] }]))

    await store.write('Removed', (unit) => removeSplitOf(unit, records(), book().transactions[0]!))

    expect(labelsOf(book().items)).toEqual([[trip.id, flat.id]])
  })
})
