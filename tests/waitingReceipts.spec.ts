import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { accountBalance } from '../src/apps/spending/accounts/domain/accountBalance'
import { spendingFigures } from '../src/apps/spending/analytics/domain/spendingFigures'
import { rowItemsOf, waitsOnReview } from '../src/apps/spending/workbook/domain/rowItems'
import { placeWaitingReceipt, removeWaitingReceipt, writeReceiptSplit } from '../src/apps/spending/receipts/application/receiptWrites'
import { receiptSplit, rowPlace } from '../src/apps/spending/receipts/domain/receiptSplit'
import type { ReceiptDraft } from '../src/apps/spending/receipts/domain/receiptSplit'
import { asksForPayment, receiptOnRow, receiptsArriving, waitingReceipts } from '../src/apps/spending/receipts/domain/waitingReceipts'
import { writeDryRun } from '../src/apps/spending/statements/application/statementWrites'
import { newLabel } from '../src/apps/spending/labels/domain/labels'
import { addLabel, labelRows } from '../src/apps/spending/labels/application/labelWrites'
import { reviewCount } from '../src/apps/spending/statements/domain/reviewQueue'
import { statementDryRun } from '../src/apps/spending/statements/domain/statementDryRun'
import type { StatementRow } from '../src/apps/spending/statements/domain/statementRows'
import { codecOfSpendingKind } from '../src/apps/spending/workbook/application/spendingCodecs'
import { receiptOf } from '../src/apps/spending/workbook/domain/receiptReading'
import { ACCOUNT_RECORDS, CATEGORY_RECORDS, ITEM_RECORDS, RECEIPT_RECORDS, TRANSACTION_RECORDS } from '../src/apps/spending/workbook/domain/spendingKinds'
import type { SpendingBook } from '../src/apps/spending/workbook/domain/readSpendingBook'
import type { SpendingBooks } from '../src/apps/spending/workbook/domain/spendingBooks'
import { spendingDocumentOf } from '../src/apps/spending/workbook/infrastructure/spendingDocument'
import { BY_DAYS, OUT_OF_EVENTS } from '../src/apps/spending/workbook/domain/event'
import type { TransactionItem } from '../src/apps/spending/workbook/domain/transactionItem'
import { accountMoneyFromAmount } from '../src/shared/money/accountMoney'
import { moneyFromAmount } from '../src/shared/money/money'
import { NO_RATES } from '../src/shared/money/rateBook'
import type { WorkbookStore } from '../src/shared/storage/application/createWorkbookStore'
import type { RecordKind } from '../src/shared/storage/domain/recordKind'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import type { RecordId } from '../src/shared/storage/domain/recordId'
import { storedFieldOf } from '../src/shared/storage/domain/storedFields'
import { civil, month } from './fixtures/ledger'
import { ACCOUNTS, CATEGORIES, OTP, category, row, addEntries, filedRows, itemized, spendingBook, wholeItems, wholeReceiptLines } from './fixtures/spending'
import { SPENDING, browserHarness, forgetCaches } from './fixtures/writeBack'

const used = new Set<string>()

afterEach(async () => {
  await forgetCaches(used)
})

function stored<R>(kind: RecordKind<R>, records: readonly R[]) {
  const codec = codecOfSpendingKind(kind)
  return { [kind.name]: records.map((record) => codec.fieldsOf(record)) }
}

/** The fixture's accounts as they are, so OTP current is one the bank fills. */
async function spendingStore(): Promise<WorkbookStore<SpendingBooks>> {
  const document = spendingDocumentOf('2026-11-04T09:00:00.000Z', { ...stored(ACCOUNT_RECORDS, ACCOUNTS), ...stored(CATEGORY_RECORDS, CATEGORIES) })
  const { store } = await browserHarness(used, document, SPENDING)
  return store
}

const DRAFT: ReceiptDraft = {
  merchant: 'Corner market',
  merchantOib: '',
  buyerOib: '',
  issuedOn: civil('2026-11-03'),
  issuedTime: '18:42',
  total: moneyFromAmount(23.49),
  jir: '',
  zki: '',
  readBy: '',
  photo: '',
  latitude: '',
  longitude: '',
}
const GROCERIES = category('Food/Groceries')
const HOUSEHOLD = category('Home/Furniture and household goods')
/** Two lines that add up to two cents less than the total, as a misread receipt can, so the receipt keeps a Difference line. */
const LINES = [
  { printed: 'KRUH', note: 'kruh', amount: accountMoneyFromAmount(-13.49), category: GROCERIES.id },
  { printed: 'DET.', note: 'deterdžent', amount: accountMoneyFromAmount(-9.98), category: HOUSEHOLD.id },
]
const DAY = civil('2026-11-06')

function bankRow(importKey: string, date: string, amount: number, payee: string): StatementRow {
  return {
    account: OTP.id,
    date: civil(date),
    amount: accountMoneyFromAmount(amount),
    payee,
    category: null,
    description: payee,
    counterpartyIban: '',
    importKey,
    movedAt: '',
    pocket: false,
    cashWithdrawal: false,
    pending: false,
  }
}

const synced = (...rows: StatementRow[]) => ({ label: 'Enable Banking', rows, notes: [] })
const fromFile = (...rows: StatementRow[]) => ({ label: 'export.csv', rows, notes: [] })

async function waiting(store: WorkbookStore<SpendingBooks>, draft: ReceiptDraft = DRAFT): Promise<void> {
  await store.write('Saved', (unit) => writeReceiptSplit(unit, store.state.records!, receiptSplit(draft, { account: OTP }, LINES)))
}

/** How many rows of the book wait on To review for a category. */
function waitingCount(book: Pick<SpendingBook, 'transactions' | 'items'>): number {
  const itemsOf = rowItemsOf(book)
  return book.transactions.filter((row) => waitsOnReview(itemsOf(row))).length
}

function figures(store: WorkbookStore<SpendingBooks>) {
  const book = store.state.workbook!
  const totals = spendingFigures(book, NO_RATES).totalsOf(month('2026-11'))
  return { balance: accountBalance(OTP, book.transactions, civil('2026-11-30')), spent: [totals.byCategory.get(GROCERIES.id), totals.byCategory.get(HOUSEHOLD.id)] }
}

describe('a receipt for a card payment the bank has not brought yet', () => {
  it('makes no row on an account the bank fills, and waits there with its lines, counting nowhere', async () => {
    const store = await spendingStore()
    const before = figures(store)
    await waiting(store)

    const book = store.state.workbook!
    expect(book.problems).toEqual([])
    expect(book.transactions).toEqual([])
    expect(book.receipts).toMatchObject([{ transaction: null, account: OTP.id, total: moneyFromAmount(23.49), merchant: 'Corner market' }])
    expect(book.items).toMatchObject([
      { transaction: null, amount: accountMoneyFromAmount(-13.49) },
      { transaction: null, amount: accountMoneyFromAmount(-9.98) },
      { transaction: null, amount: accountMoneyFromAmount(-0.02), note: 'Difference', category: GROCERIES.id },
    ])
    expect(figures(store)).toEqual(before)
    expect(waitingReceipts(book)).toMatchObject([{ account: { id: OTP.id }, amount: accountMoneyFromAmount(-23.49), matches: { kind: 'none' } }])
  })

  it('goes on the row the sync brings, which it files, in the import write', async () => {
    const store = await spendingStore()
    await waiting(store)
    const run = statementDryRun(store.state.workbook!, synced(bankRow('bank-1', '2026-11-04', -23.49, 'CORNER MARKET ZAGREB')), DAY)
    expect(run.receipts).toHaveLength(1)
    expect(run.lines).toMatchObject([{ outcome: 'new', category: GROCERIES.id }])
    await store.write('Synced', (unit) => writeDryRun(unit, store.state.records!, run))

    const book = store.state.workbook!
    const [arrived] = book.transactions
    expect(book.problems).toEqual([])
    expect(filedRows(book)[0]).toMatchObject({ importKey: 'bank-1', category: GROCERIES.id, categorisedBy: 'person', payee: 'CORNER MARKET ZAGREB' })
    expect(book.receipts).toMatchObject([{ transaction: arrived!.id, account: null }])
    expect(book.items.map((line) => line.transaction)).toEqual([arrived!.id, arrived!.id, arrived!.id])
    expect(figures(store).spent).toEqual([moneyFromAmount(13.51), moneyFromAmount(9.98)])
    expect(waitingReceipts(book)).toEqual([])
  })

  it('goes on the row a file brings the same way', async () => {
    const store = await spendingStore()
    await waiting(store)
    await store.write('Imported', (unit) =>
      writeDryRun(unit, store.state.records!, statementDryRun(store.state.workbook!, fromFile(bankRow('file-1', '2026-11-05', -23.49, 'Corner market d.o.o.')), DAY)),
    )

    const book = store.state.workbook!
    expect(book.problems).toEqual([])
    expect(book.receipts).toMatchObject([{ transaction: book.transactions[0]!.id, account: null }])
  })

  it('asks when two rows could be it, counting on the To review badge, and goes on the one the person picks', async () => {
    const store = await spendingStore()
    await waiting(store)
    const run = statementDryRun(store.state.workbook!, synced(bankRow('bank-1', '2026-11-03', -23.49, 'CORNER MARKET'), bankRow('bank-2', '2026-11-04', -23.49, 'CORNER MARKET')), DAY)
    expect(run.receipts).toEqual([])
    await store.write('Synced', (unit) => writeDryRun(unit, store.state.records!, run))

    const [asking] = waitingReceipts(store.state.workbook!)
    expect(asking?.matches).toMatchObject({ kind: 'pick', candidates: [{ row: { importKey: 'bank-1' } }, { row: { importKey: 'bank-2' } }] })
    expect(reviewCount(store.state.workbook!)).toBe(waitingCount(store.state.workbook!) + 1)
    const picked = asking!.matches.kind === 'pick' ? asking!.matches.candidates[1]!.row : null
    await store.write('Placed', (unit) => placeWaitingReceipt(unit, store.state.records!, receiptOnRow(asking!.receipt, asking!.lines, rowPlace(picked!, []), 'Difference')))

    const book = store.state.workbook!
    expect(book.problems).toEqual([])
    expect(book.receipts).toMatchObject([{ transaction: picked!.id }])
    expect(filedRows(book).find((held) => held.id === picked!.id)).toMatchObject({ category: GROCERIES.id, categorisedBy: 'person' })
    expect(reviewCount(book)).toBe(waitingCount(book))
  })

  it('takes a Difference line when the person picks a row the bank booked for more, as with a tip', async () => {
    const store = await spendingStore()
    await waiting(store)
    await store.write('Synced', (unit) => writeDryRun(unit, store.state.records!, statementDryRun(store.state.workbook!, synced(bankRow('bank-1', '2026-11-03', -25, 'CORNER MARKET')), DAY)))
    const [asking] = waitingReceipts(store.state.workbook!)
    const [tipped] = asking!.matches.kind === 'pick' ? asking!.matches.candidates : []
    await store.write('Placed', (unit) =>
      placeWaitingReceipt(unit, store.state.records!, receiptOnRow(asking!.receipt, asking!.lines, rowPlace(tipped!.row, store.state.workbook!.items), 'Difference')),
    )

    const book = store.state.workbook!
    expect(book.problems).toEqual([])
    expect(book.items.at(-1)).toMatchObject({ amount: accountMoneyFromAmount(-1.51), note: 'Difference', category: GROCERIES.id })
  })

  it('keeps the ids of its lines on the row the person picks, and gives them and the Difference line the labels of the part the row stood for', async () => {
    const store = await spendingStore()
    await waiting(store)
    await store.write('Synced', (unit) => writeDryRun(unit, store.state.records!, statementDryRun(store.state.workbook!, synced(bankRow('bank-1', '2026-11-03', -25, 'CORNER MARKET')), DAY)))
    const [asking] = waitingReceipts(store.state.workbook!)
    const [tipped] = asking!.matches.kind === 'pick' ? asking!.matches.candidates : []
    let trip: RecordId | null = null
    await store.write('Labelled', (unit) => {
      const label = newLabel('Prague')
      addLabel(unit, label)
      trip = label.id
      labelRows(unit, store.state.records!, [tipped!.row], trip, true)
    })

    await store.write('Placed', (unit) =>
      placeWaitingReceipt(unit, store.state.records!, receiptOnRow(asking!.receipt, asking!.lines, rowPlace(tipped!.row, store.state.workbook!.items), 'Difference')),
    )

    const lines = store.state.workbook!.items.filter((line) => line.transaction === tipped!.row.id)
    expect(lines.slice(0, asking!.lines.length).map((line) => line.id)).toEqual(asking!.lines.map((line) => line.id))
    expect(lines).toHaveLength(asking!.lines.length + 1)
    expect(lines.map((line) => line.labels)).toEqual(lines.map(() => [trip]))
  })

  it('adds to its lines, and gives the Difference line, the labels every part of a row split by hand carries and the event choice of the largest', async () => {
    const store = await spendingStore()
    await waiting(store)
    await store.write('Synced', (unit) => writeDryRun(unit, store.state.records!, statementDryRun(store.state.workbook!, synced(bankRow('bank-1', '2026-11-03', -25, 'CORNER MARKET')), DAY)))
    const [asking] = waitingReceipts(store.state.workbook!)
    const [tipped] = asking!.matches.kind === 'pick' ? asking!.matches.candidates : []
    const [first, ...rest] = asking!.lines
    const [trip, flat, own] = [newLabel('Prague').id, newLabel('New flat').id, newLabel('Gift').id]
    const hand: readonly TransactionItem[] = [
      { ...first!, id: recordIdOf(ITEM_RECORDS, 'hand-1'), receipt: null, transaction: tipped!.row.id, amount: accountMoneyFromAmount(-10), labels: [trip], event: BY_DAYS },
      { ...first!, id: recordIdOf(ITEM_RECORDS, 'hand-2'), receipt: null, transaction: tipped!.row.id, amount: accountMoneyFromAmount(-15), labels: [trip, flat], event: OUT_OF_EVENTS },
    ]

    const placed = receiptOnRow(asking!.receipt, [{ ...first!, labels: [own] }, ...rest], { row: tipped!.row, held: hand }, 'Difference')

    expect(placed.items.map((line) => [line.labels, line.event])).toEqual([[[own, trip], OUT_OF_EVENTS], ...rest.map(() => [[trip], OUT_OF_EVENTS]), [[trip], OUT_OF_EVENTS]])
  })

  it("keeps a label a rule put on every part it replaces a rule's on its lines and the Difference line, but not on a line that has it by hand", async () => {
    const store = await spendingStore()
    await waiting(store)
    await store.write('Synced', (unit) => writeDryRun(unit, store.state.records!, statementDryRun(store.state.workbook!, synced(bankRow('bank-1', '2026-11-03', -25, 'CORNER MARKET')), DAY)))
    const [asking] = waitingReceipts(store.state.workbook!)
    const [tipped] = asking!.matches.kind === 'pick' ? asking!.matches.candidates : []
    const [first, ...rest] = asking!.lines
    const trip = newLabel('Prague').id
    const held: readonly TransactionItem[] = [
      { ...first!, id: recordIdOf(ITEM_RECORDS, 'held'), receipt: null, transaction: tipped!.row.id, amount: tipped!.row.amount, labels: [trip], ruleLabels: [trip] },
    ]

    const placed = receiptOnRow(asking!.receipt, [{ ...first!, labels: [trip] }, ...rest], { row: tipped!.row, held }, 'Difference')

    expect(placed.items.map((line) => line.ruleLabels)).toEqual([[], ...rest.map(() => [trip]), [trip]])
  })

  it('keeps waiting while no row it may be arrives', async () => {
    const store = await spendingStore()
    await waiting(store)
    const before = figures(store)
    const run = statementDryRun(store.state.workbook!, synced(bankRow('bank-1', '2026-11-04', -7.2, 'PHARMACY')), DAY)
    expect(run.receipts).toEqual([])
    await store.write('Synced', (unit) => writeDryRun(unit, store.state.records!, run))

    const book = store.state.workbook!
    expect(book.receipts).toMatchObject([{ transaction: null, account: OTP.id }])
    expect(figures(store).spent).toEqual(before.spent)
  })

  it('goes, with its lines, when the person removes it, and Undo brings it back', async () => {
    const store = await spendingStore()
    await waiting(store)
    const book = store.state.workbook!
    const written = await store.write('Removed', (unit) => removeWaitingReceipt(unit, store.state.records!, book.receipts[0]!))
    expect([store.state.workbook!.receipts, store.state.workbook!.items]).toEqual([[], []])

    await store.undo(store.state.writes.find((write) => write.receipt === written)!)
    expect(store.state.workbook!.receipts).toHaveLength(1)
    expect(store.state.workbook!.items).toHaveLength(3)
  })

  it('takes each arriving row once, oldest receipt first', () => {
    const book = { accounts: ACCOUNTS, categories: CATEGORIES, transactions: [], lines: [] }
    const one = receiptSplit(DRAFT, { account: OTP }, wholeReceiptLines(DRAFT.total, GROCERIES.id))
    const two = receiptSplit({ ...DRAFT, issuedOn: civil('2026-11-04') }, { account: OTP }, wholeReceiptLines(DRAFT.total, GROCERIES.id))
    const arriving = [itemized(row(OTP, '2026-11-04', -23.49, null, { source: 'statement', importKey: 'bank-1', payee: 'CORNER MARKET' }))]
    const placed = receiptsArriving({ ...book, receipts: [two.receipt, one.receipt], items: [...one.lines, ...two.lines] }, arriving, 'Difference')
    expect(placed.map((receipt) => receipt.receipt.before.id)).toEqual([one.receipt.id])
  })

  describe("from a merchant whose earlier receipt went on a bank's row", () => {
    const PERO = { ...DRAFT, merchant: 'Obrt Pero', total: moneyFromAmount(2.4) }
    const earlier = row(OTP, '2026-10-02', -2.4, 'Food/Eating out', { source: 'statement', importKey: 'bank-0', payee: 'CAFFE BAR MOJITO' })
    const onFile = receiptSplit({ ...PERO, issuedOn: civil('2026-10-02') }, rowPlace(earlier, []), wholeReceiptLines(PERO.total, GROCERIES.id))
    const pero = receiptSplit(PERO, { account: OTP }, wholeReceiptLines(PERO.total, GROCERIES.id))
    const mojito = row(OTP, '2026-11-04', -2.4, null, { source: 'statement', importKey: 'bank-1', payee: 'CAFFE BAR MOJITO' })
    const kiosk = row(OTP, '2026-11-03', -2.4, null, { source: 'statement', importKey: 'bank-2', payee: 'KIOSK TISAK' })
    const parts = { receipts: [onFile.receipt, pero.receipt], items: [...onFile.lines, ...pero.lines] }

    it('goes on the arriving row the bank names the way it named the earlier one, out of two equal payments', () => {
      const placed = receiptsArriving({ accounts: ACCOUNTS, categories: CATEGORIES, transactions: [earlier], ...parts }, [itemized(kiosk), itemized(mojito)], 'Difference')

      expect(placed.map((receipt) => [receipt.receipt.before.id, receipt.row.id])).toEqual([[pero.receipt.id, mojito.id]])
    })

    it('keeps waiting when two arriving rows are both named that way', () => {
      const second = { ...mojito, id: kiosk.id, importKey: 'bank-2', date: civil('2026-11-03') }

      expect(receiptsArriving({ accounts: ACCOUNTS, categories: CATEGORIES, transactions: [earlier], ...parts }, [itemized(second), itemized(mojito)], 'Difference')).toEqual([])
    })

    it('still asks on To review once the row is clear, with that one row ready', () => {
      const book = spendingBook([earlier, kiosk, mojito], { ...parts, items: [...wholeItems([kiosk, mojito]), ...parts.items] })
      const [asking] = waitingReceipts(book)

      expect(asking?.matches).toMatchObject({ kind: 'ready', candidates: [{ row: { id: mojito.id } }, { row: { id: kiosk.id } }] })
      expect(asksForPayment(asking!)).toBe(true)
      expect(reviewCount(book)).toBe(waitingCount(book) + 1)
    })
  })
})

describe('the write rule on an account the bank fills', () => {
  it('refuses a row a receipt made there, as it refuses a typed one', async () => {
    const store = await spendingStore()
    await expect(store.write('Added', (unit) => addEntries(unit, store.state.records!, [row(OTP, '2026-11-04', -5, 'Food/Groceries', { source: 'receipt' })]))).rejects.toThrow()
  })

  it('lets the bank fill a row a receipt made there before, as it fills a typed one', async () => {
    const standIn = row(OTP, '2026-11-03', -23.49, 'Food/Groceries', { source: 'receipt', categorisedBy: 'person' })
    const document = spendingDocumentOf('2026-11-04T09:00:00.000Z', { ...stored(ACCOUNT_RECORDS, ACCOUNTS), ...stored(CATEGORY_RECORDS, CATEGORIES), ...stored(TRANSACTION_RECORDS, [standIn]) })
    const { store } = await browserHarness(used, document, SPENDING)
    const run = statementDryRun(store.state.workbook!, synced(bankRow('bank-1', '2026-11-04', -23.49, 'CORNER MARKET')), DAY)
    expect(run.filled).toBe(1)
    await store.write('Synced', (unit) => writeDryRun(unit, store.state.records!, run))
    expect(store.state.workbook!.transactions).toMatchObject([{ id: standIn.id, importKey: 'bank-1', source: 'receipt' }])
  })
})

describe('a stored receipt', () => {
  const fields = (extra: Record<string, string>) => Object.fromEntries(Object.entries({ total: 5, issued_at: '2026-11-03', ...extra }).map(([name, value]) => [name, storedFieldOf(value)]))
  const key = '5e000000-0000-4000-8000-000000000001'
  const id = recordIdOf(RECEIPT_RECORDS, '5e000000-0000-4000-8000-000000000002')

  it('names its entry or the account it waits on, never both and never neither', () => {
    expect(() => receiptOf(fields({}), id)).toThrow(/neither/)
    expect(() => receiptOf(fields({ transaction: key, account: key }), id)).toThrow()
    expect(receiptOf(fields({ account: key }), id)).toMatchObject({ transaction: null, account: recordIdOf(ACCOUNT_RECORDS, key) })
    expect(receiptOf(fields({ transaction: key }), id)).toMatchObject({ transaction: recordIdOf(TRANSACTION_RECORDS, key), account: null })
  })

  it('keeps its lines out while they miss minus its total, and says what they add up to', async () => {
    const split = receiptSplit(DRAFT, { account: OTP }, LINES)
    const document = spendingDocumentOf('2026-11-04T09:00:00.000Z', {
      ...stored(ACCOUNT_RECORDS, ACCOUNTS),
      ...stored(CATEGORY_RECORDS, CATEGORIES),
      ...stored(RECEIPT_RECORDS, [split.receipt]),
      ...stored(ITEM_RECORDS, split.lines.slice(0, 2)),
    })
    const { store } = await browserHarness(used, document, SPENDING)
    const book = store.state.workbook!
    expect(book.items).toEqual([])
    expect(book.problems.map((problem) => problem.reason)).toEqual([
      'the parts of its entry add up to -23.47, and the entry says -23.49',
      'the parts of its entry add up to -23.47, and the entry says -23.49',
    ])
  })

  it('does not count while it waits on an account the file does not hold, and neither do its lines', async () => {
    const gone = { ...OTP, id: recordIdOf(ACCOUNT_RECORDS, key) }
    const split = receiptSplit(DRAFT, { account: gone }, LINES)
    const document = spendingDocumentOf('2026-11-04T09:00:00.000Z', {
      ...stored(ACCOUNT_RECORDS, ACCOUNTS),
      ...stored(CATEGORY_RECORDS, CATEGORIES),
      ...stored(RECEIPT_RECORDS, [split.receipt]),
      ...stored(ITEM_RECORDS, split.lines),
    })
    const { store } = await browserHarness(used, document, SPENDING)
    const book = store.state.workbook!
    expect([book.receipts, book.items]).toEqual([[], []])
    expect(book.problems.map((problem) => problem.kind)).toEqual(['receipt', 'item', 'item', 'item'])
  })
})
