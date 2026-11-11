import { starterCategories } from '../../src/apps/spending/categories/domain/starterCategories'
import { rateBookOfDatedRates } from '../../src/shared/money/rateBook'
import type { Account } from '../../src/apps/spending/workbook/domain/account'
import type { Budget } from '../../src/apps/spending/workbook/domain/budget'
import type { Category } from '../../src/apps/spending/workbook/domain/category'
import { ACCOUNT_RECORDS, BUDGET_RECORDS, TRANSACTION_RECORDS } from '../../src/apps/spending/workbook/domain/spendingKinds'
import { NO_BANK_FACTS } from '../../src/apps/spending/workbook/domain/transaction'
import type { Transaction } from '../../src/apps/spending/workbook/domain/transaction'
import { accountMoneyFromAmount } from '../../src/shared/money/accountMoney'
import { EURO, currencyCodeOf } from '../../src/shared/money/currencyCode'
import { recordIdOf } from '../../src/shared/storage/domain/recordId'
import type { RecordId } from '../../src/shared/storage/domain/recordId'
import { civil, euros, month } from './ledger'

export const USD = currencyCodeOf('USD')!

/** The day of the worked example's balances. */
export const DAY = civil('2026-11-04')

const keyOf = (place: number): string => `5e000000-0000-4000-8000-${String(place).padStart(12, '0')}`

/** The English starter categories, with keys from 1 in their order. */
export const CATEGORIES: readonly Category[] = (() => {
  let place = 0
  return starterCategories('en', () => keyOf((place += 1)))
})()

/** A starter category by its group's name, or by its group's and its own, such as `Food/Groceries`. */
export function category(path: string): Category {
  const [group, child] = path.split('/')
  const groupOf = CATEGORIES.find((candidate) => candidate.parent === null && candidate.name === group)
  const found = child === undefined ? groupOf : CATEGORIES.find((candidate) => candidate.parent === groupOf?.id && candidate.name === child)
  if (found === undefined) {
    throw new Error(`The starter categories have no ${path}.`)
  }
  return found
}

export function account(place: number, fields: Omit<Account, 'id'>): Account {
  return { ...fields, id: recordIdOf(ACCOUNT_RECORDS, keyOf(1000 + place)) }
}

const OPENED_ON = civil('2026-09-01')

export const OTP = account(1, {
  name: 'OTP current',
  kind: 'bank',
  bank: 'otp',
  currency: EURO,
  opening: accountMoneyFromAmount(1_550),
  openedOn: OPENED_ON,
  rowsFrom: 'bank-link',
  iban: 'HR0000000000000000001',
  closed: false,
})
export const REVOLUT_EUR = account(2, {
  name: 'Revolut EUR',
  kind: 'bank',
  bank: 'revolut',
  currency: EURO,
  opening: accountMoneyFromAmount(300),
  openedOn: OPENED_ON,
  rowsFrom: 'bank-link',
  iban: 'LT000000000000000001',
  closed: false,
})
export const REVOLUT_USD = account(3, {
  name: 'Revolut USD',
  kind: 'bank',
  bank: 'revolut',
  currency: USD,
  opening: accountMoneyFromAmount(200),
  openedOn: OPENED_ON,
  rowsFrom: 'bank-link',
  iban: 'LT000000000000000001',
  closed: false,
})
export const CASH = account(4, { name: 'Cash', kind: 'cash', bank: null, currency: EURO, opening: accountMoneyFromAmount(100), openedOn: OPENED_ON, rowsFrom: 'by-hand', iban: '', closed: false })

export const ACCOUNTS: readonly Account[] = [OTP, REVOLUT_EUR, REVOLUT_USD, CASH]

let rowPlace = 2000

/** A typed row on the account, in its currency, on a starter category or waiting on review. */
export function row(on: Account, date: string, amount: number, path: string | null, fields: Partial<Transaction> = {}): Transaction {
  return {
    id: recordIdOf(TRANSACTION_RECORDS, keyOf((rowPlace += 1))),
    account: on.id,
    date: civil(date),
    amount: accountMoneyFromAmount(amount),
    payee: '',
    category: path === null ? null : category(path).id,
    note: '',
    source: 'typed',
    pair: null,
    ...NO_BANK_FACTS,
    categorisedBy: null,
    ...fields,
  }
}

export function transactionId(place: number): RecordId {
  return recordIdOf(TRANSACTION_RECORDS, keyOf(3000 + place))
}

/** The two legs of a top-up from OTP to Revolut EUR, each naming the other. */
const [TOP_UP_OUT, TOP_UP_IN] = [transactionId(1), transactionId(2)]

/**
 * October's rows of the worked example, which leave the four accounts on 4 Nov at €1,850.00, €320.50, $170.00 and
 * €64.00: OTP 1,550.00 − 200.00 − 600.00 + 2,400.00 − 350.00 − 650.00 − 300.00, Revolut EUR 300.00 + 200.00 − 90.00
 * − 89.50, Revolut USD 200.00 − 30.00, and Cash 100.00 − 36.00.
 */
export const ROWS: readonly Transaction[] = [
  row(OTP, '2026-10-01', -600, 'Home/Rent', { payee: 'Landlord' }),
  row(OTP, '2026-10-03', -200, 'Between my accounts', { id: TOP_UP_OUT, payee: 'Top-up', pair: TOP_UP_IN }),
  row(REVOLUT_EUR, '2026-10-03', 200, 'Between my accounts', { id: TOP_UP_IN, payee: 'Top-up', pair: TOP_UP_OUT }),
  row(OTP, '2026-10-10', 2_400, 'Income/Salary', { payee: 'Example Studio d.o.o.' }),
  row(REVOLUT_USD, '2026-10-10', -30, 'Travel/On the trip', { payee: 'Diner in Boston' }),
  row(OTP, '2026-10-12', -350, 'Food/Groceries', { payee: 'Corner market' }),
  row(REVOLUT_EUR, '2026-10-14', -90, 'Food/Restaurants', { payee: 'Harbour bistro' }),
  row(OTP, '2026-10-15', -650, 'Money and fees/Loan instalments', { payee: 'Example Bank' }),
  row(CASH, '2026-10-16', -36, 'Food/Coffee', { payee: 'Café on the square' }),
  row(REVOLUT_EUR, '2026-10-20', -89.5, 'Transport/Fuel', { payee: 'Fuel station' }),
  row(OTP, '2026-10-25', -300, 'Saved to investments', { payee: 'Example Broker' }),
]

/** The ECB's made-up dollar rates: none before 1 Sep, 1.0800 on 10 Oct, 1.0850 on Friday 30 Oct and 1.0900 on 4 Nov. */
export const RATES = rateBookOfDatedRates(
  new Map([
    [
      USD,
      [
        ['2026-09-01', '1.0750'],
        ['2026-10-10', '1.0800'],
        ['2026-10-30', '1.0850'],
        ['2026-11-04', '1.0900'],
      ],
    ],
  ]),
)

export function budget(place: number, path: string, from: string, amount: number): Budget {
  return { id: recordIdOf(BUDGET_RECORDS, keyOf(4000 + place)), category: category(path).id, from: month(from), amount: euros(amount) }
}
