import { starterCategories } from '../../../categories/domain/starterCategories'
import { accountBalance } from '../../../accounts/domain/accountBalance'
import { codecOfSpendingKind } from '../../application/spendingCodecs'
import type { Account } from '../../domain/account'
import type { Budget } from '../../domain/budget'
import type { Category } from '../../domain/category'
import { ACCOUNT_RECORDS, BUDGET_RECORDS, CATEGORY_RECORDS, RULE_RECORDS, TRANSACTION_RECORDS } from '../../domain/spendingKinds'
import type { SpendingRule } from '../../domain/spendingRule'
import { NO_BANK_FACTS } from '../../domain/transaction'
import type { Transaction } from '../../domain/transaction'
import { spendingDocumentOf } from '../spendingDocument'
import { revolutStatement } from '../../../statements/domain/revolutStatement'
import { sampleRevolutRows } from '../../../statements/infrastructure/fake/sampleRevolutFiles'
import { addDays, parseCivilDate, today } from '../../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../../shared/calendar/civilDate'
import { addMonths, firstDayOf, monthOf } from '../../../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../../../shared/calendar/monthKey'
import { EURO, currencyCodeOf } from '../../../../../shared/money/currencyCode'
import { moneyFromAmount, subtractMoney } from '../../../../../shared/money/money'
import { recordIdOf } from '../../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../../shared/storage/domain/recordId'
import type { RecordKind } from '../../../../../shared/storage/domain/recordKind'
import type { WorkbookDocument } from '../../../../../shared/storage/infrastructure/documentFormat'
import { language } from '../../../../../shared/text/language'

/**
 * The fake build's Spending sets: `sample` the worked example's four accounts with three months of rows up to the day,
 * Food's limit carrying from two months back and a transfer pair, `foreign` only the dollar account, `over` the
 * sample with two limits overspent, and `statements` the sample with rows of earlier statements waiting on review, a pair,
 * a lone leg, a rule, and typed rows the sample Revolut export pairs with. Each figure is made up.
 */
export type FakeSpendingSet = 'sample' | 'foreign' | 'over' | 'statements'

const USD = currencyCodeOf('USD')!

/** A key per record, so every load of a set holds the same records. Categories take theirs from 1, the rest from 1001. */
function fixedKey(place: number): string {
  return `fa4e3000-0000-4000-8000-${String(place).padStart(12, '0')}`
}

function fixedId(kind: RecordKind, place: number): RecordId {
  return recordIdOf(kind, fixedKey(place))
}

/** The starter categories with fixed keys, named in the language on screen, and each one's id by its English group and name. */
function fakeCategories(): { readonly categories: readonly Category[]; readonly idOf: (path: string) => RecordId } {
  const keys = (): (() => string) => {
    let place = 0
    return () => fixedKey((place += 1))
  }
  const english = starterCategories('en', keys())
  const groups = new Map(english.filter((category) => category.parent === null).map((category) => [category.id, category.name]))
  const ids = new Map(english.map((category) => [category.parent === null ? category.name : `${groups.get(category.parent)}/${category.name}`, category.id]))
  return { categories: starterCategories(language, keys()), idOf: (path) => ids.get(path) ?? missing(path) }
}

function missing(path: string): never {
  throw new Error(`The starter categories have no ${path}.`)
}

/** A day of the month, or the day itself while the month has not reached it, so no row is after the day. */
function dayIn(month: MonthKey, dayOfTheMonth: number, day: CivilDate): CivilDate {
  const date = parseCivilDate(`${month}-${String(dayOfTheMonth).padStart(2, '0')}`)!
  return date > day ? day : date
}

interface Row {
  readonly account: RecordId
  readonly date: CivilDate
  readonly amount: number
  readonly payee: string
  readonly category: string
}

const OTP = fixedId(ACCOUNT_RECORDS, 1001)
const REVOLUT_EUR = fixedId(ACCOUNT_RECORDS, 1002)
const REVOLUT_USD = fixedId(ACCOUNT_RECORDS, 1003)
const CASH = fixedId(ACCOUNT_RECORDS, 1004)

/** What each account holds on the day, as the worked example has it. */
const BALANCES: Readonly<Record<string, number>> = { [OTP]: 1_850, [REVOLUT_EUR]: 320.5, [REVOLUT_USD]: 170, [CASH]: 64 }

/** The rows of a complete month `back` months before the day's: salary, rent, food, fuel, a loan instalment, money saved and a company cost paid back. */
function monthRows(month: MonthKey, back: number, day: CivilDate): Row[] {
  const on = (dayOfTheMonth: number): CivilDate => dayIn(month, dayOfTheMonth, day)
  const food = back === 2 ? { groceries: -220, restaurants: -90, coffee: -40, delivery: 0 } : { groceries: -260, restaurants: -150, coffee: -40, delivery: -30 }
  return [
    { account: OTP, date: on(1), amount: -600, payee: 'Landlord', category: 'Home/Rent' },
    { account: OTP, date: on(5), amount: -118.4, payee: 'City utilities', category: 'Home/Utilities' },
    { account: OTP, date: on(10), amount: 2_400, payee: 'Example Studio d.o.o.', category: 'Income/Salary' },
    { account: OTP, date: on(12), amount: food.groceries, payee: 'Corner market', category: 'Food/Groceries' },
    { account: REVOLUT_EUR, date: on(14), amount: food.restaurants, payee: 'Harbour bistro', category: 'Food/Restaurants' },
    { account: CASH, date: on(16), amount: food.coffee, payee: 'Café on the square', category: 'Food/Coffee' },
    ...(food.delivery === 0 ? [] : [{ account: REVOLUT_EUR, date: on(18), amount: food.delivery, payee: 'Food delivery', category: 'Food/Delivery' }]),
    { account: REVOLUT_EUR, date: on(20), amount: -80, payee: 'Fuel station', category: 'Transport/Fuel' },
    { account: OTP, date: on(15), amount: -650, payee: 'Example Bank', category: 'Money and fees/Loan instalments' },
    { account: OTP, date: on(25), amount: -300, payee: 'Example Broker', category: 'Saved to investments' },
    { account: REVOLUT_EUR, date: on(22), amount: -45, payee: 'Office supplies shop', category: 'For the company' },
    { account: OTP, date: on(28), amount: 45, payee: 'Example Studio d.o.o.', category: 'For the company' },
  ]
}

/** The month of the day so far: rent, a shop and a coffee on its first day. */
function monthSoFar(month: MonthKey): Row[] {
  const first = firstDayOf(month)
  return [
    { account: OTP, date: first, amount: -600, payee: 'Landlord', category: 'Home/Rent' },
    { account: OTP, date: first, amount: -45.3, payee: 'Corner market', category: 'Food/Groceries' },
    { account: CASH, date: first, amount: -3.5, payee: 'Café on the square', category: 'Food/Coffee' },
  ]
}

/** The made-up dollar row of the worked example, spent abroad last month. */
function dollarRows(month: MonthKey, day: CivilDate): Row[] {
  return [{ account: REVOLUT_USD, date: dayIn(month, 10, day), amount: -30, payee: 'Diner in Boston', category: 'Travel/On the trip' }]
}

const REVOLUT_IBAN = 'LT000000000000000001'
const PHARMACY_IBAN = 'HR1100000000000000099'

/** A row an earlier statement brought, on no category unless it says so. */
function statementRow(place: number, account: RecordId, date: CivilDate, amount: number, payee: string, fields: Partial<Transaction> = {}): Transaction {
  return {
    ...NO_BANK_FACTS,
    id: fixedId(TRANSACTION_RECORDS, place),
    account,
    date,
    amount: moneyFromAmount(amount),
    payee,
    category: null,
    note: '',
    source: 'statement',
    pair: null,
    description: payee,
    importKey: `earlier-${place}`,
    statement: 'earlier-statement.csv',
    categorisedBy: null,
    ...fields,
  }
}

/**
 * What the statements set adds to the sample: rows of earlier statements, and typed rows. The Harbour bistro row is the
 * one the sample export repeats, so it takes its key from there.
 */
function earlierStatementRows(day: CivilDate, idOf: (path: string) => RecordId, categories: readonly Category[], accounts: readonly Account[]): readonly Transaction[] {
  const back = (days: number): CivilDate => addDays(day, -days)
  const between = idOf('Between my accounts')
  const read = revolutStatement(sampleRevolutRows(day), 'earlier-statement.csv', { accounts, categories })
  const bistroKey = 'statement' in read ? (read.statement.rows.find((row) => row.payee === 'Harbour bistro')?.importKey ?? '') : ''
  const [paidOut, paidIn] = [fixedId(TRANSACTION_RECORDS, 1703), fixedId(TRANSACTION_RECORDS, 1704)]
  const typed = (place: number, account: RecordId, date: CivilDate, amount: number, payee: string, category: string): Transaction => ({
    ...NO_BANK_FACTS,
    id: fixedId(TRANSACTION_RECORDS, place),
    account,
    date,
    amount: moneyFromAmount(amount),
    payee,
    category: idOf(category),
    note: '',
    source: 'typed',
    pair: null,
    categorisedBy: 'person',
  })
  return [
    typed(1701, REVOLUT_EUR, back(3), -4.2, 'Café on the square', 'Food/Coffee'),
    typed(1702, REVOLUT_EUR, back(6), -25, 'Bookshop', 'Leisure/Hobbies'),
    statementRow(1703, OTP, back(12), -150, 'Transfer to Revolut', { category: between, pair: paidIn, counterpartyIban: REVOLUT_IBAN }),
    statementRow(1704, REVOLUT_EUR, back(12), 150, 'Top-up from OTP', { category: between, pair: paidOut }),
    statementRow(1705, REVOLUT_EUR, back(10), -32, 'Harbour bistro', { category: idOf('Food/Restaurants'), categorisedBy: 'person', importKey: bistroKey }),
    statementRow(1706, OTP, back(14), -22.4, 'Corner market', { category: idOf('Food/Groceries'), categorisedBy: 'rule' }),
    statementRow(1707, OTP, back(9), -12, 'City pharmacy', { counterpartyIban: PHARMACY_IBAN }),
    statementRow(1708, OTP, back(8), -60, 'Card top-up'),
    statementRow(1709, REVOLUT_EUR, back(7), 60, 'Top-up by card'),
    statementRow(1710, REVOLUT_EUR, back(5), -26.5, 'Old Town Bookshop'),
    statementRow(1711, OTP, back(4), -18.9, 'City pharmacy', { counterpartyIban: PHARMACY_IBAN }),
    statementRow(1713, REVOLUT_EUR, back(3), -15, 'Pocket Winter coat', { category: between, movedAt: `${back(3)} 09:30:00`, pocket: true }),
    statementRow(1712, OTP, back(2), -75, 'Transfer to Revolut', { category: between, counterpartyIban: REVOLUT_IBAN }),
  ]
}

export function fakeSpendingDocument(savedAt: string, set: FakeSpendingSet = 'sample', day: CivilDate = today()): WorkbookDocument {
  const { categories, idOf } = fakeCategories()
  const month = monthOf(day)
  const [twoBack, oneBack] = [addMonths(month, -2), addMonths(month, -1)]
  const openedOn = firstDayOf(addMonths(month, -3))
  const accounts: readonly Account[] = [
    { id: OTP, name: 'OTP current', kind: 'bank', bank: 'otp', currency: EURO, opening: moneyFromAmount(0), openedOn, iban: 'HR0000000000000000001', closed: false },
    { id: REVOLUT_EUR, name: 'Revolut EUR', kind: 'bank', bank: 'revolut', currency: EURO, opening: moneyFromAmount(0), openedOn, iban: 'LT000000000000000001', closed: false },
    { id: REVOLUT_USD, name: 'Revolut USD', kind: 'bank', bank: 'revolut', currency: USD, opening: moneyFromAmount(0), openedOn, iban: 'LT000000000000000001', closed: false },
    { id: CASH, name: 'Cash', kind: 'cash', bank: null, currency: EURO, opening: moneyFromAmount(0), openedOn, iban: '', closed: false },
  ]
  const shown = set === 'foreign' ? accounts.filter((account) => account.id === REVOLUT_USD) : accounts
  const rows: Row[] = set === 'foreign' ? dollarRows(oneBack, day) : [...monthRows(twoBack, 2, day), ...monthRows(oneBack, 1, day), ...monthSoFar(month), ...dollarRows(oneBack, day)]
  let place = 1100
  const transactions: Transaction[] = rows.map((row) => ({
    id: fixedId(TRANSACTION_RECORDS, (place += 1)),
    account: row.account,
    date: row.date,
    amount: moneyFromAmount(row.amount),
    payee: row.payee,
    category: idOf(row.category),
    note: '',
    source: 'typed',
    pair: null,
    ...NO_BANK_FACTS,
    categorisedBy: null,
  }))
  if (set === 'statements') transactions.push(...earlierStatementRows(day, idOf, categories, accounts))
  if (set !== 'foreign') {
    const [out, into] = [fixedId(TRANSACTION_RECORDS, 1501), fixedId(TRANSACTION_RECORDS, 1502)]
    const date = dayIn(oneBack, 3, day)
    const between = idOf('Between my accounts')
    transactions.push(
      { ...NO_BANK_FACTS, id: out, account: OTP, date, amount: moneyFromAmount(-200), payee: 'Top-up', category: between, note: '', source: 'typed', pair: into, categorisedBy: null },
      { ...NO_BANK_FACTS, id: into, account: REVOLUT_EUR, date, amount: moneyFromAmount(200), payee: 'Top-up', category: between, note: '', source: 'typed', pair: out, categorisedBy: null },
    )
  }
  // Each account opens with what makes its balance on the day the worked example's.
  const opened = shown.map((account) => ({ ...account, opening: subtractMoney(moneyFromAmount(BALANCES[account.id]!), accountBalance(account, transactions, day)) }))
  const budgets: Budget[] =
    set === 'foreign'
      ? []
      : set === 'over'
        ? [
            { id: fixedId(BUDGET_RECORDS, 1601), category: idOf('Food'), from: twoBack, amount: moneyFromAmount(300) },
            { id: fixedId(BUDGET_RECORDS, 1602), category: idOf('Transport'), from: twoBack, amount: moneyFromAmount(50) },
          ]
        : [{ id: fixedId(BUDGET_RECORDS, 1601), category: idOf('Food'), from: twoBack, amount: moneyFromAmount(400) }]
  return spendingDocumentOf(savedAt, {
    ...stored(ACCOUNT_RECORDS, opened),
    ...stored(CATEGORY_RECORDS, categories),
    ...stored(TRANSACTION_RECORDS, transactions),
    ...stored(BUDGET_RECORDS, budgets),
    ...stored(RULE_RECORDS, set === 'statements' ? fakeRules(idOf) : []),
  })
}

function fakeRules(idOf: (path: string) => RecordId): readonly SpendingRule[] {
  return [{ id: fixedId(RULE_RECORDS, 1801), order: 1, condition: { column: 'counterparty_contains', fragment: 'Corner market' }, category: idOf('Food/Groceries') }]
}

/** The starter categories alone, with fixed keys, as a new file on the fake Drive holds them. */
export function fakeStarterDocument(savedAt: string): WorkbookDocument {
  return spendingDocumentOf(savedAt, stored(CATEGORY_RECORDS, fakeCategories().categories))
}

function stored<R>(kind: RecordKind<R>, records: readonly R[]): WorkbookDocument['records'] {
  const codec = codecOfSpendingKind(kind)
  return { [kind.name]: records.map((record) => codec.fieldsOf(record)) }
}
