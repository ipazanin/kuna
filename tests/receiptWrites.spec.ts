import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { accountBalance } from '../src/apps/spending/accounts/domain/accountBalance'
import { spendingFigures } from '../src/apps/spending/analytics/presentation/spendingFigures'
import { deleteInto } from '../src/apps/spending/categories/application/categoryWrites'
import { TRANSACTION_WRITES, removeEntry } from '../src/apps/spending/entries/application/entryWrites'
import { LINE_WRITES, RECEIPT_WRITES, removeReceiptOf } from '../src/apps/spending/receipts/application/receiptRecords'
import { writeReceiptSplit } from '../src/apps/spending/receipts/application/receiptWrites'
import { receiptSplit } from '../src/apps/spending/receipts/domain/receiptSplit'
import type { ReceiptDraft } from '../src/apps/spending/receipts/domain/receiptSplit'
import { joinWithTyped, writeDryRun } from '../src/apps/spending/statements/application/statementWrites'
import { reviewCount, reviewQueue } from '../src/apps/spending/statements/domain/reviewQueue'
import { statementDryRun } from '../src/apps/spending/statements/domain/statementDryRun'
import { codecOfSpendingKind } from '../src/apps/spending/workbook/application/spendingCodecs'
import type { SpendingBooks } from '../src/apps/spending/workbook/domain/spendingBooks'
import { ACCOUNT_RECORDS, CATEGORY_RECORDS } from '../src/apps/spending/workbook/domain/spendingKinds'
import type { Transaction } from '../src/apps/spending/workbook/domain/transaction'
import { spendingDocumentOf } from '../src/apps/spending/workbook/infrastructure/spendingDocument'
import { NO_RATES } from '../src/shared/money/rateBook'
import type { WorkbookStore } from '../src/shared/storage/application/createWorkbookStore'
import type { RecordKind } from '../src/shared/storage/domain/recordKind'
import { recordsOf } from '../src/shared/storage/domain/recordsRead'
import { civil, euros, month } from './fixtures/ledger'
import { ACCOUNTS, CASH, CATEGORIES, OTP, category, row } from './fixtures/spending'
import { SPENDING, browserHarness, forgetCaches } from './fixtures/writeBack'

const used = new Set<string>()

afterEach(async () => {
  await forgetCaches(used)
})

function stored<R>(kind: RecordKind<R>, records: readonly R[]) {
  const codec = codecOfSpendingKind(kind)
  return { [kind.name]: records.map((record) => codec.fieldsOf(record)) }
}

async function spendingStore(): Promise<WorkbookStore<SpendingBooks>> {
  const document = spendingDocumentOf('2026-11-04T09:00:00.000Z', { ...stored(ACCOUNT_RECORDS, ACCOUNTS), ...stored(CATEGORY_RECORDS, CATEGORIES) })
  const { store } = await browserHarness(used, document, SPENDING)
  return store
}

const DRAFT: ReceiptDraft = { merchant: ' Corner market ', issuedOn: civil('2026-11-03'), issuedTime: '18:42', total: euros(23.49), jir: '1a2b3c4d-0000-4000-8000-1234567890ab', zki: '', photo: '' }
const GROCERIES = category('Food/Groceries')

async function withRow(store: WorkbookStore<SpendingBooks>, added: Transaction): Promise<Transaction> {
  await store.write('Added', (unit) => unit.of(TRANSACTION_WRITES).add(added))
  return store.state.workbook!.transactions.find((held) => held.id === added.id)!
}

function bookSums(store: WorkbookStore<SpendingBooks>) {
  const book = store.state.workbook!
  return book.accounts.map((account) => accountBalance(account, book.transactions, civil('2026-11-30')))
}

describe('a confirmed receipt', () => {
  it('writes the receipt, its line and the matched row in one write, and one Undo takes it all back', async () => {
    const store = await spendingStore()
    const card = await withRow(store, row(OTP, '2026-11-04', -23.49, null, { source: 'statement', importKey: 'key-1', categorisedBy: null }))
    const before = store.state.workbook!.transactions

    const written = await store.write('Saved', (unit) => writeReceiptSplit(unit, receiptSplit(DRAFT, { row: card }, GROCERIES.id)))

    const book = store.state.workbook!
    expect(book.problems).toEqual([])
    expect(book.transactions).toMatchObject([{ id: card.id, category: GROCERIES.id, categorisedBy: 'person', payee: 'Corner market', source: 'statement', importKey: 'key-1' }])
    expect(book.receipts).toMatchObject([{ transaction: card.id, merchant: 'Corner market', issuedOn: civil('2026-11-03'), issuedTime: '18:42', total: euros(23.49), readBy: '', photo: '' }])
    expect(book.lines).toMatchObject([{ transaction: card.id, amount: euros(-23.49), category: GROCERIES.id, text: '' }])
    expect(reviewCount(book)).toBe(0)

    await store.undo(store.state.writes.find((write) => write.receipt === written)!)

    expect(store.state.workbook!.transactions).toEqual(before)
    expect(store.state.workbook!.receipts).toEqual([])
    expect(store.state.workbook!.lines).toEqual([])
  })

  it("takes the merchant from the row when you typed none, and keeps the row's own payee when you did", async () => {
    const card = row(OTP, '2026-11-04', -23.49, null, { payee: 'POS 0412' })

    expect(receiptSplit({ ...DRAFT, merchant: '' }, { row: card }, GROCERIES.id).receipt.merchant).toBe('POS 0412')
    expect(receiptSplit(DRAFT, { row: card }, GROCERIES.id).row.payee).toBe('POS 0412')
  })

  it('adds one Difference line for a near match, so the lines add up to the row and its spending is what left the account', async () => {
    const store = await spendingStore()
    const card = await withRow(store, row(OTP, '2026-11-04', -25, null))
    await store.write('Saved', (unit) => writeReceiptSplit(unit, receiptSplit(DRAFT, { row: card }, GROCERIES.id)))

    const book = store.state.workbook!
    expect(book.problems).toEqual([])
    expect(book.lines).toMatchObject([
      { amount: euros(-23.49), category: GROCERIES.id },
      { amount: euros(-1.51), category: GROCERIES.id, text: 'Difference' },
    ])
    expect(spendingFigures(book, NO_RATES).totalsOf(month('2026-11')).byCategory.get(GROCERIES.id)).toEqual(euros(25))
  })

  it('makes a row of source receipt when none matched, on the account picked, which a later import fills and keeps split', async () => {
    const store = await spendingStore()
    await store.write('Saved', (unit) => writeReceiptSplit(unit, receiptSplit(DRAFT, { account: OTP.id }, GROCERIES.id)))
    const [made] = store.state.workbook!.transactions
    expect(made).toMatchObject({ account: OTP.id, date: civil('2026-11-03'), amount: euros(-23.49), payee: 'Corner market', source: 'receipt', categorisedBy: 'person', category: GROCERIES.id })

    const statement = {
      label: 'export.csv',
      rows: [
        {
          account: OTP.id,
          date: civil('2026-11-05'),
          amount: euros(-23.49),
          payee: 'POS 0412',
          category: null,
          description: 'POS 0412',
          counterpartyIban: '',
          importKey: 'key-1',
          movedAt: '',
          pocket: false,
        },
      ],
      notes: [],
    }
    const run = statementDryRun(store.state.workbook!, statement, civil('2026-11-06'))
    expect([run.newRows, run.filled]).toEqual([0, 1])
    await store.write('Imported', (unit) => writeDryRun(unit, run))

    const book = store.state.workbook!
    expect(book.problems).toEqual([])
    expect(book.transactions).toMatchObject([{ id: made!.id, date: civil('2026-11-05'), payee: 'Corner market', source: 'receipt', importKey: 'key-1' }])
    expect(book.lines).toHaveLength(1)
  })

  it('stays out of the balance: the row moves it once, whichever lines it has', async () => {
    const store = await spendingStore()
    const balances = bookSums(store)
    await store.write('Saved', (unit) => writeReceiptSplit(unit, receiptSplit(DRAFT, { account: CASH.id }, GROCERIES.id)))

    const after = bookSums(store)
    expect(after[3]! - balances[3]!).toBe(euros(-23.49))
  })
})

describe('a row a receipt split', () => {
  async function splitStore() {
    const store = await spendingStore()
    const card = await withRow(store, row(OTP, '2026-11-04', -23.49, null))
    await store.write('Saved', (unit) => writeReceiptSplit(unit, receiptSplit(DRAFT, { row: card }, GROCERIES.id)))
    return { store, split: store.state.workbook!.transactions[0]! }
  }

  it('refuses a new amount, since its lines would not add up', async () => {
    const { store, split } = await splitStore()

    await expect(store.write('Changed', (unit) => unit.of(TRANSACTION_WRITES).change(split, { ...split, amount: euros(-30) }))).rejects.toThrow(/add up/)
  })

  it('refuses a line that breaks the sum', async () => {
    const { store } = await splitStore()
    const [line] = store.state.workbook!.lines

    await expect(store.write('Changed', (unit) => unit.of(LINE_WRITES).change(line!, { ...line!, amount: euros(-20) }))).rejects.toThrow(/add up/)
  })

  it('refuses to delete the row and leave its receipt and lines behind', async () => {
    const { store, split } = await splitStore()

    await expect(store.write('Deleted', (unit) => unit.of(TRANSACTION_WRITES).remove(split))).rejects.toThrow()
  })

  it('refuses to delete a receipt and leave its lines behind', async () => {
    const { store } = await splitStore()

    await expect(store.write('Deleted', (unit) => unit.of(RECEIPT_WRITES).remove(store.state.workbook!.receipts[0]!))).rejects.toThrow()
  })

  it('takes its receipt and lines with it when deleted, and one Undo puts them all back', async () => {
    const { store, split } = await splitStore()
    const records = store.state.records!

    const written = await store.write('Deleted', (unit) => removeEntry(unit, records, split))

    expect([store.state.workbook!.transactions, store.state.workbook!.receipts, store.state.workbook!.lines]).toEqual([[], [], []])
    await store.undo(store.state.writes.find((write) => write.receipt === written)!)
    expect(store.state.workbook!.problems).toEqual([])
    expect([store.state.workbook!.transactions.length, store.state.workbook!.receipts.length, store.state.workbook!.lines.length]).toEqual([1, 1, 1])
  })

  it('stays under its category when its receipt is removed', async () => {
    const { store, split } = await splitStore()
    const records = store.state.records!

    await store.write('Removed', (unit) => removeReceiptOf(unit, records, split))

    expect(store.state.workbook!.transactions).toMatchObject([{ id: split.id, amount: euros(-23.49), category: GROCERIES.id }])
    expect([store.state.workbook!.receipts, store.state.workbook!.lines]).toEqual([[], []])
    expect(spendingFigures(store.state.workbook!, NO_RATES).totalsOf(month('2026-11')).byCategory.get(GROCERIES.id)).toEqual(euros(23.49))
  })

  it('moves its lines with a category deleted into another, in one write', async () => {
    const { store } = await splitStore()
    const target = store.state.workbook!.categories.find((candidate) => candidate.id === category('Food/Coffee').id)!
    const records = store.state.records!
    const groceries = recordsOf(records.categories).find((candidate) => candidate.id === GROCERIES.id)!

    await store.write('Deleted', (unit) => deleteInto(unit, records, groceries, target))

    expect(store.state.workbook!.problems).toEqual([])
    expect(store.state.workbook!.lines).toMatchObject([{ category: target.id }])
    expect(store.state.workbook!.transactions).toMatchObject([{ category: target.id }])
  })

  it('takes a Difference line when a near bank row joins it, so its lines keep adding up', async () => {
    const store = await spendingStore()
    await store.write('Saved', (unit) => writeReceiptSplit(unit, receiptSplit(DRAFT, { account: OTP.id }, GROCERIES.id)))
    const statement = {
      label: 'export.csv',
      rows: [
        {
          account: OTP.id,
          date: civil('2026-11-05'),
          amount: euros(-25),
          payee: 'POS 0412',
          category: null,
          description: 'POS 0412',
          counterpartyIban: '',
          importKey: 'key-1',
          movedAt: '',
          pocket: false,
        },
      ],
      notes: [],
    }
    await store.write('Imported', (unit) => writeDryRun(unit, statementDryRun(store.state.workbook!, statement, civil('2026-11-06'))))
    const near = reviewQueue(store.state.workbook!, civil('2026-11-06')).waiting[0]!.maybeTyped!
    const { lines } = store.state.workbook!

    await store.write('Joined', (unit) => joinWithTyped(unit, near.typed, near.bank, lines))

    const book = store.state.workbook!
    expect(book.problems).toEqual([])
    expect(book.transactions).toMatchObject([{ amount: euros(-25), source: 'receipt', importKey: 'key-1' }])
    expect(book.lines).toMatchObject([{ amount: euros(-23.49) }, { amount: euros(-1.51), text: 'Difference', category: GROCERIES.id }])
  })
})

describe('reading receipts and lines', () => {
  it('refuses lines that do not add up and counts the row under its own category instead', async () => {
    const store = await spendingStore()
    const card = await withRow(store, row(OTP, '2026-11-04', -23.49, 'Food/Coffee'))
    const split = receiptSplit(DRAFT, { row: card }, GROCERIES.id)
    const broken = { ...split.lines[0]!, amount: euros(-20) }

    await expect(store.write('Saved', (unit) => writeReceiptSplit(unit, { ...split, lines: [broken] }))).rejects.toThrow(/add up/)
    expect(store.state.workbook!.lines).toEqual([])
    expect(store.state.workbook!.transactions).toMatchObject([{ category: category('Food/Coffee').id }])
  })

  it('refuses a second receipt on a row', async () => {
    const store = await spendingStore()
    const card = await withRow(store, row(OTP, '2026-11-04', -23.49, null))
    await store.write('Saved', (unit) => writeReceiptSplit(unit, receiptSplit(DRAFT, { row: card }, GROCERIES.id)))
    const held = store.state.workbook!.transactions[0]!

    await expect(store.write('Saved', (unit) => writeReceiptSplit(unit, receiptSplit(DRAFT, { row: held }, GROCERIES.id)))).rejects.toThrow()
  })
})
