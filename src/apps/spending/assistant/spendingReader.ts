import { spendingFigures } from '../analytics/presentation/spendingFigures'
import { monthFlow } from '../analytics/domain/monthFlow'
import { categoryTotal } from '../analytics/domain/monthTotals'
import { categoryTree } from '../categories/domain/categoryTree'
import { countedAccounts } from '../rates/domain/euroRows'
import { reviewCount } from '../statements/domain/reviewQueue'
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
import type { AppReader, FieldDocs, ReportFigure } from '../../../shared/app/assistantReader'
import { parseCivilDate, today } from '../../../shared/calendar/civilDate'
import { addMonths, monthOf, parseMonthKey } from '../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../shared/calendar/monthKey'
import { EURO } from '../../../shared/money/currencyCode'
import { ZERO, addMoney, subtractMoney } from '../../../shared/money/money'
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
  id: { class: 'ref', to: ACCOUNT_RECORDS.name, meaning: 'The account.' },
  name: { class: 'plain', meaning: 'The name the owner gave it.' },
  kind: { class: 'plain', meaning: 'bank, cash or savings.' },
  bank: { class: 'plain', meaning: 'otp, revolut, other or empty.' },
  currency: { class: 'plain', meaning: 'Its one currency.' },
  opening: { class: 'money', meaning: 'What it held at the start of openedOn.' },
  openedOn: { class: 'plain', meaning: 'The day its figures start.' },
  iban: { class: 'iban', meaning: "The account's own IBAN." },
  closed: { class: 'plain', meaning: 'Closed by the owner.' },
}

const CATEGORY_FIELDS: FieldDocs<Category> = {
  id: { class: 'ref', to: CATEGORY_RECORDS.name, meaning: 'The category.' },
  name: { class: 'plain', meaning: 'The name the owner gave it.' },
  kind: { class: 'plain', meaning: 'spending, income, saving, transfer or company. Only spending and income count as such in the figures.' },
  parent: { class: 'ref', to: CATEGORY_RECORDS.name, meaning: 'The group it sits in, or none for a group.' },
  order: { class: 'plain', meaning: 'Its place among its siblings.' },
  colour: { class: 'never-read', meaning: 'Its colour on screen.' },
  hidden: { class: 'plain', meaning: 'Hidden from the pickers, while its rows keep counting.' },
}

const TRANSACTION_FIELDS: FieldDocs<Transaction> = {
  id: { class: 'ref', to: TRANSACTION_RECORDS.name, meaning: 'The entry.' },
  account: { class: 'ref', to: ACCOUNT_RECORDS.name, meaning: 'The account it is on.' },
  date: { class: 'plain', meaning: 'The day.' },
  amount: { class: 'money', meaning: "Credits above zero, debits below, in the account's currency." },
  payee: { class: 'counterparty', meaning: 'Who was paid or who paid. An alias when it names a person, a shop or a company as it is.' },
  category: { class: 'ref', to: CATEGORY_RECORDS.name, meaning: 'Its category, or none while it waits on To review, when it counts nowhere.' },
  note: { class: 'free-text', meaning: "The owner's note." },
  source: { class: 'plain', meaning: 'typed, statement or receipt.' },
  pair: { class: 'ref', to: TRANSACTION_RECORDS.name, meaning: 'The other leg of a transfer between own accounts.' },
  description: { class: 'free-text', meaning: "The bank's text for the row." },
  counterpartyIban: { class: 'iban', meaning: "The other side's IBAN." },
  importKey: { class: 'never-read', meaning: 'What names the row in its statement.' },
  statement: { class: 'free-text', meaning: 'The label of the statement file that brought it.' },
  categorisedBy: { class: 'plain', meaning: 'person or rule, or empty.' },
  movedAt: { class: 'plain', meaning: 'When a move between own accounts started.' },
  pocket: { class: 'plain', meaning: 'A move to or from a savings pocket.' },
}

const BUDGET_FIELDS: FieldDocs<Budget> = {
  id: { class: 'ref', to: BUDGET_RECORDS.name, meaning: 'The limit.' },
  category: { class: 'ref', to: CATEGORY_RECORDS.name, meaning: 'The spending category it limits.' },
  from: { class: 'plain', meaning: 'The month it starts, until a later one of the category.' },
  amount: { class: 'money', meaning: 'A month in euros. Zero ends the limit.' },
}

const RULE_FIELDS: FieldDocs<SpendingRule> = {
  id: { class: 'ref', to: RULE_RECORDS.name, meaning: 'The rule.' },
  order: { class: 'plain', meaning: 'The first rule that holds decides a row.' },
  condition: {
    class: 'counterparty',
    meaning: "What it tests: words in a payee's name, or the other side's IBAN.",
    read: (rule) => (rule.condition.column === 'counterparty_contains' ? rule.condition.fragment : rule.condition.iban),
  },
  category: { class: 'ref', to: CATEGORY_RECORDS.name, meaning: 'The category it files into.' },
}

const RECEIPT_FIELDS: FieldDocs<Receipt> = {
  id: { class: 'ref', to: RECEIPT_RECORDS.name, meaning: 'The receipt.' },
  transaction: { class: 'ref', to: TRANSACTION_RECORDS.name, meaning: 'The entry it split.' },
  merchant: { class: 'counterparty', meaning: 'The shop. An alias only when it names a person.' },
  merchantOib: { class: 'oib', meaning: "The shop's OIB." },
  buyerOib: { class: 'oib', meaning: 'The buyer named on an R1 receipt.' },
  issuedOn: { class: 'plain', meaning: 'The day.' },
  issuedTime: { class: 'plain', meaning: 'The time, or empty.' },
  total: { class: 'money', meaning: 'Its total in euros.' },
  jir: { class: 'never-read', meaning: 'The fiscal code.' },
  zki: { class: 'never-read', meaning: 'The fiscal code.' },
  readBy: { class: 'plain', meaning: 'The model that read it, or empty.' },
  photo: { class: 'never-read', meaning: "The photo's file on Drive." },
  latitude: { class: 'never-read', meaning: 'Where the photo was taken.' },
  longitude: { class: 'never-read', meaning: 'Where the photo was taken.' },
}

const LINE_FIELDS: FieldDocs<ReceiptLine> = {
  id: { class: 'ref', to: LINE_RECORDS.name, meaning: 'The line.' },
  transaction: { class: 'ref', to: TRANSACTION_RECORDS.name, meaning: 'The entry it is part of.' },
  receipt: { class: 'ref', to: RECEIPT_RECORDS.name, meaning: 'The receipt.' },
  printed: { class: 'free-text', meaning: 'As the till printed it.' },
  text: { class: 'free-text', meaning: 'In plain words.' },
  amount: { class: 'money', meaning: 'Signed as the entry is.' },
  category: { class: 'ref', to: CATEGORY_RECORDS.name, meaning: 'The figures count this instead of the entry.' },
}

function monthOfPeriod(period: string | null): MonthKey {
  if (period === null) return monthOf(today())
  const month = parseMonthKey(period)
  if (month === null) throw new RangeError('Not a month.')
  return month
}

/** One figure in euros, as the screens count them. */
function euros(label: string, cents: number): ReportFigure {
  return { label, cents, currency: EURO }
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
    ...accounts.map(({ account, balance }): ReportFigure => ({ label: account.name, cents: balance, currency: account.currency })),
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
      }),
      readableKind({ kind: ACCOUNT_RECORDS, about: words.reads.account, fields: ACCOUNT_FIELDS, dated: null, rows: () => rows((book) => book.accounts), currencyOf: (account) => account.currency }),
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
