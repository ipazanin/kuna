import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { writeImport } from '../src/apps/company/imports/application/importStatements'
import type { ImportDryRun } from '../src/apps/company/imports/domain/importDryRun'
import { ownerAdvanceOfDraft, writeOwnerAdvance } from '../src/apps/company/packs/hr-doo/application/ownerAdvanceWrites'
import { proposedRepayments, repaidMoreThanPaid, repaymentChoices, repaymentsPlaced } from '../src/apps/company/packs/hr-doo/domain/advanceRepayments'
import { OWNER_ADVANCE_RECORDS } from '../src/apps/company/packs/hr-doo/domain/hrDooKinds'
import { hrDooWorkbook } from '../src/apps/company/packs/hr-doo/domain/hrDooPart'
import { OWNER_ADVANCE_WRITES } from '../src/apps/company/packs/hr-doo/domain/hrDooWrites'
import { ownerAdvances } from '../src/apps/company/packs/hr-doo/domain/ownerAdvances'
import { ITEM_WRITES } from '../src/apps/company/transactions/application/itemWrites'
import { presentedWorkbook } from '../src/apps/company/transactions/domain/presentedWorkbook'
import { ITEM_RECORDS } from '../src/apps/company/workbook/domain/coreKinds'
import { ledgerIdOf } from '../src/apps/company/workbook/domain/ledgerReading'
import type { LedgerEntry } from '../src/apps/company/workbook/domain/ledgerReading'
import { recordsOfKindIn } from '../src/apps/company/workbook/domain/readWorkbook'
import { fakeWorkbookDocument, fakeWorkbookDocumentBeforeItems } from '../src/apps/company/workbook/infrastructure/fake/fakeWorkbook'
import { addMoney } from '../src/shared/money/money'
import { WorkbookWriteRefused } from '../src/shared/storage/application/workbookWriteRefused'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { recordsOf } from '../src/shared/storage/domain/recordsRead'
import { civil, euros } from './fixtures/ledger'
import { browserHarness, forgetCaches } from './fixtures/writeBack'
import type { WriteBackHarness } from './fixtures/writeBack'

const used = new Set<string>()

afterEach(async () => {
  await forgetCaches(used)
})

const SAVED = '2026-10-16T09:00:00.000Z'
const PARKING = 'Refund of a parking fee'

type Store = WriteBackHarness['store']

async function storeOf(onItemsTab: boolean): Promise<Store> {
  const { store } = await browserHarness(used, (onItemsTab ? fakeWorkbookDocument : fakeWorkbookDocumentBeforeItems)(SAVED, 'browser'))
  return store
}

function booked(store: Store) {
  return hrDooWorkbook(presentedWorkbook(store.state.workbook!))
}

function advanceBook(store: Store) {
  const workbook = booked(store)
  return ownerAdvances(workbook.ownerAdvances, workbook.transactions, workbook.categories, workbook.repaidBy)
}

function itemsOf(store: Store, description: string) {
  const row = store.state.workbook!.transactions.find((candidate) => candidate.description === description)!
  return recordsOf(store.state.records!.items).filter((item) => item.row === row.rowId)
}

/** A cost the owner paid on the day, as the advance dialog saves it, paid back by the payments chosen. */
async function addAdvance(store: Store, amount: number, description: string, paidBack: readonly string[]): Promise<void> {
  const date = civil('2026-10-05')
  const choices = repaymentChoices(booked(store), null, date).filter((choice) => paidBack.includes(choice.payment.description))
  const advance = ownerAdvanceOfDraft({ date, amount: euros(amount), description, category: 'travel' }, store.state.workbook!.categories)
  await store.write('Added', (unit) => writeOwnerAdvance(unit, store.state.records!, null, advance, choices))
}

describe('owner advances paid back by items', () => {
  it('reads each advance as paid back by the items it names, and a payment no advance names as unaccounted', async () => {
    const store = await storeOf(true)

    const book = advanceBook(store)

    expect(book.advances.map((line) => [line.advance.description, line.status, line.repayments.map((share) => share.applied)])).toEqual([
      ['Train tickets to the client, paid privately', 'repaid', [euros(212.5)]],
      ['Design tool, annual plan on the owner’s card', 'repaid', [euros(89)]],
      ['Printer paper', 'repaid', [euros(34.2)]],
    ])
    expect(book.unaccounted.map((line) => [line.payment.description, line.amount])).toEqual([[PARKING, euros(38.5)]])
  })

  it('offers the payments no advance accounts for, paid on or after the cost, and the ones the advance names already', async () => {
    const store = await storeOf(true)
    const workbook = booked(store)
    const [paper] = workbook.ownerAdvances.filter((advance) => advance.description === 'Printer paper')

    expect(repaymentChoices(workbook, null, civil('2026-10-06')).map((choice) => [choice.payment.description, choice.amount, choice.named])).toEqual([[PARKING, euros(38.5), false]])
    expect(repaymentChoices(workbook, null, civil('2026-10-07'))).toEqual([])
    expect(repaymentChoices(workbook, paper!, paper!.date).map((choice) => [choice.amount, choice.named])).toEqual([
      [euros(34.2), true],
      [euros(38.5), false],
    ])
  })

  it('places a cost typed after its payment arrived, giving the part it pays back an item of its own, and Undo puts the payment back', async () => {
    const store = await storeOf(true)
    const parkingItem = itemsOf(store, PARKING)[0]!

    await addAdvance(store, 20, 'Parking at the client', [PARKING])

    expect(itemsOf(store, PARKING).map((item) => [item.id === parkingItem.id, item.amount, item.note])).toEqual([
      [true, euros(-18.5), ''],
      [false, euros(-20), 'Parking at the client'],
    ])
    const book = advanceBook(store)
    expect(book.advances.find((line) => line.advance.description === 'Parking at the client')?.status).toBe('repaid')
    expect(book.unaccounted.map((line) => line.amount)).toEqual([euros(18.5)])
    expect(store.state.workbook!.problems).toEqual([])

    await store.undo(store.state.writes[0]!)

    expect(itemsOf(store, PARKING)).toEqual([parkingItem])
  })

  it('keeps the invoice a payment pays on both items when a cost placed on it gives part of it an item of its own', async () => {
    const store = await storeOf(true)
    const parkingItem = itemsOf(store, PARKING)[0]!
    const invoice = store.state.workbook!.invoices[0]!.id
    await store.write('Placed', (unit) => unit.of(ITEM_WRITES).change(parkingItem, { ...parkingItem, invoice }))

    await addAdvance(store, 20, 'Parking at the client', [PARKING])

    expect(itemsOf(store, PARKING).map((item) => [item.amount, item.invoice])).toEqual([
      [euros(-18.5), invoice],
      [euros(-20), invoice],
    ])
  })

  it('names the whole item of a payment that pays back all of it, with the cost as its note', async () => {
    const store = await storeOf(true)
    const [item] = itemsOf(store, PARKING)

    await addAdvance(store, 38.5, 'Parking', [PARKING])

    expect(itemsOf(store, PARKING)).toEqual([{ ...item, note: 'Parking' }])
    const advance = recordsOf(recordsOfKindIn(store.state.records!, OWNER_ADVANCE_RECORDS)).find((held) => held.description === 'Parking')
    expect(advance?.repaidBy).toEqual([item!.id])
    expect(advanceBook(store).unaccounted).toEqual([])
  })

  it('pays back only what is still open of a cost, so a payment it no longer needs pays back nothing', () => {
    const choice = (amount: number, named: boolean) => ({ item: recordIdOf(ITEM_RECORDS, String(amount)), amount: euros(amount), named }) as never
    expect(repaymentsPlaced(euros(50), [choice(30, true), choice(40, false), choice(10, false)])).toEqual([euros(30), euros(20), euros(0)])
  })

  it('says what the payments add up to when an advance is lowered below the payments it names', () => {
    const choice = (amount: number, named: boolean) => ({ item: recordIdOf(ITEM_RECORDS, String(amount)), amount: euros(amount), named }) as never
    const chosen = [choice(30, true), choice(40, true), choice(10, false)]

    expect(repaidMoreThanPaid(euros(50), repaymentsPlaced(euros(50), chosen))).toBe(euros(70))
    expect(repaidMoreThanPaid(euros(70), repaymentsPlaced(euros(70), chosen))).toBeNull()
  })

  it('refuses an advance that names an item no payment to the owner holds, or a hand change to an item an advance names', async () => {
    const store = await storeOf(true)
    const [desk] = recordsOf(store.state.records!.items).filter((item) => item.category !== 'reimbursement-to-owner')
    const advance = ownerAdvanceOfDraft({ date: civil('2026-10-05'), amount: euros(10), description: 'Pens', category: 'travel' }, store.state.workbook!.categories)

    await expect(store.write('Added', (unit) => unit.of(OWNER_ADVANCE_WRITES).add({ ...advance, repaidBy: [desk!.id] }))).rejects.toThrow('no payment to the owner')
    const [train] = itemsOf(store, 'Refund of travel paid privately')
    await expect(store.write('Changed', (unit) => unit.of(ITEM_WRITES).change(train!, { ...train!, note: 'Train', amount: euros(-200) }))).rejects.toThrow(WorkbookWriteRefused)
  })

  it('keeps books from before items as they were: no payment is offered, and the advance is matched on every read', async () => {
    const store = await storeOf(false)

    expect(repaymentChoices(booked(store), null, civil('2026-10-05'))).toEqual([])
    await addAdvance(store, 20, 'Parking at the client', [])

    const advance = recordsOf(recordsOfKindIn(store.state.records!, OWNER_ADVANCE_RECORDS)).find((held) => held.description === 'Parking at the client')
    expect(advance?.repaidBy).toBeUndefined()
    expect(advanceBook(store).unaccounted.map((line) => line.amount)).toEqual([euros(18.5)])
  })
})

describe('an import that pays back the costs the owner paid', () => {
  /** A new payment to the owner on the main account, after its newest row. */
  function paymentToOwner(store: Store, amount: number): LedgerEntry {
    const newest = [...store.state.workbook!.transactions].filter((row) => row.account === 'main').sort((earlier, later) => later.sequence - earlier.sequence)[0]!
    const fields = {
      account: 'main',
      date: civil('2026-10-20'),
      statement: 's-new',
      counterparty: newest.counterparty,
      counterpartyIban: '',
      description: 'Refund',
      amount: euros(-amount),
      balance: addMoney(newest.balance, euros(-amount)),
      category: 'reimbursement-to-owner',
      flaggedBy: 'rule',
      reference: 'REF-NEW',
      signals: newest.signals,
      reviewReasons: [],
      ownerShare: null,
      rowId: 'refund-row',
    }
    return { ...fields, id: ledgerIdOf(fields) }
  }

  it('proposes the open advances a new payment pays back, and writes its items and the links with the import', async () => {
    const store = await storeOf(true)
    await addAdvance(store, 50, 'Taxi', [])
    const entry = paymentToOwner(store, 60)

    const repayments = proposedRepayments(booked(store), [entry])

    expect(repayments).toHaveLength(1)
    expect(repayments[0]!.items.map((item) => [item.amount, item.note, item.of === null])).toEqual([
      [euros(-10), '', true],
      [euros(-50), 'Taxi', false],
    ])
    expect(repayments[0]!.items[0]!.id).toBe(recordIdOf(ITEM_RECORDS, 'refund-row'))
    const run = { accounts: [], removed: [], added: [entry], repayments, newRows: 1, statements: [] } as unknown as ImportDryRun

    await store.write('Imported', (unit) => writeImport(unit, run, store.state.records!))

    expect(itemsOf(store, 'Refund').map((item) => [item.amount, item.note])).toEqual([
      [euros(-10), ''],
      [euros(-50), 'Taxi'],
    ])
    const book = advanceBook(store)
    expect(book.advances.find((line) => line.advance.description === 'Taxi')?.status).toBe('repaid')
    expect(book.unaccounted.map((line) => line.amount)).toEqual([euros(38.5), euros(10)])
  })

  it('proposes nothing in books from before items, which match the payment on every read', async () => {
    const store = await storeOf(false)
    await addAdvance(store, 50, 'Taxi', [])

    expect(proposedRepayments(booked(store), [paymentToOwner(store, 60)])).toEqual([])
  })
})
