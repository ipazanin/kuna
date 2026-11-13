import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { accountBalance } from '../src/apps/spending/accounts/domain/accountBalance'
import { ACCOUNT_WRITES, changeAccount } from '../src/apps/spending/accounts/application/accountWrites'
import { startDayMove } from '../src/apps/spending/accounts/domain/startDayMove'
import { newEntry } from '../src/apps/spending/entries/application/entryWrites'
import { reviewCount } from '../src/apps/spending/statements/domain/reviewQueue'
import { statementDryRun } from '../src/apps/spending/statements/domain/statementDryRun'
import { codecOfSpendingKind } from '../src/apps/spending/workbook/application/spendingCodecs'
import { beforeStartDay } from '../src/apps/spending/workbook/domain/account'
import type { TransactionItem } from '../src/apps/spending/workbook/domain/transactionItem'
import type { HeldBankRow } from '../src/apps/spending/workbook/domain/heldBankRow'
import type { Receipt } from '../src/apps/spending/workbook/domain/receipt'
import type { SpendingBooks } from '../src/apps/spending/workbook/domain/spendingBooks'
import { ACCOUNT_RECORDS, CATEGORY_RECORDS, HELD_ROW_RECORDS, ITEM_RECORDS, LINE_RECORDS, RECEIPT_RECORDS, TRANSACTION_RECORDS } from '../src/apps/spending/workbook/domain/spendingKinds'
import { plainLineOf } from '../src/apps/spending/workbook/domain/beforeItems'
import type { Transaction } from '../src/apps/spending/workbook/domain/transaction'
import { spendingDocumentOf } from '../src/apps/spending/workbook/infrastructure/spendingDocument'
import type { WorkbookStore } from '../src/shared/storage/application/createWorkbookStore'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import type { RecordKind } from '../src/shared/storage/domain/recordKind'
import { accountMoneyFromAmount } from '../src/shared/money/accountMoney'
import { moneyFromAmount } from '../src/shared/money/money'
import { civil } from './fixtures/ledger'
import { ACCOUNTS_BY_HAND, CATEGORIES, DAY, ROWS, category, row, addEntries } from './fixtures/spending'

import { SPENDING, browserHarness, forgetCaches } from './fixtures/writeBack'

/** The fixture's accounts kept by hand, since these checks type rows, which an account the bank fills refuses. */
const [OTP, REVOLUT_EUR] = ACCOUNTS_BY_HAND

const used = new Set<string>()

afterEach(async () => {
  await forgetCaches(used)
})

function stored<R>(kind: RecordKind<R>, records: readonly R[]) {
  const codec = codecOfSpendingKind(kind)
  return { [kind.name]: records.map((record) => codec.fieldsOf(record)) }
}

const key = (place: number): string => `5e000000-0000-4000-8000-${String(place).padStart(12, '0')}`

const [RENT, TOP_UP_OUT, TOP_UP_IN, SALARY] = [ROWS[0]!, ROWS[1]!, ROWS[2]!, ROWS[3]!]

/** The rent paid in October, on a receipt of two lines. */
const RENT_RECEIPT: Receipt = {
  id: recordIdOf(RECEIPT_RECORDS, key(6001)),
  transaction: RENT.id,
  account: null,
  merchant: 'Landlord',
  merchantOib: '',
  buyerOib: '',
  issuedOn: RENT.date,
  issuedTime: '',
  total: moneyFromAmount(600),
  jir: '',
  zki: '',
  readBy: '',
  photo: '',
  latitude: '',
  longitude: '',
}

function part(place: number, of: Transaction, amount: number, path: string, receipt: Receipt | null): TransactionItem {
  return {
    id: recordIdOf(ITEM_RECORDS, key(7000 + place)),
    transaction: of.id,
    receipt: receipt?.id ?? null,
    printed: '',
    note: path,
    amount: accountMoneyFromAmount(amount),
    category: category(path).id,
    link: null,
  }
}

const PARTS: readonly TransactionItem[] = [
  part(1, RENT, -400, 'Home/Rent', RENT_RECEIPT),
  part(2, RENT, -200, 'Money and fees/Loan instalments', RENT_RECEIPT),
  part(3, SALARY, 2_000, 'Income/Salary', null),
  part(4, SALARY, 400, 'Income/Salary', null),
]

function held(place: number, date: string, like: Transaction): HeldBankRow {
  return {
    id: recordIdOf(HELD_ROW_RECORDS, key(8000 + place)),
    account: OTP.id,
    date: civil(date),
    amount: like.amount,
    payee: like.payee,
    description: '',
    counterpartyIban: '',
    importKey: `bank-ref-${place}`,
    like: like.id,
  }
}

const OLD_HOLD = held(1, '2026-10-02', RENT)
const NEW_HOLD = held(2, '2026-10-13', ROWS[5]!)

/** A store whose file, from before items, holds the worked example's accounts, categories and October rows, with a receipt, a hand split and two rows on hold. */
async function spendingStore(rows: readonly Transaction[] = ROWS, extra: ReturnType<typeof stored> = {}): Promise<WorkbookStore<SpendingBooks>> {
  const document = spendingDocumentOf('2026-11-04T09:00:00.000Z', {
    ...stored(ACCOUNT_RECORDS, ACCOUNTS_BY_HAND),
    ...stored(CATEGORY_RECORDS, CATEGORIES),
    ...stored(TRANSACTION_RECORDS, rows),
    ...stored(RECEIPT_RECORDS, [RENT_RECEIPT]),
    ...stored(LINE_RECORDS, PARTS.map(plainLineOf)),
    ...stored(HELD_ROW_RECORDS, [OLD_HOLD, NEW_HOLD]),
    ...extra,
  })
  const { store } = await browserHarness(used, document, SPENDING)
  return store
}

const CUTOVER = civil('2026-10-11')

describe("an account's start day", () => {
  it('is a day no row of the account comes before', () => {
    expect([civil('2026-08-31'), civil('2026-09-01'), civil('2026-09-02')].map((day) => beforeStartDay(OTP, day))).toEqual([true, false, false])
  })

  it('leaves out a row and a bank row on hold from before it, so neither waits on To review nor counts in a balance', async () => {
    const early = row(OTP, '2026-08-20', -45, null, { payee: 'Corner market' })
    const store = await spendingStore([...ROWS, early], stored(HELD_ROW_RECORDS, [held(3, '2026-08-21', early)]))
    const book = store.state.workbook!

    expect(book.transactions.map((kept) => kept.id)).not.toContain(early.id)
    expect(book.held.map((kept) => kept.importKey)).toEqual([])
    expect(reviewCount(book)).toBe(0)
    expect(book.problems.map((problem) => [problem.kind, problem.reason])).toEqual([
      [TRANSACTION_RECORDS.name, "is from before its account's start day 2026-09-01, so it counts nowhere"],
      [HELD_ROW_RECORDS.name, "is from before its account's start day 2026-09-01, so it counts nowhere"],
    ])
    expect(accountBalance(OTP, book.transactions, DAY)).toBe(accountMoneyFromAmount(1_850))
  })

  it('refuses an entry before it, which another tab could otherwise add after the day moved', async () => {
    const store = await spendingStore()
    const entry = newEntry({ account: OTP.id, date: civil('2026-08-31'), amount: accountMoneyFromAmount(-3.5), payee: 'Café', category: category('Food/Coffee').id, note: '' })

    await expect(store.write('Added', (unit) => addEntries(unit, store.state.records!, [entry]))).rejects.toThrow("is from before its account's start day 2026-09-01")
  })

  it('refuses a move later that leaves rows before the new day on the file', async () => {
    const store = await spendingStore()

    await expect(store.write('Saved', (unit) => unit.of(ACCOUNT_WRITES).change(OTP, { ...OTP, openedOn: CUTOVER }))).rejects.toThrow("is from before its account's start day 2026-10-11")
  })

  it('leaves out of a statement the rows from before it', async () => {
    const store = await spendingStore()
    const statement = { label: 'export.csv', rows: [{ ...RENT, category: null, importKey: 'old-1', date: civil('2026-08-30') }], notes: [] }

    expect(statementDryRun(store.state.workbook!, statement, DAY).lines.map((line) => line.outcome)).toEqual(['before-opening'])
  })
})

describe("moving an account's start day later", () => {
  it('lists the rows, receipts, parts and held rows that go, and the transfer legs left alone, with the opening that keeps the balance', async () => {
    const store = await spendingStore()
    const move = startDayMove(store.state.workbook!, OTP, CUTOVER)!

    expect(move.direction).toBe('later')
    expect(move.rows.map((gone) => gone.id)).toEqual([RENT.id, TOP_UP_OUT.id, SALARY.id])
    expect(move.receipts).toEqual([RENT_RECEIPT])
    expect(move.parts).toEqual(PARTS)
    expect(move.held).toEqual([OLD_HOLD])
    expect(move.loneLegs.map((leg) => leg.id)).toEqual([TOP_UP_IN.id])
    // 1,550.00 − 600.00 − 200.00 + 2,400.00: what OTP held when 11 Oct began.
    expect(move.opening).toBe(accountMoneyFromAmount(3_150))
  })

  it('deletes what came before in one write, keeps the other leg as a lone leg under Between my accounts and today’s balance, and one Undo puts it all back', async () => {
    const store = await spendingStore()
    const before = store.state.workbook!
    const move = startDayMove(before, OTP, CUTOVER)!

    await store.write('Saved', (unit) => changeAccount(unit, store.state.records!, OTP, { ...OTP, openedOn: CUTOVER, opening: move.opening }, move))

    const after = store.state.workbook!
    expect(store.state.writes).toHaveLength(1)
    expect(after.problems).toEqual([])
    expect(after.transactions.map((kept) => kept.id)).not.toContain(RENT.id)
    expect(after.receipts).toEqual([])
    expect(after.items.filter((item) => item.transaction === RENT.id || item.transaction === SALARY.id)).toEqual([])
    expect(store.state.records!.lines.records).toEqual([])
    expect(after.held).toEqual([NEW_HOLD])
    expect(after.transactions.find((kept) => kept.id === TOP_UP_IN.id)).toMatchObject({ pair: null, category: category('Between my accounts').id, account: REVOLUT_EUR.id })
    expect(
      accountBalance(
        after.accounts.find((account) => account.id === OTP.id)!,
        after.transactions,
        DAY,
      ),
    ).toBe(accountMoneyFromAmount(1_850))
    expect(accountBalance(REVOLUT_EUR, after.transactions, DAY)).toBe(accountMoneyFromAmount(320.5))

    await store.undo(store.state.writes[0]!)
    const back = store.state.workbook!
    expect(back.problems).toEqual([])
    expect(back.transactions).toHaveLength(ROWS.length)
    expect(back.receipts).toEqual([RENT_RECEIPT])
    expect(back.items.filter((item) => item.transaction === RENT.id || item.transaction === SALARY.id)).toHaveLength(PARTS.length)
    expect(back.held).toHaveLength(2)
    expect(back.accounts.find((account) => account.id === OTP.id)).toEqual(OTP)
  })

  it('keeps the opening the person typed instead of the one worked out', async () => {
    const store = await spendingStore()
    const move = startDayMove(store.state.workbook!, OTP, CUTOVER)!

    await store.write('Saved', (unit) => changeAccount(unit, store.state.records!, OTP, { ...OTP, openedOn: CUTOVER, opening: accountMoneyFromAmount(3_000) }, move))

    expect(
      accountBalance(
        store.state.workbook!.accounts.find((account) => account.id === OTP.id)!,
        store.state.workbook!.transactions,
        DAY,
      ),
    ).toBe(accountMoneyFromAmount(1_700))
  })

  it('refuses the move when a row before the new day came in after the person saw what goes', async () => {
    const store = await spendingStore()
    const move = startDayMove(store.state.workbook!, OTP, CUTOVER)!
    const meanwhile = newEntry({ account: OTP.id, date: civil('2026-10-05'), amount: accountMoneyFromAmount(-3.5), payee: 'Café', category: category('Food/Coffee').id, note: '' })
    await store.write('Added', (unit) => addEntries(unit, store.state.records!, [meanwhile]))

    await expect(store.write('Saved', (unit) => changeAccount(unit, store.state.records!, OTP, { ...OTP, openedOn: CUTOVER, opening: move.opening }, move))).rejects.toThrow(
      "is from before its account's start day 2026-10-11",
    )
    expect(store.state.workbook!.transactions).toHaveLength(ROWS.length + 1)
  })
})

describe("moving an account's start day earlier", () => {
  it('deletes nothing and keeps the opening', async () => {
    const store = await spendingStore()
    const move = startDayMove(store.state.workbook!, OTP, civil('2026-08-01'))!

    expect(move).toMatchObject({ direction: 'earlier', rows: [], receipts: [], parts: [], held: [], loneLegs: [], opening: OTP.opening })
  })

  it('is no move on the start day itself', async () => {
    const store = await spendingStore()

    expect(startDayMove(store.state.workbook!, OTP, OTP.openedOn)).toBeNull()
  })
})
