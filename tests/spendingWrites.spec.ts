import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { accountBalance } from '../src/apps/spending/accounts/domain/accountBalance'
import { ACCOUNT_WRITES } from '../src/apps/spending/accounts/application/accountWrites'
import { setLimit } from '../src/apps/spending/budgets/application/budgetWrites'
import { CATEGORY_WRITES, deleteInto } from '../src/apps/spending/categories/application/categoryWrites'
import { TRANSACTION_WRITES, newEntry, newTransfer, deleteComesBack, removeEntry, retypedEntry, transferOver } from '../src/apps/spending/entries/application/entryWrites'
import { fileRow, joinWithTyped, notAPair, pairRows, writeDryRun, writeRulesInto } from '../src/apps/spending/statements/application/statementWrites'
import { reviewCount, reviewQueue } from '../src/apps/spending/statements/domain/reviewQueue'
import { statementDryRun } from '../src/apps/spending/statements/domain/statementDryRun'
import { codecOfSpendingKind } from '../src/apps/spending/workbook/application/spendingCodecs'
import type { SpendingBooks } from '../src/apps/spending/workbook/domain/spendingBooks'
import { ACCOUNT_RECORDS, CATEGORY_RECORDS } from '../src/apps/spending/workbook/domain/spendingKinds'
import { spendingDocumentOf } from '../src/apps/spending/workbook/infrastructure/spendingDocument'
import type { WorkbookStore } from '../src/shared/storage/application/createWorkbookStore'
import type { RecordKind } from '../src/shared/storage/domain/recordKind'
import { recordsChangeInWords } from '../src/shared/storage/presentation/recordsChangeInWords'
import { accountMoneyFromAmount } from '../src/shared/money/accountMoney'
import { moneyFromAmount } from '../src/shared/money/money'
import { civil, month } from './fixtures/ledger'
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
  return newTransfer(
    { account: OTP.id, amount: accountMoneyFromAmount(amount) },
    { account: into.id, amount: accountMoneyFromAmount(received) },
    { date: civil('2026-10-03'), payee: ' Top-up ', note: '', category: BETWEEN.id },
  )
}

function coffee(date: string, amount: number) {
  return newEntry({ account: OTP.id, date: civil(date), amount: accountMoneyFromAmount(amount), payee: ' Café on the square ', category: category('Food/Coffee').id, note: '' })
}

describe('Spending writes', () => {
  it('keeps a typed entry with its text trimmed', async () => {
    const store = await spendingStore()

    await store.write('Added', (unit) => unit.of(TRANSACTION_WRITES).add(coffee('2026-10-16', -3.5)))

    expect(store.state.workbook!.transactions).toMatchObject([{ payee: 'Café on the square', source: 'typed', pair: null, amount: accountMoneyFromAmount(-3.5) }])
    expect(store.state.workbook!.problems).toEqual([])
  })

  it("writes a transfer's two legs in one write, each naming the other, out of one account and into the other", async () => {
    const store = await spendingStore()
    const [out, into] = topUp()

    await store.write('Added', (unit) => [out, into].forEach((leg) => unit.of(TRANSACTION_WRITES).add(leg)))

    expect(store.state.writes).toHaveLength(1)
    expect(store.state.workbook!.problems).toEqual([])
    expect(store.state.workbook!.transactions.map((leg) => [leg.account, leg.amount, leg.payee, leg.pair])).toEqual([
      [OTP.id, accountMoneyFromAmount(-200), 'Top-up', into.id],
      [REVOLUT_EUR.id, accountMoneyFromAmount(200), 'Top-up', out.id],
    ])
    // OTP 1,550.00 − 200.00 and Revolut EUR 300.00 + 200.00.
    expect([OTP, REVOLUT_EUR].map((account) => accountBalance(account, store.state.workbook!.transactions, DAY))).toEqual([accountMoneyFromAmount(1_350), accountMoneyFromAmount(500)])
  })

  it('writes a transfer between two currencies with an amount on each side', async () => {
    const store = await spendingStore()

    await store.write('Added', (unit) => topUp(100, REVOLUT_USD, 108.5).forEach((leg) => unit.of(TRANSACTION_WRITES).add(leg)))

    expect([OTP, REVOLUT_USD].map((account) => accountBalance(account, store.state.workbook!.transactions, DAY))).toEqual([accountMoneyFromAmount(1_450), accountMoneyFromAmount(308.5)])
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

describe('a statement in the Spending file', () => {
  const rowOf = (payee: string, amount: number, date = '2026-10-20') => ({
    account: OTP.id,
    date: civil(date),
    amount: accountMoneyFromAmount(amount),
    payee,
    category: null,
    description: payee,
    counterpartyIban: '',
    importKey: `key-${payee}`,
    movedAt: '',
    pocket: false,
  })

  it('is one write: a new row, a filled typed row and a pair, and one Undo takes it all back', async () => {
    const store = await spendingStore()
    const typed = coffee('2026-10-19', -5)
    await store.write('Added', (unit) => unit.of(TRANSACTION_WRITES).add(typed))
    const before = store.state.workbook!.transactions
    const rows = [rowOf('CAFE', -5), rowOf('Shop', -7), { ...rowOf('To Revolut', -75), counterpartyIban: REVOLUT_EUR.iban }, { ...rowOf('Top-up', 75), account: REVOLUT_EUR.id }]
    const run = statementDryRun(store.state.workbook!, { label: 'export.csv', rows, notes: [] }, civil('2026-10-30'))

    const receipt = await store.write('Imported', (unit) => writeDryRun(unit, run))

    expect(store.state.workbook!.problems).toEqual([])
    expect(store.state.workbook!.transactions).toMatchObject([
      { id: typed.id, category: typed.category, importKey: 'key-CAFE', statement: 'export.csv', date: civil('2026-10-20') },
      { payee: 'Shop', category: null, source: 'statement', importKey: 'key-Shop' },
      { payee: 'To Revolut', category: BETWEEN.id },
      { payee: 'Top-up', category: BETWEEN.id },
    ])
    const [, , out, into] = store.state.workbook!.transactions
    expect([out?.pair, into?.pair]).toEqual([into?.id, out?.id])

    await store.undo(store.state.writes.find((write) => write.receipt === receipt)!)

    expect(store.state.workbook!.transactions).toEqual(before)
  })

  /** The file after an import of a transfer's two legs and one more row. */
  async function withAPair(): Promise<WorkbookStore<SpendingBooks>> {
    const store = await spendingStore()
    const rows = [
      { ...rowOf('To Revolut', -75), counterpartyIban: REVOLUT_EUR.iban },
      { ...rowOf('Top-up', 75), account: REVOLUT_EUR.id },
    ]
    const run = statementDryRun(store.state.workbook!, { label: 'export.csv', rows, notes: [] }, civil('2026-10-30'))
    await store.write('Imported', (unit) => writeDryRun(unit, run))
    return store
  }

  it('Not a pair clears both legs in one write, and one Undo puts the pair back', async () => {
    const store = await withAPair()
    const before = store.state.workbook!.transactions
    const [pair] = reviewQueue(store.state.workbook!, civil('2026-10-30')).pairs

    const receipt = await store.write('Not a pair', (unit) => notAPair(unit, pair!))

    expect(store.state.workbook!.problems).toEqual([])
    expect(store.state.workbook!.transactions).toMatchObject([
      { pair: null, category: null, categorisedBy: 'person' },
      { pair: null, category: null, categorisedBy: 'person' },
    ])
    await store.undo(store.state.writes.find((write) => write.receipt === receipt)!)
    expect(store.state.workbook!.transactions).toEqual(before)
  })

  it('pairs two offered rows through the store, and they read as a pair', async () => {
    const store = await spendingStore()
    const rows = [rowOf('Card top-up', -60), { ...rowOf('Top-up', 60), account: REVOLUT_EUR.id }]
    const run = statementDryRun(store.state.workbook!, { label: 'export.csv', rows, notes: [] }, civil('2026-10-30'))
    await store.write('Imported', (unit) => writeDryRun(unit, run))
    const offered = reviewQueue(store.state.workbook!, civil('2026-10-30')).waiting[0]!.maybeTransfer!

    await store.write('Paired', (unit) => pairRows(unit, offered, BETWEEN.id))

    expect(store.state.workbook!.problems).toEqual([])
    expect(reviewQueue(store.state.workbook!, civil('2026-10-30')).pairs).toHaveLength(1)
    expect(reviewCount(store.state.workbook!)).toBe(0)
  })

  it('joins a near bank row with the typed one through the store, and one Undo puts both back', async () => {
    const store = await spendingStore()
    const typed = coffee('2026-10-19', -5)
    await store.write('Added', (unit) => unit.of(TRANSACTION_WRITES).add(typed))
    const run = statementDryRun(store.state.workbook!, { label: 'export.csv', rows: [rowOf('CAFE', -5.2)], notes: [] }, civil('2026-10-30'))
    await store.write('Imported', (unit) => writeDryRun(unit, run))
    const before = store.state.workbook!.transactions
    const near = reviewQueue(store.state.workbook!, civil('2026-10-30')).waiting[0]!.maybeTyped!

    const receipt = await store.write('Joined', (unit) => joinWithTyped(unit, near.typed, near.bank, []))

    expect(store.state.workbook!.transactions).toMatchObject([{ id: typed.id, amount: accountMoneyFromAmount(-5.2), importKey: 'key-CAFE', category: typed.category }])
    await store.undo(store.state.writes.find((write) => write.receipt === receipt)!)
    expect(byId(store.state.workbook!.transactions)).toEqual(byId(before))
  })

  it('keeps a typed leg sent back to review, with no offer to join it with itself', async () => {
    const store = await spendingStore()
    const run = statementDryRun(store.state.workbook!, { label: 'export.csv', rows: [rowOf('Shop', -30)], notes: [] }, civil('2026-10-30'))
    await store.write('Imported', (unit) => writeDryRun(unit, run))
    const [bank] = store.state.workbook!.transactions
    const { kept, added } = transferOver(bank!, topUp(30))
    await store.write('Turned into a transfer', (unit) => {
      unit.of(TRANSACTION_WRITES).change(bank!, kept)
      unit.of(TRANSACTION_WRITES).add(added)
    })

    const [pair] = reviewQueue(store.state.workbook!, civil('2026-10-30')).pairs
    await store.write('Not a pair', (unit) => notAPair(unit, pair!))

    const typedLeg = reviewQueue(store.state.workbook!, civil('2026-10-30')).waiting.find(({ row }) => row.source === 'typed')!
    expect(typedLeg.maybeTyped).toBeNull()
    expect(store.state.workbook!.transactions).toHaveLength(2)
  })

  it('turns money in into a transfer with its sign and its bank facts, the new leg being money out', () => {
    const credit = { ...coffee('2026-10-19', 75), account: REVOLUT_EUR.id, importKey: 'kept', source: 'statement' as const }
    const { kept, added } = transferOver(credit, topUp(75))

    expect(kept).toMatchObject({ id: credit.id, amount: accountMoneyFromAmount(75), account: REVOLUT_EUR.id, importKey: 'kept', pair: added.id, category: BETWEEN.id })
    expect(added).toMatchObject({ amount: accountMoneyFromAmount(-75), account: OTP.id, pair: credit.id })
  })

  it('refuses to move a row a statement brought to another account, since the next export would bring it again', async () => {
    const store = await spendingStore()
    const run = statementDryRun(store.state.workbook!, { label: 'export.csv', rows: [rowOf('Shop', -5)], notes: [] }, civil('2026-10-30'))
    await store.write('Imported', (unit) => writeDryRun(unit, run))
    const [row] = store.state.workbook!.transactions

    await expect(store.write('Moved', (unit) => unit.of(TRANSACTION_WRITES).change(row!, { ...row!, account: REVOLUT_EUR.id }))).rejects.toThrow('stays on its account')
    await store.write('Changed', (unit) => unit.of(TRANSACTION_WRITES).change(row!, { ...row!, note: 'Mine' }))
    expect(store.state.workbook!.transactions).toMatchObject([{ account: OTP.id, note: 'Mine' }])
  })

  it('files a refund under a spending category through the store, where it counts against spending', async () => {
    const store = await spendingStore()
    const run = statementDryRun(store.state.workbook!, { label: 'export.csv', rows: [rowOf('Shop refund', 40)], notes: [] }, civil('2026-10-30'))
    await store.write('Imported', (unit) => writeDryRun(unit, run))
    const [row] = store.state.workbook!.transactions

    await store.write('Filed', (unit) => fileRow(unit, row!, category('Personal/Clothes and shoes')))

    expect(store.state.workbook!.transactions).toMatchObject([{ amount: accountMoneyFromAmount(40), category: category('Personal/Clothes and shoes').id, categorisedBy: 'person' }])
  })

  it('says a deleted statement row comes back, and it does on the next overlapping export, while a typed row does not', async () => {
    const store = await spendingStore()
    const statement = { label: 'export.csv', rows: [rowOf('Shop', -5)], notes: [] }
    await store.write('Imported', (unit) => writeDryRun(unit, statementDryRun(store.state.workbook!, statement, civil('2026-10-30'))))
    const [row] = store.state.workbook!.transactions

    expect(deleteComesBack([row!])).toBe(true)
    expect(deleteComesBack([coffee('2026-10-19', -5)])).toBe(false)
    expect(deleteComesBack([coffee('2026-10-19', -5), row!])).toBe(true)

    await store.write('Deleted', (unit) => removeEntry(unit, store.state.records!, row!))
    expect(statementDryRun(store.state.workbook!, statement, civil('2026-10-30'))).toMatchObject({ newRows: 1, alreadyIn: 0 })
  })

  it('undoes a first import of thousands of rows in seconds, not minutes', async () => {
    const store = await spendingStore()
    const rows = Array.from({ length: 4_300 }, (_, place) => ({ ...rowOf(`Shop ${place}`, -1 - place / 100, `2026-10-${String((place % 28) + 1).padStart(2, '0')}`) }))
    const run = statementDryRun(store.state.workbook!, { label: 'export.csv', rows, notes: [] }, civil('2026-10-30'))
    const receipt = await store.write('Imported', (unit) => writeDryRun(unit, run))
    const started = performance.now()

    await store.undo(store.state.writes.find((write) => write.receipt === receipt)!)

    expect(store.state.workbook!.transactions).toEqual([])
    expect(performance.now() - started).toBeLessThan(15_000)
  }, 120_000)

  it('keeps what the bank said on a row you retype, so a later statement still skips it, and marks a changed category as yours', () => {
    const filed = { ...coffee('2026-10-19', -5), importKey: 'kept', description: 'CAFE 12', statement: 'export.csv', source: 'statement' as const, categorisedBy: 'rule' as const }
    const typedSame = newEntry({ account: OTP.id, date: civil('2026-10-20'), amount: accountMoneyFromAmount(-6), payee: 'Coffee', category: filed.category, note: '' })
    const typedOther = newEntry({ account: OTP.id, date: civil('2026-10-20'), amount: accountMoneyFromAmount(-6), payee: 'Coffee', category: category('Food/Groceries').id, note: '' })

    expect(retypedEntry(filed, typedSame)).toMatchObject({
      id: filed.id,
      source: 'statement',
      importKey: 'kept',
      description: 'CAFE 12',
      statement: 'export.csv',
      amount: accountMoneyFromAmount(-6),
      categorisedBy: 'rule',
    })
    expect(retypedEntry(filed, typedOther)).toMatchObject({ importKey: 'kept', categorisedBy: 'person' })
  })

  it('makes a rule and files the rows waiting in one write', async () => {
    const store = await spendingStore()
    const run = statementDryRun(store.state.workbook!, { label: 'export.csv', rows: [rowOf('Shop', -7)], notes: [] }, civil('2026-10-30'))
    await store.write('Imported', (unit) => writeDryRun(unit, run))

    await store.write('Rule', (unit) => writeRulesInto(unit, store.state.workbook!, [{ column: 'counterparty_contains', fragment: 'shop' }], category('Food/Groceries').id))

    expect(store.state.workbook!.rules).toMatchObject([{ order: 1, category: category('Food/Groceries').id }])
    expect(store.state.workbook!.transactions).toMatchObject([{ category: category('Food/Groceries').id, categorisedBy: 'rule' }])
  })

  it('moves a rule with its category when that is deleted into another, and one Undo puts it back', async () => {
    const store = await spendingStore()
    await store.write('Rule', (unit) => writeRulesInto(unit, store.state.workbook!, [{ column: 'counterparty_contains', fragment: 'Shop' }], category('Food/Groceries').id))

    const receipt = await store.write('Deleted', (unit) => deleteInto(unit, store.state.records!, category('Food/Groceries'), category('Food/Restaurants')))

    expect(store.state.workbook!.rules).toMatchObject([{ category: category('Food/Restaurants').id }])
    await store.undo(store.state.writes.find((write) => write.receipt === receipt)!)
    expect(store.state.workbook!.rules).toMatchObject([{ category: category('Food/Groceries').id }])
  })

  it('refuses to delete a category a rule names, which delete-into moves first', async () => {
    const store = await spendingStore()
    await store.write('Rule', (unit) => writeRulesInto(unit, store.state.workbook!, [{ column: 'counterparty_contains', fragment: 'Shop' }], category('Food/Groceries').id))

    await expect(store.write('Deleted', (unit) => unit.of(CATEGORY_WRITES).remove(category('Food/Groceries')))).rejects.toThrow()
  })
})

describe('Spending account writes', () => {
  it('keeps an account that opened overdrawn at −€300.00, and a rename leaves its opening as it is', async () => {
    const overdrawn = { ...OTP, opening: accountMoneyFromAmount(-300) }
    const document = spendingDocumentOf('2026-11-04T09:00:00.000Z', { ...stored(ACCOUNT_RECORDS, [overdrawn, REVOLUT_EUR]), ...stored(CATEGORY_RECORDS, CATEGORIES) })
    const { store } = await browserHarness(used, document, SPENDING)

    await store.write('Renamed', (unit) => unit.of(ACCOUNT_WRITES).change(overdrawn, { ...overdrawn, name: 'OTP current, overdraft' }))

    expect(store.state.workbook!.problems).toEqual([])
    expect(store.state.workbook!.accounts.find((account) => account.id === OTP.id)).toMatchObject({ name: 'OTP current, overdraft', opening: accountMoneyFromAmount(-300) })
    expect(accountBalance(store.state.workbook!.accounts[0]!, [], DAY)).toEqual(accountMoneyFromAmount(-300))
  })

  it('refuses a new currency on an account its entries name, and allows it on one without entries', async () => {
    const store = await spendingStore()
    await store.write('Added', (unit) =>
      unit
        .of(TRANSACTION_WRITES)
        .add(newEntry({ account: REVOLUT_USD.id, date: civil('2026-10-10'), amount: accountMoneyFromAmount(-30), payee: 'Diner', category: category('Food/Restaurants').id, note: '' })),
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
    const shopping = (date: string, amount: number) =>
      newEntry({ account: OTP.id, date: civil(date), amount: accountMoneyFromAmount(amount), payee: 'Corner market', category: groceries.id, note: '' })
    await store.write('Added', (unit) => {
      unit.of(TRANSACTION_WRITES).add(shopping('2026-10-12', -45.3))
      unit.of(TRANSACTION_WRITES).add(shopping('2026-10-19', -60))
      setLimit(unit, store.state.records!, restaurants.id, month('2026-01'), moneyFromAmount(100))
      setLimit(unit, store.state.records!, groceries.id, month('2026-09'), moneyFromAmount(300))
    })
    const before = store.state.workbook!

    await store.write('Deleted', (unit) => deleteInto(unit, store.state.records!, groceries, restaurants))

    const after = store.state.workbook!
    expect(after.problems).toEqual([])
    expect(after.categories.map((held) => held.id)).not.toContain(groceries.id)
    expect(after.transactions.map((entry) => entry.category)).toEqual([restaurants.id, restaurants.id])
    expect(after.budgets.map((limit) => [limit.category, limit.from, limit.amount])).toEqual([[restaurants.id, '2026-01', moneyFromAmount(100)]])
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

    await store.write('Set', (unit) => setLimit(unit, store.state.records!, food, month('2026-09'), moneyFromAmount(400)))
    await store.write('Set', (unit) => setLimit(unit, store.state.records!, food, month('2026-09'), moneyFromAmount(450)))
    await store.write('Set', (unit) => setLimit(unit, store.state.records!, food, month('2026-12'), moneyFromAmount(0)))

    expect(store.state.workbook!.budgets.map((limit) => [limit.from, limit.amount])).toEqual([
      ['2026-09', moneyFromAmount(450)],
      ['2026-12', moneyFromAmount(0)],
    ])
  })

  it('refuses a limit on a child while its group has one in the same months, and takes it once the group’s has ended', async () => {
    const store = await spendingStore()
    const [food, groceries] = [category('Food').id, category('Food/Groceries').id]
    await store.write('Set', (unit) => setLimit(unit, store.state.records!, food, month('2026-09'), moneyFromAmount(400)))

    await expect(store.write('Set', (unit) => setLimit(unit, store.state.records!, groceries, month('2026-10'), moneyFromAmount(250)))).rejects.toThrow(
      'is on a group and on one of its children in the same months',
    )

    await store.write('Set', (unit) => {
      setLimit(unit, store.state.records!, food, month('2026-11'), moneyFromAmount(0))
      setLimit(unit, store.state.records!, groceries, month('2026-11'), moneyFromAmount(250))
    })
    expect(store.state.workbook!.budgets).toHaveLength(3)
    expect(store.state.workbook!.problems).toEqual([])
  })

  it('refuses a limit on an income category', async () => {
    const store = await spendingStore()

    await expect(store.write('Set', (unit) => setLimit(unit, store.state.records!, category('Income/Salary').id, month('2026-09'), moneyFromAmount(100)))).rejects.toThrow(
      'is on a category that is not spending',
    )
  })
})
