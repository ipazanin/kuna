import { starterCategories } from '../../../categories/domain/starterCategories'
import { accountBalance } from '../../../accounts/domain/accountBalance'
import { codecOfSpendingKind } from '../../application/spendingCodecs'
import { BY_HAND_SOURCES } from '../../domain/account'
import type { Account } from '../../domain/account'
import type { Category } from '../../domain/category'
import { BY_DAYS } from '../../domain/event'
import type { TransactionItem } from '../../domain/transactionItem'
import { ACCOUNT_RECORDS, CATEGORY_RECORDS, ITEM_RECORDS, LABEL_RECORDS, TRANSACTION_RECORDS } from '../../domain/spendingKinds'
import { wholeItemOf } from '../../domain/rowItems'
import { BLANK_CELLS, NO_BANK_FACTS, storedRowOf } from '../../domain/transaction'
import type { Transaction } from '../../domain/transaction'
import { spendingDocumentOf } from '../spendingDocument'
import type { Label } from '../../../../../shared/categorising/domain/labels'
import { parseCivilDate } from '../../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../../shared/calendar/civilDate'
import { addMonths, firstDayOf, monthOf } from '../../../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../../../shared/calendar/monthKey'
import { accountMoneyFromAmount, subtractAccountMoney, ZERO_ACCOUNT_MONEY } from '../../../../../shared/money/accountMoney'
import { EURO, currencyCodeOf } from '../../../../../shared/money/currencyCode'
import { recordIdOf } from '../../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../../shared/storage/domain/recordId'
import type { RecordKind } from '../../../../../shared/storage/domain/recordKind'
import type { WorkbookDocument } from '../../../../../shared/storage/infrastructure/documentFormat'
import { language } from '../../../../../shared/text/language'

/** How many whole months of rows the set holds before the day's month. */
const WHOLE_MONTHS = 25

function fixedKey(place: number): string {
  return `fa4e3100-0000-4000-8000-${String(place).padStart(12, '0')}`
}

function fixedId(kind: RecordKind, place: number): RecordId {
  return recordIdOf(kind, fixedKey(place))
}

const OTP = fixedId(ACCOUNT_RECORDS, 1001)
const REVOLUT_EUR = fixedId(ACCOUNT_RECORDS, 1002)
const REVOLUT_USD = fixedId(ACCOUNT_RECORDS, 1003)
const CASH = fixedId(ACCOUNT_RECORDS, 1004)
const KITCHEN = fixedId(LABEL_RECORDS, 2001)

/** What each account holds on the day. */
const BALANCES: Readonly<Record<string, number>> = { [OTP]: 3_200, [REVOLUT_EUR]: 410, [REVOLUT_USD]: 120, [CASH]: 80 }

/** The starter categories with fixed keys, named in the language on screen, and each one's id by its English group and name. */
function yearsCategories(): { readonly categories: readonly Category[]; readonly idOf: (path: string) => RecordId } {
  const keys = (): (() => string) => {
    let place = 0
    return () => fixedKey((place += 1))
  }
  const english = starterCategories('en', keys())
  const groups = new Map(english.filter((category) => category.parent === null).map((category) => [category.id, category.name]))
  const ids = new Map(english.map((category) => [category.parent === null ? category.name : `${groups.get(category.parent)}/${category.name}`, category.id]))
  const idOf = (path: string): RecordId => {
    const id = ids.get(path)
    if (id === undefined) throw new Error(`The starter categories have no ${path}.`)
    return id
  }
  return { categories: starterCategories(language, keys()), idOf }
}

/** A day of the month, or the day itself while the month has not reached it, so no row is after the day. */
function dayIn(month: MonthKey, dayOfTheMonth: number, day: CivilDate): CivilDate {
  const date = parseCivilDate(`${month}-${String(dayOfTheMonth).padStart(2, '0')}`)!
  return date > day ? day : date
}

interface YearsRow {
  readonly account: RecordId
  readonly date: CivilDate
  /** One amount for a whole row, or the parts a row is split into, each with its category. */
  readonly parts: readonly (readonly [amount: number, category: string])[]
  readonly payee: string
  readonly labels?: readonly RecordId[]
}

/**
 * A whole month `back` months before the day's, all made up: salary, rent and bills, groceries that grow by 6.00 a month, fuel
 * that shrinks by 4.00 a month, coffee, the home loan's instalment split into interest and principal, and money to investments.
 * Some months add more: a refund from the market, a dollar dinner every third month, kitchen work under one label over two
 * quarters, and a car bought under Bought assets.
 */
function wholeMonthRows(month: MonthKey, back: number, day: CivilDate): YearsRow[] {
  const on = (dayOfTheMonth: number): CivilDate => dayIn(month, dayOfTheMonth, day)
  const age = WHOLE_MONTHS - back
  return [
    { account: OTP, date: on(1), parts: [[-600, 'Home/Rent']], payee: 'Landlord' },
    { account: OTP, date: on(5), parts: [[-110, 'Home/Utilities']], payee: 'City utilities' },
    { account: OTP, date: on(10), parts: [[2_400, 'Income/Salary']], payee: 'Example Studio d.o.o.' },
    { account: OTP, date: on(12), parts: [[-(200 + 6 * age), 'Food/Groceries']], payee: 'Corner market' },
    { account: CASH, date: on(16), parts: [[-40, 'Food/Eating out']], payee: 'Café on the square' },
    { account: REVOLUT_EUR, date: on(20), parts: [[-(160 - 4 * age), 'Transport/Fuel']], payee: 'Fuel station' },
    {
      account: OTP,
      date: on(15),
      parts: [
        [-620, 'Money and fees/Loan interest'],
        [-180, 'Loan principal'],
      ],
      payee: 'Example Bank',
    },
    { account: OTP, date: on(25), parts: [[-300, 'Saved to investments']], payee: 'Example Broker' },
    ...(back === 6 ? [{ account: OTP, date: on(14), parts: [[25, 'Food/Groceries']] as const, payee: 'Corner market' }] : []),
    ...(back % 3 === 0 ? [{ account: REVOLUT_USD, date: on(8), parts: [[-30, 'Food/Eating out']] as const, payee: 'Diner in Boston' }] : []),
    ...(back >= 7 && back <= 12 ? [{ account: OTP, date: on(18), parts: [[-150, 'Home/Repairs and maintenance']] as const, payee: 'Hardware store', labels: [KITCHEN] }] : []),
    ...(back === 8 ? [{ account: OTP, date: on(22), parts: [[-1_500, 'Bought assets']] as const, payee: 'Example Car Dealer' }] : []),
  ]
}

/** The month of the day so far: rent and a shop on its first day. */
function monthSoFarRows(month: MonthKey): YearsRow[] {
  const first = firstDayOf(month)
  return [
    { account: OTP, date: first, parts: [[-600, 'Home/Rent']], payee: 'Landlord' },
    { account: OTP, date: first, parts: [[-52.4, 'Food/Groceries']], payee: 'Corner market' },
  ]
}

function stored<R>(kind: RecordKind<R>, records: readonly R[]): WorkbookDocument['records'] {
  const codec = codecOfSpendingKind(kind)
  return { [kind.name]: records.map((record) => codec.fieldsOf(record)) }
}

/**
 * The `years` set: the sample's four accounts with 25 whole months of rows and the day's month so far, so Analysis has two years
 * to compare and trends to find. Every figure is made up.
 */
export function fakeYearsDocument(savedAt: string, day: CivilDate): WorkbookDocument {
  const { categories, idOf } = yearsCategories()
  const month = monthOf(day)
  const openedOn = firstDayOf(addMonths(month, -WHOLE_MONTHS))
  const account = (id: RecordId, name: string, kind: Account['kind'], bank: Account['bank'], currency = EURO): Account => ({
    id,
    name,
    kind,
    bank,
    currency,
    opening: ZERO_ACCOUNT_MONEY,
    openedOn,
    sources: BY_HAND_SOURCES,
    iban: '',
    cards: [],
    closed: false,
  })
  const accounts = [
    account(OTP, 'OTP current', 'bank', 'otp'),
    account(REVOLUT_EUR, 'Revolut EUR', 'bank', 'revolut'),
    account(REVOLUT_USD, 'Revolut USD', 'bank', 'revolut', currencyCodeOf('USD')!),
    account(CASH, 'Cash', 'cash', null),
  ]
  const rows = [...Array.from({ length: WHOLE_MONTHS }, (_, place) => WHOLE_MONTHS - place).flatMap((back) => wholeMonthRows(addMonths(month, -back), back, day)), ...monthSoFarRows(month)]
  let place = 3000
  const transactions: Transaction[] = []
  const items: TransactionItem[] = []
  for (const row of rows) {
    const amount = row.parts.reduce((sum, [part]) => sum + part, 0)
    const transaction: Transaction = {
      ...NO_BANK_FACTS,
      id: fixedId(TRANSACTION_RECORDS, (place += 1)),
      account: row.account,
      date: row.date,
      amount: accountMoneyFromAmount(amount),
      payee: row.payee,
      source: 'typed',
      pair: null,
      categorisedBy: 'person',
    }
    transactions.push(transaction)
    const labels = row.labels ?? []
    if (row.parts.length === 1) {
      items.push(wholeItemOf(transaction, { category: idOf(row.parts[0]![1]), note: '', link: null, labels }))
      continue
    }
    for (const [part, category] of row.parts) {
      items.push({
        id: fixedId(ITEM_RECORDS, (place += 1)),
        transaction: transaction.id,
        receipt: null,
        printed: '',
        note: '',
        amount: accountMoneyFromAmount(part),
        category: idOf(category),
        link: null,
        labels,
        ruleLabels: [],
        event: BY_DAYS,
        splitByLink: false,
      })
    }
  }
  const opened = accounts.map((held) => ({ ...held, opening: subtractAccountMoney(accountMoneyFromAmount(BALANCES[held.id]!), accountBalance(held, transactions, day)) }))
  const labels: readonly Label[] = [{ id: KITCHEN, name: language === 'hr' ? 'Obnova kuhinje' : 'Kitchen work' }]
  return spendingDocumentOf(savedAt, {
    ...stored(ACCOUNT_RECORDS, opened),
    ...stored(CATEGORY_RECORDS, categories),
    ...stored(LABEL_RECORDS, labels),
    ...stored(
      TRANSACTION_RECORDS,
      transactions.map((transaction) => storedRowOf(transaction, BLANK_CELLS)),
    ),
    ...stored(ITEM_RECORDS, items),
  })
}
