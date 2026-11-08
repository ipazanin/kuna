import { spendingFigures } from '../analytics/presentation/spendingFigures'
import { monthFlow } from '../analytics/domain/monthFlow'
import { categoryTotal } from '../analytics/domain/monthTotals'
import { categoryTree } from '../categories/domain/categoryTree'
import { countedAccounts } from '../rates/domain/euroRows'
import { isWaiting, reviewCount } from '../statements/domain/reviewQueue'
import { SPENDING_ACCOUNT_ROUTE } from '../overview/presentation/spendingLinks'
import type { Account } from '../workbook/domain/account'
import type { Budget } from '../workbook/domain/budget'
import type { Category } from '../workbook/domain/category'
import type { SpendingBook } from '../workbook/domain/readSpendingBook'
import type { Receipt } from '../workbook/domain/receipt'
import type { ReceiptLine } from '../workbook/domain/receiptLine'
import { ACCOUNT_RECORDS, BUDGET_RECORDS, CATEGORY_RECORDS, LINE_RECORDS, RECEIPT_RECORDS, RULE_RECORDS, SETTING_RECORDS, TRANSACTION_RECORDS } from '../workbook/domain/spendingKinds'
import type { SpendingRule } from '../workbook/domain/spendingRule'
import type { Transaction } from '../workbook/domain/transaction'
import { readableKind } from '../../../shared/app/assistantReader'
import type { AppReader, ReportFigure } from '../../../shared/app/assistantReader'
import type { FieldDocs } from '../../../shared/privacy/domain/exposure'
import { parseCivilDate, today } from '../../../shared/calendar/civilDate'
import { addMonths, monthOf, parseMonthKey } from '../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../shared/calendar/monthKey'
import { EURO } from '../../../shared/money/currencyCode'
import { ZERO, addMoney, subtractMoney } from '../../../shared/money/money'
import type { Money } from '../../../shared/money/money'
import { nearestBasisPoints, pointsOfShare } from '../../../shared/money/percent'
import type { RateBook } from '../../../shared/money/rateBook'
import { words } from './words'

/** What the reader reads from, which `app.ts` hands in over the app's own store, so this folder holds no store. */
export interface SpendingReading {
  status(): ReturnType<AppReader['status']>
  book(): SpendingBook | null
  rates(): RateBook
}

/** The kinds that stay out of the chat's reach with why: a setting's value can route bank data or is an identifier, and the catalogue already says what each setting means. */
export const UNREAD_KINDS: readonly string[] = [SETTING_RECORDS.name]

const ACCOUNT_FIELDS: FieldDocs<Account> = {
  id: { exposure: 'ref', to: ACCOUNT_RECORDS.name, meaning: 'The account.' },
  name: { exposure: 'plain', meaning: 'The name the owner gave it.' },
  kind: { exposure: 'plain', meaning: 'bank, cash or savings.' },
  bank: { exposure: 'plain', meaning: 'otp, revolut, other or empty.' },
  currency: { exposure: 'plain', meaning: 'Its one currency.' },
  opening: { exposure: 'plain', amount: 'account', meaning: 'What it held at the start of openedOn.' },
  openedOn: { exposure: 'plain', meaning: 'The day its figures start.' },
  iban: { exposure: 'identifier', meaning: "The account's own IBAN." },
  closed: { exposure: 'plain', meaning: 'Closed by the owner.' },
}

const CATEGORY_FIELDS: FieldDocs<Category> = {
  id: { exposure: 'ref', to: CATEGORY_RECORDS.name, meaning: 'The category.' },
  name: { exposure: 'plain', meaning: 'The name the owner gave it.' },
  kind: { exposure: 'plain', meaning: 'spending, income, saving, transfer or company. Only spending and income count as such in the figures.' },
  parent: { exposure: 'ref', to: CATEGORY_RECORDS.name, meaning: 'The group it sits in, or none for a group.' },
  order: { exposure: 'plain', meaning: 'Its place among its siblings.' },
  colour: { exposure: 'never', meaning: 'Its colour on screen.' },
  hidden: { exposure: 'plain', meaning: 'Hidden from the pickers, while its rows keep counting.' },
}

const TRANSACTION_FIELDS: FieldDocs<Transaction> = {
  id: { exposure: 'ref', to: TRANSACTION_RECORDS.name, meaning: 'The entry.' },
  account: { exposure: 'ref', to: ACCOUNT_RECORDS.name, meaning: 'The account it is on.' },
  date: { exposure: 'plain', meaning: 'The day.' },
  amount: { exposure: 'plain', amount: 'account', meaning: "Credits above zero, debits below, in the account's currency." },
  payee: { exposure: 'party', meaning: 'Who was paid or who paid. An alias for a person Kuna knows, a shop or a company as it is.' },
  category: { exposure: 'ref', to: CATEGORY_RECORDS.name, meaning: 'Its category, or none while it waits on To review, when it counts nowhere.' },
  note: { exposure: 'free-text', meaning: "The owner's note." },
  source: { exposure: 'plain', meaning: 'typed, statement or receipt.' },
  pair: { exposure: 'ref', to: TRANSACTION_RECORDS.name, meaning: 'The other leg of a transfer between own accounts.' },
  description: { exposure: 'free-text', meaning: "The bank's text for the row." },
  counterpartyIban: { exposure: 'identifier', meaning: "The other side's IBAN." },
  importKey: { exposure: 'never', meaning: 'What names the row in its statement.' },
  statement: { exposure: 'free-text', meaning: 'The label of the statement file that brought it.' },
  categorisedBy: { exposure: 'plain', meaning: 'person or rule, or empty.' },
  movedAt: { exposure: 'plain', meaning: 'When a move between own accounts started.' },
  pocket: { exposure: 'plain', meaning: 'A move to or from a savings pocket.' },
}

const BUDGET_FIELDS: FieldDocs<Budget> = {
  id: { exposure: 'ref', to: BUDGET_RECORDS.name, meaning: 'The limit.' },
  category: { exposure: 'ref', to: CATEGORY_RECORDS.name, meaning: 'The spending category it limits.' },
  from: { exposure: 'plain', meaning: 'The month it starts, until a later one of the category.' },
  amount: { exposure: 'plain', amount: 'app', meaning: 'A month in euros. Zero ends the limit.' },
}

const RULE_FIELDS: FieldDocs<SpendingRule> = {
  id: { exposure: 'ref', to: RULE_RECORDS.name, meaning: 'The rule.' },
  order: { exposure: 'plain', meaning: 'The first rule that holds decides a row.' },
  condition: {
    exposure: 'party',
    meaning: "What it tests: words in a payee's name, or the other side's IBAN.",
    read: (rule) => (rule.condition.column === 'counterparty_contains' ? rule.condition.fragment : rule.condition.iban),
  },
  category: { exposure: 'ref', to: CATEGORY_RECORDS.name, meaning: 'The category it files into.' },
}

const RECEIPT_FIELDS: FieldDocs<Receipt> = {
  id: { exposure: 'ref', to: RECEIPT_RECORDS.name, meaning: 'The receipt.' },
  transaction: { exposure: 'ref', to: TRANSACTION_RECORDS.name, meaning: 'The entry it split.' },
  merchant: { exposure: 'party', meaning: 'The shop. An alias for a person Kuna knows.' },
  merchantOib: { exposure: 'identifier', meaning: "The shop's OIB." },
  buyerOib: { exposure: 'identifier', meaning: 'The buyer named on an R1 receipt.' },
  issuedOn: { exposure: 'plain', meaning: 'The day.' },
  issuedTime: { exposure: 'plain', meaning: 'The time, or empty.' },
  total: { exposure: 'plain', amount: 'app', meaning: 'Its total in euros.' },
  jir: { exposure: 'never', meaning: 'The fiscal code.' },
  zki: { exposure: 'never', meaning: 'The fiscal code.' },
  readBy: { exposure: 'plain', meaning: 'The model that read it, or empty.' },
  photo: { exposure: 'never', meaning: "The photo's file on Drive." },
  latitude: { exposure: 'never', meaning: 'Where the photo was taken.' },
  longitude: { exposure: 'never', meaning: 'Where the photo was taken.' },
}

const LINE_FIELDS: FieldDocs<ReceiptLine> = {
  id: { exposure: 'ref', to: LINE_RECORDS.name, meaning: 'The line.' },
  transaction: { exposure: 'ref', to: TRANSACTION_RECORDS.name, meaning: 'The entry it is part of.' },
  receipt: { exposure: 'ref', to: RECEIPT_RECORDS.name, meaning: 'The receipt.' },
  printed: { exposure: 'free-text', meaning: 'As the till printed it.' },
  text: { exposure: 'free-text', meaning: 'In plain words.' },
  amount: { exposure: 'plain', amount: 'account', meaning: 'Signed as the entry is.' },
  category: { exposure: 'ref', to: CATEGORY_RECORDS.name, meaning: 'The figures count this instead of the entry.' },
}

function monthOfPeriod(period: string | null): MonthKey {
  if (period === null) return monthOf(today())
  const month = parseMonthKey(period)
  if (month === null) throw new RangeError('Not a month.')
  return month
}

/** One figure in euros, as the screens count them. */
function euros(label: string, cents: Money): ReportFigure {
  return { label, of: 'app', cents, currency: EURO }
}

function monthReport(book: SpendingBook, rates: RateBook, period: string | null): readonly ReportFigure[] {
  const month = monthOfPeriod(period)
  const totals = spendingFigures(book, rates).totalsOf(month)
  const savingsRate = monthFlow([totals])[0]?.savingsRate ?? null
  return [
    euros('spent', totals.spent),
    euros('income', totals.income),
    euros('saved to investments', totals.saved),
    ...(savingsRate === null ? [] : [{ label: 'savings rate', basisPoints: nearestBasisPoints(pointsOfShare(savingsRate)) }]),
    { label: 'rows left out because no exchange rate reaches them yet', count: totals.unrated },
    { label: 'rows waiting on To review, of any month', count: reviewCount(book) },
  ]
}

function categoriesReport(book: SpendingBook, rates: RateBook, period: string | null): readonly ReportFigure[] {
  const month = monthOfPeriod(period)
  const figures = spendingFigures(book, rates)
  const [totals, before] = [figures.totalsOf(month), figures.totalsOf(addMonths(month, -1))]
  return categoryTree(book.categories, ['spending', 'income']).flatMap(({ group, children }) =>
    [group, ...children].flatMap((category) => {
      const [now, then] = [categoryTotal(totals, category).counted, categoryTotal(before, category).counted]
      if (now === 0 && then === 0) return []
      const label = category === group ? category.name : `${group.name} / ${category.name}`
      return [euros(`${label}: this month`, now), euros(`${label}: month before`, then), euros(`${label}: change`, subtractMoney(now, then))]
    }),
  )
}

function limitsReport(book: SpendingBook, rates: RateBook, period: string | null): readonly ReportFigure[] {
  const names = new Map(book.categories.map((category) => [category.id, category.name]))
  return spendingFigures(book, rates)
    .limitsIn(monthOfPeriod(period))
    .flatMap((limit) => {
      const name = names.get(limit.category) ?? ''
      return [euros(`${name}: limit`, limit.limit), euros(`${name}: carried in`, limit.carriedIn), euros(`${name}: spent`, limit.spent), euros(`${name}: left`, limit.left)]
    })
}

function balancesReport(book: SpendingBook, rates: RateBook, period: string | null): readonly ReportFigure[] {
  const day = period === null ? today() : parseCivilDate(period)
  if (day === null) throw new RangeError('Not a day.')
  const accounts = countedAccounts(book, day, rates)
  const inEuros = accounts.reduce((sum, { euros: amount }) => (amount === null ? sum : addMoney(sum, amount)), ZERO)
  return [
    ...accounts.map(({ account, balance }): ReportFigure => ({ label: account.name, of: 'account', cents: balance, currency: account.currency })),
    euros('all accounts, in euros', inEuros),
    { label: 'accounts left out of that sum because no exchange rate reaches them yet', count: accounts.filter((account) => account.euros === null).length },
  ]
}

/** What the chat can read of Spending: seven kinds, with every field classified, and the figures the screens show, from the same functions. Nothing here writes. */
export function spendingReader(reading: SpendingReading): AppReader {
  const rows = <R>(of: (book: SpendingBook) => readonly R[]): readonly R[] => {
    const book = reading.book()
    return book === null ? [] : of(book)
  }
  const accountCurrency = (id: string): string => reading.book()?.accounts.find((account) => account.id === id)?.currency ?? EURO
  const report = (figures: (book: SpendingBook, rates: RateBook, period: string | null) => readonly ReportFigure[]) => (period: string | null) => {
    const book = reading.book()
    return book === null ? [] : figures(book, reading.rates(), period)
  }
  return {
    status: () => reading.status(),
    kinds: [
      readableKind({
        kind: TRANSACTION_RECORDS,
        about: words.reads.transaction,
        fields: TRANSACTION_FIELDS,
        dated: 'date',
        rows: () => rows((book) => book.transactions),
        currencyOf: (row) => accountCurrency(row.account),
        sets: [{ name: 'waiting', about: words.reads.waiting, holds: isWaiting }],
      }),
      readableKind({
        kind: ACCOUNT_RECORDS,
        about: words.reads.account,
        fields: ACCOUNT_FIELDS,
        dated: null,
        rows: () => rows((book) => book.accounts),
        currencyOf: (account) => account.currency,
        page: SPENDING_ACCOUNT_ROUTE,
      }),
      readableKind({ kind: CATEGORY_RECORDS, about: words.reads.category, fields: CATEGORY_FIELDS, dated: null, rows: () => rows((book) => book.categories), currencyOf: () => EURO }),
      readableKind({ kind: BUDGET_RECORDS, about: words.reads.budget, fields: BUDGET_FIELDS, dated: 'from', rows: () => rows((book) => book.budgets), currencyOf: () => EURO }),
      readableKind({ kind: RULE_RECORDS, about: words.reads.rule, fields: RULE_FIELDS, dated: null, rows: () => rows((book) => book.rules), currencyOf: () => EURO }),
      readableKind({ kind: RECEIPT_RECORDS, about: words.reads.receipt, fields: RECEIPT_FIELDS, dated: 'issuedOn', rows: () => rows((book) => book.receipts), currencyOf: () => EURO }),
      readableKind({
        kind: LINE_RECORDS,
        about: words.reads.line,
        fields: LINE_FIELDS,
        dated: null,
        rows: () => rows((book) => book.lines),
        currencyOf: (line) => accountCurrency(rows((book) => book.transactions).find((row) => row.id === line.transaction)?.account ?? ''),
      }),
    ],
    reports: [
      { id: 'month', title: words.reports.month.title, about: words.reports.month.about, period: 'month', figures: report(monthReport) },
      { id: 'categories', title: words.reports.categories.title, about: words.reports.categories.about, period: 'month', figures: report(categoriesReport) },
      { id: 'limits', title: words.reports.limits.title, about: words.reports.limits.about, period: 'month', figures: report(limitsReport) },
      { id: 'balances', title: words.reports.balances.title, about: words.reports.balances.about, period: 'day', figures: report(balancesReport) },
    ],
  }
}
