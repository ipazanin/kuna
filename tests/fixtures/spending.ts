import { starterCategories } from '../../src/apps/spending/categories/domain/starterCategories'
import { rateBookOfDatedRates } from '../../src/shared/money/rateBook'
import type { Account } from '../../src/apps/spending/workbook/domain/account'
import type { Budget } from '../../src/apps/spending/workbook/domain/budget'
import type { Category } from '../../src/apps/spending/workbook/domain/category'
import { ACCOUNT_RECORDS, BUDGET_RECORDS, TRANSACTION_RECORDS } from '../../src/apps/spending/workbook/domain/spendingKinds'
import { NO_BANK_FACTS } from '../../src/apps/spending/workbook/domain/transaction'
import type { StoredRow } from '../../src/apps/spending/workbook/domain/transaction'
import { largestItem, linkOfItems, rowItemsOf, wholeItemOf } from '../../src/apps/spending/workbook/domain/rowItems'
import type { ItemizedRow } from '../../src/apps/spending/workbook/domain/rowItems'
import { BLANK_CELLS, storedRowOf } from '../../src/apps/spending/workbook/domain/transaction'
import type { StoredLine } from '../../src/apps/spending/workbook/domain/beforeItems'
import { NO_RECORDS } from '../../src/shared/storage/domain/recordsRead'
import type { Reading, RecordsRead } from '../../src/shared/storage/domain/recordsRead'
import type { SettingRow } from '../../src/shared/storage/domain/settingRows'
import { spendingSettingsOf } from '../../src/apps/spending/workbook/domain/spendingSettings'
import type { RowCells, Transaction } from '../../src/apps/spending/workbook/domain/transaction'
import { writeRows } from '../../src/apps/spending/entries/application/rowRecords'
import type { SpendingBook, SpendingRecords } from '../../src/apps/spending/workbook/domain/readSpendingBook'
import { mainCategoryOf } from '../../src/shared/categorising/domain/mainCategory'
import { statementDryRun } from '../../src/apps/spending/statements/domain/statementDryRun'
import type { StatementDryRun } from '../../src/apps/spending/statements/domain/statementDryRun'
import type { RowChange } from '../../src/apps/spending/statements/domain/spendingCategorisation'
import type { StatementRows } from '../../src/apps/spending/statements/domain/statementRows'
import type { CivilDate } from '../../src/shared/calendar/civilDate'
import type { UnitOfWork } from '../../src/shared/storage/application/repository'
import type { TransactionItem } from '../../src/apps/spending/workbook/domain/transactionItem'
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

/** The same accounts, each kept by hand, for a check of rows a person types, which an account the bank fills refuses. */
export const ACCOUNTS_BY_HAND: readonly Account[] = ACCOUNTS.map((account) => ({ ...account, rowsFrom: 'by-hand' }))

let rowPlace = 2000

/** A typed row on the account, in its currency, on a starter category or waiting on review, as a file from before items stores it. */
export function row(on: Account, date: string, amount: number, path: string | null, fields: Partial<StoredRow> = {}): StoredRow {
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
    link: null,
    ...NO_BANK_FACTS,
    categorisedBy: null,
    ...fields,
  }
}

/** The category, note and link a row of these checks carries, which `row` gives it, or blank for a row made without them. */
function cellsOf(entry: Transaction): RowCells {
  const { category = null, note = '', link = null } = entry as Partial<StoredRow>
  return { category, note, link }
}

/** The one item of each row, with all of its money under the row's category, note and link, as the book reads a row not split. */
export function wholeItems(rows: readonly Transaction[]): readonly TransactionItem[] {
  return rows.map((entry) => wholeItemOf(entry, cellsOf(entry)))
}

/** The items of rows a file from before items holds: the lines given for a split row, and one item for every other row. */
export function bookItems(rows: readonly Transaction[], lines: readonly TransactionItem[] = []): readonly TransactionItem[] {
  const linesOf = rowItemsOf({ items: lines })
  return [...rows.flatMap((entry) => (linesOf(entry).length > 0 ? linesOf(entry) : wholeItems([entry]))), ...lines.filter((line) => line.transaction === null)]
}

/** A row with its items: as given, or one item filed as the stored row's own category, note and link say. */
export function itemized(entry: ItemizedRow | Transaction): ItemizedRow {
  return 'row' in entry ? entry : { row: entry, items: wholeItems([entry]) }
}

/** The entries added in one write, in the shape the file holds. */
export function addEntries(unit: UnitOfWork, records: Pick<SpendingRecords, 'transactions' | 'lines' | 'items'>, entries: readonly (ItemizedRow | Transaction)[]): void {
  writeRows(
    unit,
    records,
    entries.map(itemized).map(({ row: added, items }) => ({ before: null, after: added, items })),
  )
}

/** A row on the file written over with what the stored row says it is filed as, in the shape the file holds. */
export function refileEntry(unit: UnitOfWork, records: Pick<SpendingRecords, 'transactions' | 'lines' | 'items'>, before: Transaction, after: StoredRow): void {
  writeRows(unit, records, [{ before, after, items: [wholeItemOf(after, after)] }])
}

function readOf<R extends { readonly id: RecordId }>(records: readonly R[]): RecordsRead<R> {
  return { records: records.map((record) => ({ record, id: record.id, label: '', fields: {} })), refused: [] }
}

/** Rows and lines as a file from before items stores them, which a write of rows starts from. */
export function storedBeforeItems(rows: readonly Transaction[], lines: readonly StoredLine[] = []): SpendingBook['stored'] {
  return { transactions: readOf(rows.map((entry) => storedRowOf(entry, cellsOf(entry)))), lines: readOf(lines), items: NO_RECORDS }
}

/** Rows and their items as a file moved to items stores them. */
function storedWithItems(rows: readonly Transaction[], items: readonly TransactionItem[]): SpendingBook['stored'] {
  return { transactions: readOf(rows.map((entry) => storedRowOf(entry, BLANK_CELLS))), lines: NO_RECORDS, items: readOf(items) }
}

/** The parts of a Spending book a test may give, with its setting rows in place of the settings they make. */
type BookParts = Pick<SpendingBook, 'accounts' | 'categories' | 'budgets' | 'rules' | 'receipts' | 'items' | 'held' | 'stored'> & { readonly settingRows: readonly SettingRow[] }

/**
 * A Spending book over these rows in which every record counts. Unless given, it has the worked example's accounts and
 * categories. Given items are stored as a file moved to items stores them; without them each row is read as one item
 * from a file from before items.
 */
export function spendingBook(transactions: readonly Transaction[], parts: Partial<BookParts> = {}): SpendingBook {
  const { settingRows = [], ...given } = parts
  const book = {
    accounts: ACCOUNTS,
    categories: CATEGORIES,
    budgets: [],
    rules: [],
    receipts: [],
    items: wholeItems(transactions),
    held: [],
    stored: given.items === undefined ? storedBeforeItems(transactions) : storedWithItems(transactions, given.items),
    ...given,
  }
  const counting = <R>(facts: readonly R[]): Reading<R> => ({ facts, problems: [] })
  const storedOf = <R>(read: RecordsRead<R>): readonly R[] => read.records.map((stored) => stored.record)
  return {
    ...book,
    transactions,
    settings: spendingSettingsOf(settingRows),
    readings: {
      accounts: counting(book.accounts),
      categories: counting(book.categories),
      transactions: counting(storedOf(book.stored.transactions)),
      budgets: counting(book.budgets),
      rules: counting(book.rules),
      receipts: counting(book.receipts),
      lines: counting(storedOf(book.stored.lines)),
      items: counting(storedOf(book.stored.items)),
      held: counting(book.held),
      settings: counting(settingRows),
    },
    problems: [],
  }
}

/** Each row of the book with the category, note and link its items give it, as a row not split carried them on itself before items. */
export function filedRows(book: Pick<SpendingBook, 'transactions' | 'items'>): StoredRow[] {
  const itemsOf = rowItemsOf(book)
  return book.transactions.map((entry) => {
    const items = itemsOf(entry)
    return storedRowOf(entry, { category: items.length === 0 ? null : mainCategoryOf(items), note: largestItem(items)?.note ?? '', link: linkOfItems(items) })
  })
}

/** A dry run with each row it adds or changes as a file from before items holds it, with the category, note and link of its items. */
export function filedRun<Run extends Pick<StatementDryRun, 'added' | 'items' | 'changed'>>(
  run: Run,
  book: Pick<SpendingBook, 'items'>,
): Omit<Run, 'added' | 'changed'> & { readonly added: StoredRow[]; readonly changed: { readonly before: Transaction; readonly after: StoredRow; readonly items?: readonly TransactionItem[] }[] } {
  return { ...run, added: filedRows({ transactions: run.added, items: run.items }), changed: filedChanges(run.changed, book) }
}

/** Rows a write changes, each after as a file from before items holds it, with the category, note and link of its items. */
export function filedChanges(
  changes: readonly RowChange[],
  book: Pick<SpendingBook, 'items'>,
): { readonly before: Transaction; readonly after: StoredRow; readonly items?: readonly TransactionItem[] }[] {
  const heldOf = rowItemsOf(book)
  return changes.map((change) => ({ ...change, after: filedRows({ transactions: [change.after], items: change.items ?? heldOf(change.before) })[0]! }))
}

/** The change that refiles a row not split as the stored row after says, with its one item. */
export function refiled(before: StoredRow, after: StoredRow): { readonly before: StoredRow; readonly after: StoredRow; readonly items: readonly TransactionItem[] } {
  return { before, after, items: [wholeItemOf(after, after)] }
}

/** The dry run of a statement, its rows as `filedRun` gives them. */
export function filedDryRun(book: SpendingBook, statement: StatementRows, day: CivilDate, newKey?: () => string): ReturnType<typeof filedRun<StatementDryRun>> {
  return filedRun(statementDryRun(book, statement, day, newKey), book)
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
export const ROWS: readonly StoredRow[] = [
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
