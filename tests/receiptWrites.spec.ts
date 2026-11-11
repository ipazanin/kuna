import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { accountBalance } from '../src/apps/spending/accounts/domain/accountBalance'
import { spendingFigures } from '../src/apps/spending/analytics/presentation/spendingFigures'
import { deleteInto } from '../src/apps/spending/categories/application/categoryWrites'
import { PART_WRITES, TRANSACTION_WRITES, removeEntry, removeSplitOf } from '../src/apps/spending/entries/application/entryWrites'
import { RECEIPT_WRITES } from '../src/apps/spending/receipts/application/receiptRecords'
import { writeReceiptSplit } from '../src/apps/spending/receipts/application/receiptWrites'
import { receiptSplit, wholeReceipt } from '../src/apps/spending/receipts/domain/receiptSplit'
import type { ReceiptDraft } from '../src/apps/spending/receipts/domain/receiptSplit'
import { joinWithTyped, writeDryRun } from '../src/apps/spending/statements/application/statementWrites'
import { reviewCount, reviewQueue } from '../src/apps/spending/statements/domain/reviewQueue'
import { statementDryRun } from '../src/apps/spending/statements/domain/statementDryRun'
import { SETTING_WRITES } from '../src/apps/spending/workbook/application/settingWrites'
import { setSetting } from '../src/shared/storage/application/settingWrites'
import { codecOfSpendingKind } from '../src/apps/spending/workbook/application/spendingCodecs'
import type { SpendingBooks } from '../src/apps/spending/workbook/domain/spendingBooks'
import { ACCOUNT_RECORDS, CATEGORY_RECORDS } from '../src/apps/spending/workbook/domain/spendingKinds'
import type { Transaction } from '../src/apps/spending/workbook/domain/transaction'
import { COMPANY_OIB_KEY } from '../src/apps/spending/workbook/domain/spendingSettings'
import { readSpendingBook } from '../src/apps/spending/workbook/domain/readSpendingBook'
import { spendingDocumentOf } from '../src/apps/spending/workbook/infrastructure/spendingDocument'
import { NO_RATES } from '../src/shared/money/rateBook'
import type { WorkbookStore } from '../src/shared/storage/application/createWorkbookStore'
import type { RecordKind } from '../src/shared/storage/domain/recordKind'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import type { RecordId } from '../src/shared/storage/domain/recordId'
import { recordsOf } from '../src/shared/storage/domain/recordsRead'
import { accountMoneyFromAmount } from '../src/shared/money/accountMoney'
import { moneyFromAmount } from '../src/shared/money/money'
import { civil, month } from './fixtures/ledger'
import { ACCOUNTS, ACCOUNTS_BY_HAND, CASH, CATEGORIES, category, row } from './fixtures/spending'
import { SPENDING, browserHarness, forgetCaches } from './fixtures/writeBack'

/** The fixture's accounts kept by hand, since these checks type rows, which an account the bank fills refuses. */
const [OTP] = ACCOUNTS_BY_HAND

const used = new Set<string>()

afterEach(async () => {
  await forgetCaches(used)
})

function stored<R>(kind: RecordKind<R>, records: readonly R[]) {
  const codec = codecOfSpendingKind(kind)
  return { [kind.name]: records.map((record) => codec.fieldsOf(record)) }
}

async function spendingStore(): Promise<WorkbookStore<SpendingBooks>> {
  const document = spendingDocumentOf('2026-11-04T09:00:00.000Z', { ...stored(ACCOUNT_RECORDS, ACCOUNTS_BY_HAND), ...stored(CATEGORY_RECORDS, CATEGORIES) })
  const { store } = await browserHarness(used, document, SPENDING)
  return store
}

const DRAFT: ReceiptDraft = {
  merchant: ' Corner market ',
  merchantOib: '',
  buyerOib: '',
  issuedOn: civil('2026-11-03'),
  issuedTime: '18:42',
  total: moneyFromAmount(23.49),
  jir: '1a2b3c4d-0000-4000-8000-1234567890ab',
  zki: '',
  readBy: '',
  photo: '',
  latitude: '',
  longitude: '',
}
const GROCERIES = category('Food/Groceries')
const WHOLE = wholeReceipt(moneyFromAmount(23.49), GROCERIES.id)

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

    const written = await store.write('Saved', (unit) => writeReceiptSplit(unit, receiptSplit(DRAFT, { row: card, handParts: [] }, WHOLE)))

    const book = store.state.workbook!
    expect(book.problems).toEqual([])
    expect(book.transactions).toMatchObject([{ id: card.id, category: GROCERIES.id, categorisedBy: 'person', payee: 'Corner market', source: 'statement', importKey: 'key-1' }])
    expect(book.receipts).toMatchObject([{ transaction: card.id, merchant: 'Corner market', issuedOn: civil('2026-11-03'), issuedTime: '18:42', total: moneyFromAmount(23.49), readBy: '', photo: '' }])
    expect(book.lines).toMatchObject([{ transaction: card.id, amount: accountMoneyFromAmount(-23.49), category: GROCERIES.id, text: '' }])
    expect(reviewCount(book)).toBe(0)

    await store.undo(store.state.writes.find((write) => write.receipt === written)!)

    expect(store.state.workbook!.transactions).toEqual(before)
    expect(store.state.workbook!.receipts).toEqual([])
    expect(store.state.workbook!.lines).toEqual([])
  })

  it("takes the merchant from the row when you typed none, and keeps the row's own payee when you did", async () => {
    const card = row(OTP, '2026-11-04', -23.49, null, { payee: 'POS 0412' })

    expect(receiptSplit({ ...DRAFT, merchant: '' }, { row: card, handParts: [] }, WHOLE).receipt.merchant).toBe('POS 0412')
    expect(receiptSplit(DRAFT, { row: card, handParts: [] }, WHOLE).row.payee).toBe('POS 0412')
  })

  it('adds one Difference line for a near match, so the lines add up to the row and its spending is what left the account', async () => {
    const store = await spendingStore()
    const card = await withRow(store, row(OTP, '2026-11-04', -25, null))
    await store.write('Saved', (unit) => writeReceiptSplit(unit, receiptSplit(DRAFT, { row: card, handParts: [] }, WHOLE)))

    const book = store.state.workbook!
    expect(book.problems).toEqual([])
    expect(book.lines).toMatchObject([
      { amount: accountMoneyFromAmount(-23.49), category: GROCERIES.id },
      { amount: accountMoneyFromAmount(-1.51), category: GROCERIES.id, text: 'Difference' },
    ])
    expect(spendingFigures(book, NO_RATES).totalsOf(month('2026-11')).byCategory.get(GROCERIES.id)).toEqual(moneyFromAmount(25))
  })

  it('makes a row of source receipt when none matched, on the account picked, which a later import fills and keeps split', async () => {
    const store = await spendingStore()
    await store.write('Saved', (unit) => writeReceiptSplit(unit, receiptSplit(DRAFT, { account: OTP }, WHOLE)))
    const [made] = store.state.workbook!.transactions
    expect(made).toMatchObject({
      account: OTP.id,
      date: civil('2026-11-03'),
      amount: accountMoneyFromAmount(-23.49),
      payee: 'Corner market',
      source: 'receipt',
      categorisedBy: 'person',
      category: GROCERIES.id,
    })

    const statement = {
      label: 'export.csv',
      rows: [
        {
          account: OTP.id,
          date: civil('2026-11-05'),
          amount: accountMoneyFromAmount(-23.49),
          payee: 'POS 0412',
          category: null,
          description: 'POS 0412',
          counterpartyIban: '',
          importKey: 'key-1',
          movedAt: '',
          pocket: false,
          cashWithdrawal: false,
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

  it('makes a typed row on a cash account, since no statement ever fills it, and a receipt row on a bank account for the statement to fill', async () => {
    const onCash = receiptSplit(DRAFT, { account: CASH }, WHOLE)
    const onBank = receiptSplit(DRAFT, { account: OTP }, WHOLE)

    expect([onCash.row.account, onCash.row.source]).toEqual([CASH.id, 'typed'])
    expect([onBank.row.account, onBank.row.source]).toEqual([OTP.id, 'receipt'])
  })

  it('stays out of the balance: the row moves it once, whichever lines it has', async () => {
    const store = await spendingStore()
    const balances = bookSums(store)
    await store.write('Saved', (unit) => writeReceiptSplit(unit, receiptSplit(DRAFT, { account: CASH }, WHOLE)))

    const after = bookSums(store)
    expect(after[3]! - balances[3]!).toBe(accountMoneyFromAmount(-23.49))
  })
})

describe('a receipt read into lines', () => {
  const HOUSEHOLD = category('Home/Household goods')
  const PARTS = [
    { printed: 'MLIJEKO', text: 'mlijeko', amount: accountMoneyFromAmount(-15), category: GROCERIES.id },
    { printed: 'DET.TEK.', text: 'deterdžent', amount: accountMoneyFromAmount(-8.49), category: HOUSEHOLD.id },
  ]

  it('files the row under the category most of the money is under, with a line each', async () => {
    const store = await spendingStore()
    const card = await withRow(store, row(OTP, '2026-11-04', -23.49, null))
    await store.write('Saved', (unit) => writeReceiptSplit(unit, receiptSplit(DRAFT, { row: card, handParts: [] }, PARTS)))

    const book = store.state.workbook!
    expect(book.problems).toEqual([])
    expect(book.transactions[0]!.category).toBe(GROCERIES.id)
    expect(book.lines.map((line) => [line.printed, line.amount, line.category])).toEqual([
      ['MLIJEKO', accountMoneyFromAmount(-15), GROCERIES.id],
      ['DET.TEK.', accountMoneyFromAmount(-8.49), HOUSEHOLD.id],
    ])
    const totals = spendingFigures(book, NO_RATES).totalsOf(month('2026-11'))
    expect([totals.byCategory.get(GROCERIES.id), totals.byCategory.get(HOUSEHOLD.id), totals.spent]).toEqual([moneyFromAmount(15), moneyFromAmount(8.49), moneyFromAmount(23.49)])
  })

  it('keeps the lines as confirmed when they do not add up, and shows what is left as one Difference line', () => {
    const { lines } = receiptSplit(DRAFT, { account: OTP }, [{ ...PARTS[0]!, amount: accountMoneyFromAmount(-14.5) }, PARTS[1]!])

    expect(lines.map((line) => [line.amount, line.text === 'Difference'])).toEqual([
      [accountMoneyFromAmount(-14.5), false],
      [accountMoneyFromAmount(-8.49), false],
      [accountMoneyFromAmount(-0.5), true],
    ])
  })

  it('counts nothing as spending for an R1 receipt, whose lines are all For the company', async () => {
    const store = await spendingStore()
    const company = category('For the company').id
    const card = await withRow(store, row(OTP, '2026-11-04', -23.49, null))
    await store.write('Saved', (unit) =>
      writeReceiptSplit(
        unit,
        receiptSplit(
          { ...DRAFT, buyerOib: '11111111119' },
          { row: card, handParts: [] },
          PARTS.map((part) => ({ ...part, category: company })),
        ),
      ),
    )

    const book = store.state.workbook!
    expect(book.transactions[0]!.category).toBe(company)
    expect(book.receipts[0]!.buyerOib).toBe('11111111119')
    expect(spendingFigures(book, NO_RATES).totalsOf(month('2026-11')).spent).toEqual(moneyFromAmount(0))
  })

  it('keeps the Company OIB in its setting, which no other reader refuses', async () => {
    const store = await spendingStore()
    await store.write('Saved', (unit) => setSetting(unit, SETTING_WRITES, [], COMPANY_OIB_KEY, '11111111119'))

    expect(store.state.workbook!.settings.companyOib).toBe('11111111119')
    expect(store.state.workbook!.problems).toEqual([])
  })
})

describe('a row a receipt split', () => {
  async function splitStore() {
    const store = await spendingStore()
    const card = await withRow(store, row(OTP, '2026-11-04', -23.49, null))
    await store.write('Saved', (unit) => writeReceiptSplit(unit, receiptSplit(DRAFT, { row: card, handParts: [] }, WHOLE)))
    return { store, split: store.state.workbook!.transactions[0]! }
  }

  it('refuses a new amount, since its lines would not add up', async () => {
    const { store, split } = await splitStore()

    await expect(store.write('Changed', (unit) => unit.of(TRANSACTION_WRITES).change(split, { ...split, amount: accountMoneyFromAmount(-30) }))).rejects.toThrow(/add up/)
  })

  it('refuses a line that breaks the sum', async () => {
    const { store } = await splitStore()
    const [line] = store.state.workbook!.lines

    await expect(store.write('Changed', (unit) => unit.of(PART_WRITES).change(line!, { ...line!, amount: accountMoneyFromAmount(-20) }))).rejects.toThrow(/add up/)
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

    await store.write('Removed', (unit) => removeSplitOf(unit, records, split))

    expect(store.state.workbook!.transactions).toMatchObject([{ id: split.id, amount: accountMoneyFromAmount(-23.49), category: GROCERIES.id }])
    expect([store.state.workbook!.receipts, store.state.workbook!.lines]).toEqual([[], []])
    expect(spendingFigures(store.state.workbook!, NO_RATES).totalsOf(month('2026-11')).byCategory.get(GROCERIES.id)).toEqual(moneyFromAmount(23.49))
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
    await store.write('Saved', (unit) => writeReceiptSplit(unit, receiptSplit(DRAFT, { account: OTP }, WHOLE)))
    const statement = {
      label: 'export.csv',
      rows: [
        {
          account: OTP.id,
          date: civil('2026-11-05'),
          amount: accountMoneyFromAmount(-25),
          payee: 'POS 0412',
          category: null,
          description: 'POS 0412',
          counterpartyIban: '',
          importKey: 'key-1',
          movedAt: '',
          pocket: false,
          cashWithdrawal: false,
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
    expect(book.transactions).toMatchObject([{ amount: accountMoneyFromAmount(-25), source: 'receipt', importKey: 'key-1' }])
    expect(book.lines).toMatchObject([{ amount: accountMoneyFromAmount(-23.49) }, { amount: accountMoneyFromAmount(-1.51), text: 'Difference', category: GROCERIES.id }])
  })
})

describe("a receipt's place", () => {
  it('is stored as text with the receipt, whether or not the photo is kept, and read back', async () => {
    const store = await spendingStore()
    await store.write('Saved', (unit) => writeReceiptSplit(unit, receiptSplit({ ...DRAFT, latitude: '43.508100', longitude: '16.440200', photo: '' }, { account: OTP }, WHOLE)))

    expect(store.state.workbook!.problems).toEqual([])
    expect(store.state.workbook!.receipts[0]).toMatchObject({ latitude: '43.508100', longitude: '16.440200', photo: '' })
  })
})

describe('reading receipts and lines', () => {
  it('refuses the same fiscal receipt a second time, on another row, so it cannot count twice', async () => {
    const store = await spendingStore()
    await store.write('Saved', (unit) => writeReceiptSplit(unit, receiptSplit(DRAFT, { account: OTP }, WHOLE)))

    await expect(store.write('Saved', (unit) => writeReceiptSplit(unit, receiptSplit(DRAFT, { account: OTP }, WHOLE)))).rejects.toThrow(/JIR/)
    expect(store.state.workbook!.transactions).toHaveLength(1)
  })

  it('lets two receipts with no code stand side by side', async () => {
    const store = await spendingStore()
    const typed = { ...DRAFT, jir: '' }
    await store.write('Saved', (unit) => writeReceiptSplit(unit, receiptSplit(typed, { account: OTP }, WHOLE)))
    await store.write('Saved', (unit) => writeReceiptSplit(unit, receiptSplit(typed, { account: CASH }, WHOLE)))

    expect(store.state.workbook!.problems).toEqual([])
    expect(store.state.workbook!.receipts).toHaveLength(2)
  })

  it("leaves all of a row's lines out when one is refused, so the row counts whole under its own category", () => {
    const split = row(OTP, '2026-11-04', -30, 'Food/Coffee')
    const one = receiptSplit({ ...DRAFT, total: moneyFromAmount(30) }, { row: split, handParts: [] }, [
      { printed: '', text: '', amount: accountMoneyFromAmount(-10), category: GROCERIES.id },
      { printed: '', text: '', amount: accountMoneyFromAmount(-20), category: GROCERIES.id },
    ])
    const lines = [{ ...one.lines[0]!, category: recordIdOf(CATEGORY_RECORDS, '5e000000-0000-4000-8000-000000009999') }, one.lines[1]!]
    const read = <R>(records: readonly R[]) => ({ records: records.map((record) => ({ record, id: (record as { id: RecordId }).id, label: '', fields: {} })), refused: [] })
    const book = readSpendingBook({
      accounts: read(ACCOUNTS),
      categories: read(CATEGORIES),
      transactions: read([one.row]),
      budgets: read([]),
      rules: read([]),
      receipts: read([one.receipt]),
      lines: read(lines),
      held: read([]),
      settings: read([]),
    })

    expect(book.lines).toEqual([])
    expect(spendingFigures(book, NO_RATES).totalsOf(month('2026-11')).spent).toEqual(accountMoneyFromAmount(30))
  })

  it('refuses lines that do not add up and counts the row under its own category instead', async () => {
    const store = await spendingStore()
    const card = await withRow(store, row(OTP, '2026-11-04', -23.49, 'Food/Coffee'))
    const split = receiptSplit(DRAFT, { row: card, handParts: [] }, WHOLE)
    const broken = { ...split.lines[0]!, amount: accountMoneyFromAmount(-20) }

    await expect(store.write('Saved', (unit) => writeReceiptSplit(unit, { ...split, lines: [broken] }))).rejects.toThrow(/add up/)
    expect(store.state.workbook!.lines).toEqual([])
    expect(store.state.workbook!.transactions).toMatchObject([{ category: category('Food/Coffee').id }])
  })

  it('refuses a second receipt on a row', async () => {
    const store = await spendingStore()
    const card = await withRow(store, row(OTP, '2026-11-04', -23.49, null))
    await store.write('Saved', (unit) => writeReceiptSplit(unit, receiptSplit(DRAFT, { row: card, handParts: [] }, WHOLE)))
    const held = store.state.workbook!.transactions[0]!

    await expect(store.write('Saved', (unit) => writeReceiptSplit(unit, receiptSplit(DRAFT, { row: held, handParts: [] }, WHOLE)))).rejects.toThrow()
  })
})
