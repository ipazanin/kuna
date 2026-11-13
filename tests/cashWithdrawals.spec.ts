import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { ACCOUNT_WRITES } from '../src/apps/spending/accounts/application/accountWrites'
import { notAPair, notCash, writeCashLegs, writeDryRun, writeRulesInto } from '../src/apps/spending/statements/application/statementWrites'
import { reviewCount, reviewQueue } from '../src/apps/spending/statements/domain/reviewQueue'
import { decidingRule } from '../src/apps/spending/statements/domain/spendingCategorisation'
import type { StatementRow, StatementRows } from '../src/apps/spending/statements/domain/statementRows'
import { codecOfSpendingKind } from '../src/apps/spending/workbook/application/spendingCodecs'
import type { Account } from '../src/apps/spending/workbook/domain/account'
import type { SpendingBook } from '../src/apps/spending/workbook/domain/readSpendingBook'
import { RULE_CODEC } from '../src/apps/spending/workbook/domain/ruleReading'
import type { SpendingBooks } from '../src/apps/spending/workbook/domain/spendingBooks'
import { ACCOUNT_RECORDS, CATEGORY_RECORDS, RULE_RECORDS, TRANSACTION_RECORDS } from '../src/apps/spending/workbook/domain/spendingKinds'
import type { RuleWithdrawal, SpendingRule } from '../src/apps/spending/workbook/domain/spendingRule'
import { spendingSettingsOf } from '../src/apps/spending/workbook/domain/spendingSettings'
import type { StoredRow, Transaction } from '../src/apps/spending/workbook/domain/transaction'
import { SPENDING_DOCUMENT, spendingDocumentOf } from '../src/apps/spending/workbook/infrastructure/spendingDocument'
import { storedFieldsOfValues } from '../src/shared/storage/domain/storedFields'
import { accountMoneyFromAmount } from '../src/shared/money/accountMoney'
import type { WorkbookStore } from '../src/shared/storage/application/createWorkbookStore'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import type { RecordKind } from '../src/shared/storage/domain/recordKind'
import { civil } from './fixtures/ledger'
import { ACCOUNTS, CASH, CATEGORIES, OTP, REVOLUT_USD, USD, account, category, filedDryRun, filedRows, row, storedBeforeItems, wholeItems } from './fixtures/spending'
import { SPENDING, browserHarness, forgetCaches } from './fixtures/writeBack'

const DAY = civil('2026-10-30')
const BETWEEN = category('Between my accounts').id
const WALLET = account(5, {
  name: 'Wallet',
  kind: 'cash',
  bank: null,
  currency: CASH.currency,
  opening: accountMoneyFromAmount(0),
  openedOn: CASH.openedOn,
  rowsFrom: 'by-hand',
  iban: '',
  closed: false,
})
const DOLLARS = account(6, { name: 'Dollars', kind: 'cash', bank: null, currency: USD, opening: accountMoneyFromAmount(0), openedOn: CASH.openedOn, rowsFrom: 'by-hand', iban: '', closed: false })

function bookOf(transactions: readonly Transaction[], rules: readonly SpendingRule[] = [], accounts: readonly Account[] = ACCOUNTS): SpendingBook {
  return {
    accounts,
    categories: CATEGORIES,
    transactions,
    budgets: [],
    rules,
    receipts: [],
    items: wholeItems(transactions),
    held: [],
    settings: spendingSettingsOf([]),
    stored: storedBeforeItems(transactions),
    readings: {} as SpendingBook['readings'],
    problems: [],
  }
}

function bankomat(withdrawal: RuleWithdrawal | null = { cashAccount: null }, into = BETWEEN): SpendingRule {
  return { id: recordIdOf(RULE_RECORDS, 'rule-bankomat'), order: 1, condition: { column: 'counterparty_contains', fragment: 'Bankomat' }, category: into, withdrawal }
}

function statementRow(on: Account, amount: number, payee: string, fields: Partial<StatementRow> = {}): StatementRow {
  return {
    account: on.id,
    date: civil('2026-10-20'),
    amount: accountMoneyFromAmount(amount),
    payee,
    category: null,
    description: payee,
    counterpartyIban: '',
    importKey: `key-${payee}`,
    movedAt: '',
    pocket: false,
    cashWithdrawal: false,
    ...fields,
  }
}

const statementOf = (...rows: StatementRow[]): StatementRows => ({ label: 'export.csv', rows, notes: [] })

function counting(): () => string {
  let place = 0
  return () => `99000000-0000-4000-8000-${String((place += 1)).padStart(12, '0')}`
}

const onFile = (on: Account, amount: number, payee: string, fields: Partial<StoredRow> = {}) =>
  row(on, '2026-10-20', amount, null, { source: 'statement', payee, description: payee, importKey: `earlier-${payee}`, ...fields })

describe('a rule that spots cash taken out', () => {
  it('reads back as it was written, with or without the cash account it names', () => {
    for (const rule of [bankomat(), bankomat({ cashAccount: CASH.id }), bankomat(null)]) {
      expect(RULE_CODEC.make(storedFieldsOfValues(RULE_CODEC.fieldsOf(rule)), rule.id)).toEqual(rule)
    }
  })

  it('refuses a cash account named without the withdrawal it belongs to', () => {
    const { withdrawal: _flag, ...fields } = RULE_CODEC.fieldsOf(bankomat({ cashAccount: CASH.id }))

    expect(() => RULE_CODEC.make(storedFieldsOfValues(fields), bankomat().id)).toThrow('cash_account names where a withdrawal goes')
  })

  it('counts only into Between my accounts, and into a cash account or none', () => {
    const problems = (rule: SpendingRule) => {
      const document = spendingDocumentOf('2026-11-04T09:00:00.000Z', { ...stored(ACCOUNT_RECORDS, ACCOUNTS), ...stored(CATEGORY_RECORDS, CATEGORIES), ...stored(RULE_RECORDS, [rule]) })
      return SPENDING_DOCUMENT.read({ meta: META, revision: '1', document }).workbook.problems.map((problem) => problem.reason)
    }

    expect(problems(bankomat())).toEqual([])
    expect(problems(bankomat({ cashAccount: CASH.id }))).toEqual([])
    expect(problems(bankomat({ cashAccount: null }, category('Food/Groceries').id))).toEqual(['spots a cash withdrawal, so it files into Between my accounts'])
    expect(problems(bankomat({ cashAccount: OTP.id }))).toEqual(['names as the cash account one that is not a cash account in the file'])
  })

  it('holds only for money out, so a refund from the cash machine waits', () => {
    const ruleOf = decidingRule([bankomat()], bookOf([]))

    expect(ruleOf(statementRow(OTP, -50, 'Bankomat Ilica'))?.id).toBe(bankomat().id)
    expect(ruleOf(statementRow(OTP, 50, 'Bankomat Ilica'))).toBeNull()
  })
})

describe('the dry run of cash taken out', () => {
  it('pairs the row with the same money into the one cash account of its currency, under Between my accounts', () => {
    const run = filedDryRun(bookOf([], [bankomat()]), statementOf(statementRow(OTP, -50, 'Bankomat Ilica')), DAY, counting())
    const [debit, leg] = run.added

    expect(run.added).toHaveLength(2)
    expect(debit).toMatchObject({ account: OTP.id, category: BETWEEN, categorisedBy: null, pair: leg!.id })
    expect(leg).toMatchObject({ account: CASH.id, amount: accountMoneyFromAmount(50), date: civil('2026-10-20'), category: BETWEEN, source: 'typed', categorisedBy: null, pair: debit!.id })
    expect(run.newRows).toBe(1)
    expect(run.lines[0]).toMatchObject({ outcome: 'new', category: BETWEEN, withdrawal: { cashLeg: { id: leg!.id, account: CASH.id, pair: debit!.id } } })
  })

  it('leaves out a cash account opened after the day the cash was taken out', () => {
    const opensLater = { ...WALLET, openedOn: civil('2026-10-25') }
    const run = filedDryRun(bookOf([], [bankomat()], [...ACCOUNTS, opensLater]), statementOf(statementRow(OTP, -50, 'Bankomat Ilica')), DAY, counting())

    expect(run.added[1]).toMatchObject({ account: CASH.id })
  })

  it('takes the cash account the rule names over the others of the currency', () => {
    const run = filedDryRun(bookOf([], [bankomat({ cashAccount: WALLET.id })], [...ACCOUNTS, WALLET]), statementOf(statementRow(OTP, -50, 'Bankomat Ilica')), DAY, counting())

    expect(run.added[1]).toMatchObject({ account: WALLET.id })
  })

  it('reads a row the bank marks as cash taken out with no rule', () => {
    const run = filedDryRun(bookOf([]), statementOf(statementRow(OTP, -40, 'Cash at Ilica ATM', { cashWithdrawal: true })), DAY, counting())

    expect(run.added.map((added) => [added.account, added.amount, added.category])).toEqual([
      [OTP.id, accountMoneyFromAmount(-40), BETWEEN],
      [CASH.id, accountMoneyFromAmount(40), BETWEEN],
    ])
  })

  it.each([
    ['no cash account keeps its currency', ACCOUNTS, REVOLUT_USD],
    ['two cash accounts keep its currency', [...ACCOUNTS, WALLET], OTP],
  ])('files it under Between my accounts with no leg and a note when %s, so To review asks', (_case, accounts, on) => {
    const run = filedDryRun(bookOf([], [bankomat()], accounts), statementOf(statementRow(on, -50, 'Bankomat Ilica')), DAY, counting())

    expect(run.added).toMatchObject([{ category: BETWEEN, pair: null, categorisedBy: 'rule' }])
    expect(run.lines[0]).toMatchObject({ outcome: 'new', withdrawal: { cashLeg: null } })
    expect(run.notes).toEqual(['1 cash withdrawal counts as a transfer and waits on To review for its cash account.'])
    expect(reviewQueue(bookOf(run.added, [bankomat()], accounts), DAY).withdrawals.map(({ row: waiting }) => waiting.payee)).toEqual(['Bankomat Ilica'])
  })

  it('lets the cash withdrawal fill a typed transfer of the same money instead, so the cash is not counted twice', () => {
    const typed = row(OTP, '2026-10-19', -50, 'Between my accounts', { source: 'typed', categorisedBy: 'person', pair: recordIdOf(TRANSACTION_RECORDS, 'typed-in') })
    const run = filedDryRun(bookOf([typed], [bankomat()]), statementOf(statementRow(OTP, -50, 'Bankomat Ilica', { cashWithdrawal: true })), DAY, counting())

    expect(run).toMatchObject({ added: [], filled: 1 })
  })

  it('leaves a row that is not money out of a bank account alone, such as a fee or a deposit', () => {
    const run = filedDryRun(bookOf([], [bankomat()]), statementOf(statementRow(OTP, 50, 'Bankomat Ilica'), statementRow(CASH, -5, 'Bankomat coffee')), DAY, counting())

    expect(run.added.every((added) => added.pair === null)).toBe(true)
    expect(run.lines.every((line) => line.outcome !== 'new' || line.withdrawal === null)).toBe(true)
  })
})

describe('the withdrawals To review lists', () => {
  it('lists cash taken out already on the file with no cash leg, newest first, whatever its rule or the bank said', () => {
    const book = bookOf(
      [
        onFile(OTP, -50, 'Bankomat Ilica'),
        onFile(OTP, -100, 'Bankomat Trg', { category: BETWEEN, categorisedBy: 'rule' }),
        onFile(REVOLUT_USD, -60, 'Cash at Boston ATM', { category: BETWEEN, cashWithdrawal: true }),
      ],
      [bankomat()],
      [...ACCOUNTS, DOLLARS],
    )
    const { withdrawals, waiting } = reviewQueue(book, DAY)

    expect(withdrawals.map(({ row: listed, cashAccounts }) => [listed.payee, cashAccounts.map((cash) => cash.name)])).toEqual([
      ['Cash at Boston ATM', ['Dollars']],
      ['Bankomat Trg', ['Cash']],
      ['Bankomat Ilica', ['Cash']],
    ])
    expect(waiting).toEqual([])
    expect(reviewCount(book)).toBe(3)
  })

  it('leaves out a row a person filed elsewhere or said is no pair, one the reader filed, and one with its cash leg', () => {
    const book = bookOf(
      [
        onFile(OTP, -50, 'Bankomat Ilica', { category: category('Food/Groceries').id, categorisedBy: 'person' }),
        onFile(OTP, -50, 'Bankomat Trg', { categorisedBy: 'person' }),
        onFile(OTP, -2, 'Bankomat fee', { category: category('Money and fees/Bank fees').id }),
        onFile(OTP, -20, 'Bankomat Split', { category: BETWEEN, pair: recordIdOf(TRANSACTION_RECORDS, 'leg') }),
      ],
      [bankomat()],
    )

    expect(reviewQueue(book, DAY).withdrawals).toEqual([])
  })
})

const used = new Set<string>()
const META = { id: 'cash-spec', source: 'browser' as const, title: 'cash', syncedAt: '2026-11-04T09:00:00.000Z', lastExportedAt: null, unexportedSince: null }

afterEach(async () => {
  await forgetCaches(used)
})

function stored<R>(kind: RecordKind<R>, records: readonly R[]) {
  const codec = codecOfSpendingKind(kind)
  return { [kind.name]: records.map((record) => codec.fieldsOf(record)) }
}

async function storeWith(transactions: readonly Transaction[], rules: readonly SpendingRule[] = []): Promise<WorkbookStore<SpendingBooks>> {
  const document = spendingDocumentOf('2026-11-04T09:00:00.000Z', {
    ...stored(ACCOUNT_RECORDS, ACCOUNTS),
    ...stored(CATEGORY_RECORDS, CATEGORIES),
    ...stored(TRANSACTION_RECORDS, transactions),
    ...stored(RULE_RECORDS, rules),
  })
  const { store } = await browserHarness(used, document, SPENDING)
  return store
}

describe('cash legs written', () => {
  it('moves every withdrawal To review proposes to its cash account in one write, and one Undo takes them all back', async () => {
    const store = await storeWith([onFile(OTP, -50, 'Bankomat Ilica'), onFile(OTP, -100, 'Bankomat Trg', { category: BETWEEN, categorisedBy: 'rule' })], [bankomat()])
    const before = store.state.workbook!.transactions
    const proposed = reviewQueue(store.state.workbook!, DAY).withdrawals.map(({ row: listed, cashAccounts }) => ({ row: listed, cash: cashAccounts[0]! }))

    await store.write('Moved', (unit) => writeCashLegs(unit, store.state.records!, proposed, BETWEEN))

    const after = store.state.workbook!
    expect(after.problems).toEqual([])
    expect(after.transactions.filter((written) => written.account === CASH.id).map((leg) => leg.amount)).toEqual([accountMoneyFromAmount(100), accountMoneyFromAmount(50)])
    expect(reviewQueue(after, DAY).withdrawals).toEqual([])
    expect(reviewQueue(after, DAY).pairs).toHaveLength(2)

    await store.undo(store.state.writes.at(-1)!)
    expect(store.state.workbook!.transactions).toEqual(before)
  })

  it('leaves a row called no cash where it is filed and off the list, and one Undo lists it again', async () => {
    const store = await storeWith([onFile(OTP, -100, 'Bankomat Trg', { category: BETWEEN, categorisedBy: 'rule' }), onFile(OTP, -50, 'Bankomat Ilica')], [bankomat()])
    const [trg, ilica] = store.state.workbook!.transactions

    await store.write('Not cash', (unit) => notCash(unit, store.state.records!, trg!))
    const receipt = await store.write('Not cash', (unit) => notCash(unit, store.state.records!, ilica!))

    const after = store.state.workbook!
    expect(after.transactions).toMatchObject([
      { category: BETWEEN, categorisedBy: 'person', pair: null },
      { category: null, categorisedBy: 'person', pair: null },
    ])
    expect(reviewQueue(after, DAY).withdrawals).toEqual([])
    await store.undo(store.state.writes.find((write) => write.receipt === receipt)!)
    expect(reviewQueue(store.state.workbook!, DAY).withdrawals.map(({ row: listed }) => listed.payee)).toEqual(['Bankomat Ilica'])
  })

  it('writes an import with its cash leg in one write, and Not a pair takes the leg away and sends the row back to review', async () => {
    const store = await storeWith([], [bankomat()])
    await store.write('Imported', (unit) => writeDryRun(unit, store.state.records!, filedDryRun(store.state.workbook!, statementOf(statementRow(OTP, -50, 'Bankomat Ilica')), DAY)))
    expect(store.state.writes).toHaveLength(1)
    const [pair] = reviewQueue(store.state.workbook!, DAY).pairs

    await store.write('Not a pair', (unit) => notAPair(unit, store.state.records!, pair!))

    expect(filedRows(store.state.workbook!)).toMatchObject([{ account: OTP.id, category: null, pair: null, categorisedBy: 'person' }])
    expect(reviewQueue(store.state.workbook!, DAY).withdrawals).toEqual([])
  })

  it('saves a rule that spots cash taken out, and refuses an account change that would leave it naming no cash account', async () => {
    const store = await storeWith([])
    await store.write('Rule', (unit) => writeRulesInto(unit, store.state.workbook!, [{ column: 'counterparty_contains', fragment: 'Bankomat' }], BETWEEN, { cashAccount: CASH.id }))
    expect(store.state.workbook!.rules).toMatchObject([{ category: BETWEEN, withdrawal: { cashAccount: CASH.id } }])

    await expect(store.write('Kind', (unit) => unit.of(ACCOUNT_WRITES).change(CASH, { ...CASH, kind: 'bank' }))).rejects.toThrow('names as the cash account one that is not a cash account')
  })
})
