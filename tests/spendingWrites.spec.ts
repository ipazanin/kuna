import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { accountBalance } from '../src/apps/spending/accounts/domain/accountBalance'
import { ACCOUNT_WRITES } from '../src/apps/spending/accounts/application/accountWrites'
import { setLimit } from '../src/apps/spending/budgets/application/budgetWrites'
import { CATEGORY_WRITES, deleteInto } from '../src/apps/spending/categories/application/categoryWrites'
import { TRANSACTION_WRITES, newEntry, newTransfer, removeEntry } from '../src/apps/spending/entries/application/entryWrites'
import { codecOfSpendingKind } from '../src/apps/spending/workbook/application/spendingCodecs'
import type { SpendingBooks } from '../src/apps/spending/workbook/domain/spendingBooks'
import { ACCOUNT_RECORDS, CATEGORY_RECORDS } from '../src/apps/spending/workbook/domain/spendingKinds'
import { spendingDocumentOf } from '../src/apps/spending/workbook/infrastructure/spendingDocument'
import type { WorkbookStore } from '../src/shared/storage/application/createWorkbookStore'
import type { RecordKind } from '../src/shared/storage/domain/recordKind'
import { recordsChangeInWords } from '../src/shared/storage/presentation/recordsChangeInWords'
import { civil, euros, month } from './fixtures/ledger'
import { ACCOUNTS, CATEGORIES, DAY, OTP, REVOLUT_EUR, REVOLUT_USD, category } from './fixtures/spending'
import { SPENDING, browserHarness, forgetCaches } from './fixtures/writeBack'

const used = new Set<string>()

afterEach(async () => {
  await forgetCaches(used)
})

function stored<R>(kind: RecordKind<R>, records: readonly R[]) {
  const codec = codecOfSpendingKind(kind)
  return { [kind.name]: records.map((record) => codec.fieldsOf(record)) }
}

/** A store whose file holds the worked example's four accounts and the English starter categories. */
async function spendingStore(): Promise<WorkbookStore<SpendingBooks>> {
  const document = spendingDocumentOf('2026-11-04T09:00:00.000Z', { ...stored(ACCOUNT_RECORDS, ACCOUNTS), ...stored(CATEGORY_RECORDS, CATEGORIES) })
  const { store } = await browserHarness(used, document, SPENDING)
  return store
}

const BETWEEN = category('Between my accounts')

/** The records in the order of their ids, since Undo puts records back at the end of the file. */
function byId<R extends { readonly id: string }>(records: readonly R[]): R[] {
  return [...records].sort((left, right) => left.id.localeCompare(right.id))
}

function topUp(amount = 200, into = REVOLUT_EUR, received = amount) {
  return newTransfer({ account: OTP.id, amount: euros(amount) }, { account: into.id, amount: euros(received) }, { date: civil('2026-10-03'), payee: ' Top-up ', note: '', category: BETWEEN.id })
}

function coffee(date: string, amount: number) {
  return newEntry({ account: OTP.id, date: civil(date), amount: euros(amount), payee: ' Café on the square ', category: category('Food/Coffee').id, note: '' })
}

describe('Spending writes', () => {
  it('keeps a typed entry with its text trimmed', async () => {
    const store = await spendingStore()

    await store.write('Added', (unit) => unit.of(TRANSACTION_WRITES).add(coffee('2026-10-16', -3.5)))

    expect(store.state.workbook!.transactions).toMatchObject([{ payee: 'Café on the square', source: 'typed', pair: null, amount: euros(-3.5) }])
    expect(store.state.workbook!.problems).toEqual([])
  })

  it("writes a transfer's two legs in one write, each naming the other, out of one account and into the other", async () => {
    const store = await spendingStore()
    const [out, into] = topUp()

    await store.write('Added', (unit) => [out, into].forEach((leg) => unit.of(TRANSACTION_WRITES).add(leg)))

    expect(store.state.writes).toHaveLength(1)
    expect(store.state.workbook!.problems).toEqual([])
    expect(store.state.workbook!.transactions.map((leg) => [leg.account, leg.amount, leg.payee, leg.pair])).toEqual([
      [OTP.id, euros(-200), 'Top-up', into.id],
      [REVOLUT_EUR.id, euros(200), 'Top-up', out.id],
    ])
    // OTP 1,550.00 − 200.00 and Revolut EUR 300.00 + 200.00.
    expect([OTP, REVOLUT_EUR].map((account) => accountBalance(account, store.state.workbook!.transactions, DAY))).toEqual([euros(1_350), euros(500)])
  })

  it('writes a transfer between two currencies with an amount on each side', async () => {
    const store = await spendingStore()

    await store.write('Added', (unit) => topUp(100, REVOLUT_USD, 108.5).forEach((leg) => unit.of(TRANSACTION_WRITES).add(leg)))

    expect([OTP, REVOLUT_USD].map((account) => accountBalance(account, store.state.workbook!.transactions, DAY))).toEqual([euros(1_450), euros(308.5)])
  })

  it('deletes the other leg with the one deleted, in one write that one Undo puts back whole', async () => {
    const store = await spendingStore()
    const [out, into] = topUp()
    await store.write('Added', (unit) => [out, into].forEach((leg) => unit.of(TRANSACTION_WRITES).add(leg)))
    const before = store.state.workbook!.transactions

    const receipt = await store.write('Deleted', (unit) => removeEntry(unit, store.state.records!, into))

    expect(recordsChangeInWords(receipt!, null)).toBe('Deleted 2 entries')
    expect(store.state.workbook!.transactions).toEqual([])
    expect(store.state.workbook!.problems).toEqual([])
    await store.undo(store.state.writes[0]!)
    expect(byId(store.state.workbook!.transactions)).toEqual(byId(before))
  })

  it('refuses to delete one leg of a transfer alone, which would leave the other naming nothing', async () => {
    const store = await spendingStore()
    const [out, into] = topUp()
    await store.write('Added', (unit) => [out, into].forEach((leg) => unit.of(TRANSACTION_WRITES).add(leg)))

    await expect(store.write('Deleted', (unit) => unit.of(TRANSACTION_WRITES).remove(out))).rejects.toThrow('names as its other leg a row that does not name it back')
    expect(store.state.workbook!.transactions).toHaveLength(2)
  })

  it('refuses to delete an account its entries name', async () => {
    const store = await spendingStore()
    await store.write('Added', (unit) => unit.of(TRANSACTION_WRITES).add(coffee('2026-10-16', -3.5)))

    await expect(store.write('Deleted', (unit) => unit.of(ACCOUNT_WRITES).remove(OTP))).rejects.toThrow('names no account in the file')
  })
})

describe('Spending account writes', () => {
  it('keeps an account that opened overdrawn at −€300.00, and a rename leaves its opening as it is', async () => {
    const overdrawn = { ...OTP, opening: euros(-300) }
    const document = spendingDocumentOf('2026-11-04T09:00:00.000Z', { ...stored(ACCOUNT_RECORDS, [overdrawn, REVOLUT_EUR]), ...stored(CATEGORY_RECORDS, CATEGORIES) })
    const { store } = await browserHarness(used, document, SPENDING)

    await store.write('Renamed', (unit) => unit.of(ACCOUNT_WRITES).change(overdrawn, { ...overdrawn, name: 'OTP current, overdraft' }))

    expect(store.state.workbook!.problems).toEqual([])
    expect(store.state.workbook!.accounts.find((account) => account.id === OTP.id)).toMatchObject({ name: 'OTP current, overdraft', opening: euros(-300) })
    expect(accountBalance(store.state.workbook!.accounts[0]!, [], DAY)).toEqual(euros(-300))
  })

  it('refuses a new currency on an account its entries name, and allows it on one without entries', async () => {
    const store = await spendingStore()
    await store.write('Added', (unit) =>
      unit.of(TRANSACTION_WRITES).add(newEntry({ account: REVOLUT_USD.id, date: civil('2026-10-10'), amount: euros(-30), payee: 'Diner', category: category('Food/Restaurants').id, note: '' })),
    )
    const euro = REVOLUT_EUR.currency

    await expect(store.write('Changed', (unit) => unit.of(ACCOUNT_WRITES).change(REVOLUT_USD, { ...REVOLUT_USD, currency: euro }))).rejects.toThrow(
      '"Revolut USD" has entries in USD, so it keeps that currency',
    )
    const cash = ACCOUNTS.find((account) => account.kind === 'cash')!
    await store.write('Changed', (unit) => unit.of(ACCOUNT_WRITES).change(cash, { ...cash, currency: REVOLUT_USD.currency }))
    expect(store.state.workbook!.accounts.find((account) => account.id === cash.id)?.currency).toBe('USD')
  })
})

describe('Spending category writes', () => {
  it('deletes Groceries into Restaurants: its entries move, its limits end, and Restaurants keeps its own limit, all undone at once', async () => {
    const store = await spendingStore()
    const [groceries, restaurants] = [category('Food/Groceries'), category('Food/Restaurants')]
    const shopping = (date: string, amount: number) => newEntry({ account: OTP.id, date: civil(date), amount: euros(amount), payee: 'Corner market', category: groceries.id, note: '' })
    await store.write('Added', (unit) => {
      unit.of(TRANSACTION_WRITES).add(shopping('2026-10-12', -45.3))
      unit.of(TRANSACTION_WRITES).add(shopping('2026-10-19', -60))
      setLimit(unit, store.state.records!, restaurants.id, month('2026-01'), euros(100))
      setLimit(unit, store.state.records!, groceries.id, month('2026-09'), euros(300))
    })
    const before = store.state.workbook!

    await store.write('Deleted', (unit) => deleteInto(unit, store.state.records!, groceries, restaurants))

    const after = store.state.workbook!
    expect(after.problems).toEqual([])
    expect(after.categories.map((held) => held.id)).not.toContain(groceries.id)
    expect(after.transactions.map((entry) => entry.category)).toEqual([restaurants.id, restaurants.id])
    expect(after.budgets.map((limit) => [limit.category, limit.from, limit.amount])).toEqual([[restaurants.id, '2026-01', euros(100)]])
    await store.undo(store.state.writes[0]!)
    const undone = store.state.workbook!
    expect([byId(undone.categories), byId(undone.transactions), byId(undone.budgets)]).toEqual([byId(before.categories), byId(before.transactions), byId(before.budgets)])
  })

  it('refuses to delete a category its entries name, which delete-into moves first', async () => {
    const store = await spendingStore()
    await store.write('Added', (unit) => unit.of(TRANSACTION_WRITES).add(coffee('2026-10-16', -3.5)))

    await expect(store.write('Deleted', (unit) => unit.of(CATEGORY_WRITES).remove(category('Food/Coffee')))).rejects.toThrow('names no category in the file')
  })

  it('keeps a fixed category, which can be renamed but never deleted', async () => {
    const store = await spendingStore()

    await expect(store.write('Deleted', (unit) => unit.of(CATEGORY_WRITES).remove(BETWEEN))).rejects.toThrow('"Between my accounts" is a fixed category, so it stays. It can be renamed')
    await expect(store.write('Deleted', (unit) => deleteInto(unit, store.state.records!, BETWEEN, category('Other/Other')))).rejects.toThrow('is a fixed category')

    await store.write('Renamed', (unit) => unit.of(CATEGORY_WRITES).change(BETWEEN, { ...BETWEEN, name: 'My own accounts' }))
    expect(store.state.workbook!.categories.find((held) => held.id === BETWEEN.id)?.name).toBe('My own accounts')
  })
})

describe('Spending limit writes', () => {
  it('adds a limit from a month, and changes the budget of that month when set again', async () => {
    const store = await spendingStore()
    const food = category('Food').id

    await store.write('Set', (unit) => setLimit(unit, store.state.records!, food, month('2026-09'), euros(400)))
    await store.write('Set', (unit) => setLimit(unit, store.state.records!, food, month('2026-09'), euros(450)))
    await store.write('Set', (unit) => setLimit(unit, store.state.records!, food, month('2026-12'), euros(0)))

    expect(store.state.workbook!.budgets.map((limit) => [limit.from, limit.amount])).toEqual([
      ['2026-09', euros(450)],
      ['2026-12', euros(0)],
    ])
  })

  it('refuses a limit on a child while its group has one in the same months, and takes it once the group’s has ended', async () => {
    const store = await spendingStore()
    const [food, groceries] = [category('Food').id, category('Food/Groceries').id]
    await store.write('Set', (unit) => setLimit(unit, store.state.records!, food, month('2026-09'), euros(400)))

    await expect(store.write('Set', (unit) => setLimit(unit, store.state.records!, groceries, month('2026-10'), euros(250)))).rejects.toThrow(
      'is on a group and on one of its children in the same months',
    )

    await store.write('Set', (unit) => {
      setLimit(unit, store.state.records!, food, month('2026-11'), euros(0))
      setLimit(unit, store.state.records!, groceries, month('2026-11'), euros(250))
    })
    expect(store.state.workbook!.budgets).toHaveLength(3)
    expect(store.state.workbook!.problems).toEqual([])
  })

  it('refuses a limit on an income category', async () => {
    const store = await spendingStore()

    await expect(store.write('Set', (unit) => setLimit(unit, store.state.records!, category('Income/Salary').id, month('2026-09'), euros(100)))).rejects.toThrow(
      'is on a category that is not spending',
    )
  })
})
