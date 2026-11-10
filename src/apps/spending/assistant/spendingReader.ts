import { spendingFigures } from '../analytics/presentation/spendingFigures'
import { monthFlow } from '../analytics/domain/monthFlow'
import { categoryTotal } from '../analytics/domain/monthTotals'
import { categoryTree } from '../categories/domain/categoryTree'
import { countedAccounts } from '../rates/domain/euroRows'
import { isWaiting, reviewCount } from '../statements/domain/reviewQueue'
import { bookingOf } from '../statements/domain/statementDryRun'
import type { BankSetup } from '../bankSync/application/bankSync'
import { BANK_ACCOUNT_LINES, setupActions, setupLineCurrency, setupLineKey, setupLines, startDays } from '../bankSync/domain/bankAccountSetup'
import type { SetupAction, SetupLine } from '../bankSync/domain/bankAccountSetup'
import { currentDifferences } from '../bankSync/domain/bankBalance'
import { SPENDING_ACCOUNT_ROUTE } from '../overview/presentation/spendingLinks'
import type { Account } from '../workbook/domain/account'
import type { Budget } from '../workbook/domain/budget'
import type { Category } from '../workbook/domain/category'
import type { SpendingBook } from '../workbook/domain/readSpendingBook'
import type { Receipt } from '../workbook/domain/receipt'
import type { EntryPart } from '../workbook/domain/entryPart'
import {
  ACCOUNT_RECORDS,
  BUDGET_RECORDS,
  CATEGORY_RECORDS,
  HELD_ROW_RECORDS,
  PART_RECORDS,
  RECEIPT_RECORDS,
  RULE_RECORDS,
  SETTING_RECORDS,
  TRANSACTION_RECORDS,
} from '../workbook/domain/spendingKinds'
import type { LinkableBank } from '../workbook/domain/spendingSettings'
import type { SpendingRule } from '../workbook/domain/spendingRule'
import type { Transaction } from '../workbook/domain/transaction'
import { readableKind } from '../../../shared/app/assistantReader'
import type { AppReader, ReportFigure } from '../../../shared/app/assistantReader'
import type { FieldDocs } from '../../../shared/privacy/domain/exposure'
import { parseCivilDate, today } from '../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../shared/calendar/civilDate'
import { addMonths, monthOf, parseMonthKey } from '../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../shared/calendar/monthKey'
import type { AccountMoney } from '../../../shared/money/accountMoney'
import { EURO } from '../../../shared/money/currencyCode'
import { ZERO, addMoney, subtractMoney } from '../../../shared/money/money'
import type { Money } from '../../../shared/money/money'
import { nearestBasisPoints, pointsOfShare } from '../../../shared/money/percent'
import type { RateBook } from '../../../shared/money/rateBook'
import type { RecordId } from '../../../shared/storage/domain/recordId'
import { words } from './words'

/** What the reader reads from, which `app.ts` hands in over the app's own store, so this folder holds no store. */
export interface SpendingReading {
  status(): ReturnType<AppReader['status']>
  book(): SpendingBook | null
  rates(): RateBook
  /** What the bank set-up list works from, held by the page, or null before any fetch on this device. */
  bankSetup(): BankSetup | null
}

/** One line of the bank set-up list as the chat reads it. */
interface BankAccountLine {
  readonly id: string
  readonly bank: LinkableBank
  readonly currency: string
  readonly state: SetupLine['kind']
  readonly account: RecordId | null
  readonly iban: string
  readonly offers: readonly SetupAction[]
  readonly draft: string | null
  readonly opening: AccountMoney | null
  readonly openedOn: CivilDate | null
  readonly earliestStart: CivilDate | null
  readonly rowsHeld: number | null
  readonly takesBank: string | null
  readonly takesIban: string | null
  readonly takesKind: string | null
  readonly bankBalance: AccountMoney | null
  readonly fixedOpening: AccountMoney | null
}

/**
 * The kinds that stay out of the chat's reach with why: a setting's value can route bank data or is an identifier, and the
 * catalogue already says what each setting means. A bank row on hold is answered on To review, which the chat has no action for.
 */
export const UNREAD_KINDS: readonly string[] = [SETTING_RECORDS.name, HELD_ROW_RECORDS.name]

const ACCOUNT_FIELDS: FieldDocs<Account> = {
  id: { exposure: 'ref', to: ACCOUNT_RECORDS.name, meaning: 'The account.' },
  name: { exposure: 'plain', meaning: 'The name the owner gave it.' },
  kind: { exposure: 'plain', meaning: 'bank, cash or savings.' },
  bank: { exposure: 'plain', meaning: 'otp, revolut, other or empty.' },
  currency: { exposure: 'plain', meaning: 'Its one currency.' },
  opening: { exposure: 'plain', amount: 'account', sign: 'either', meaning: 'What it held at the start of openedOn.' },
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
  amount: { exposure: 'plain', amount: 'account', sign: 'either', meaning: "Credits above zero, debits below, in the account's currency." },
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
  cashWithdrawal: { exposure: 'plain', meaning: "Cash taken out, as the bank's row type says." },
}

const BUDGET_FIELDS: FieldDocs<Budget> = {
  id: { exposure: 'ref', to: BUDGET_RECORDS.name, meaning: 'The limit.' },
  category: { exposure: 'ref', to: CATEGORY_RECORDS.name, meaning: 'The spending category it limits.' },
  from: { exposure: 'plain', meaning: 'The month it starts, until a later one of the category.' },
  amount: { exposure: 'plain', amount: 'app', sign: 'zero-or-more', meaning: 'A month in euros. Zero ends the limit.' },
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
  withdrawal: {
    exposure: 'plain',
    meaning: 'Whether it spots cash taken out, whose other leg Kuna puts on a cash account.',
    read: (rule) => rule.withdrawal !== null,
  },
}

const RECEIPT_FIELDS: FieldDocs<Receipt> = {
  id: { exposure: 'ref', to: RECEIPT_RECORDS.name, meaning: 'The receipt.' },
  transaction: { exposure: 'ref', to: TRANSACTION_RECORDS.name, meaning: 'The entry it split.' },
  merchant: { exposure: 'party', meaning: 'The shop. An alias for a person Kuna knows.' },
  merchantOib: { exposure: 'identifier', meaning: "The shop's OIB." },
  buyerOib: { exposure: 'identifier', meaning: 'The buyer named on an R1 receipt.' },
  issuedOn: { exposure: 'plain', meaning: 'The day.' },
  issuedTime: { exposure: 'plain', meaning: 'The time, or empty.' },
  total: { exposure: 'plain', amount: 'app', sign: 'either', meaning: 'Its total in euros.' },
  jir: { exposure: 'never', meaning: 'The fiscal code.' },
  zki: { exposure: 'never', meaning: 'The fiscal code.' },
  readBy: { exposure: 'plain', meaning: 'The model that read it, or empty.' },
  photo: { exposure: 'never', meaning: "The photo's file on Drive." },
  latitude: { exposure: 'never', meaning: 'Where the photo was taken.' },
  longitude: { exposure: 'never', meaning: 'Where the photo was taken.' },
}

const PART_FIELDS: FieldDocs<EntryPart> = {
  id: { exposure: 'ref', to: PART_RECORDS.name, meaning: 'The part.' },
  transaction: { exposure: 'ref', to: TRANSACTION_RECORDS.name, meaning: 'The entry it is part of.' },
  receipt: { exposure: 'ref', to: RECEIPT_RECORDS.name, meaning: 'The receipt whose line it is, or null for a part split by hand.' },
  printed: { exposure: 'free-text', meaning: 'As the till printed it, or empty.' },
  text: { exposure: 'free-text', meaning: 'In plain words, or empty.' },
  amount: { exposure: 'plain', amount: 'account', sign: 'either', meaning: 'Signed as the entry is.' },
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

const BANK_ACCOUNT_FIELDS: FieldDocs<BankAccountLine> = {
  id: { exposure: 'ref', to: BANK_ACCOUNT_LINES.name, meaning: 'The line, which the bank account operations take.' },
  bank: { exposure: 'plain', meaning: 'otp or revolut.' },
  currency: { exposure: 'plain', meaning: 'The currency of this line.' },
  state: { exposure: 'plain', meaning: "kept as a Spending account, fits one that takes the bank's details, missing from Kuna, or not-in-kuna as you said." },
  account: { exposure: 'ref', to: ACCOUNT_RECORDS.name, meaning: 'The Spending account that keeps it or fits it, or none.' },
  iban: { exposure: 'identifier', meaning: "The bank's IBAN for it." },
  offers: { exposure: 'plain', meaning: 'What the bank account operations can do with it: add, update, keep-mine, leave-out, bring-back or bring-back-mine.' },
  draft: { exposure: 'plain', meaning: 'The name of the account add makes, or none.' },
  opening: { exposure: 'plain', amount: 'account', sign: 'either', meaning: 'The opening the account add makes starts at when it starts on openedOn.' },
  openedOn: { exposure: 'plain', meaning: 'The day of the fetch, which the account add makes starts on unless its startsOn names an earlier day, and the latest it can start on.' },
  earliestStart: { exposure: 'plain', meaning: "The earliest day add can start the account on, where the bank's rows begin." },
  rowsHeld: { exposure: 'plain', meaning: 'The rows the page holds for the account add makes. Those from the day it starts on come in with it.' },
  takesBank: { exposure: 'plain', meaning: 'The bank update gives the account, when it differs.' },
  takesIban: { exposure: 'identifier', meaning: 'The IBAN update gives the account, when it differs.' },
  takesKind: { exposure: 'plain', meaning: 'The kind update gives the account, when it differs.' },
  bankBalance: { exposure: 'plain', amount: 'account', sign: 'either', meaning: "The bank's balance at the fetch, when it differs from Kuna's." },
  fixedOpening: {
    exposure: 'plain',
    amount: 'account',
    sign: 'either',
    meaning: "The opening fix-opening sets so Kuna's balance agrees with the bank's, or none when pending rows may explain the difference.",
  },
}

/** The bank set-up list as the chat reads it, matched against the file as it stands. */
function bankAccountLines(setup: BankSetup, book: SpendingBook): readonly BankAccountLine[] {
  const differences = currentDifferences(setup.differences, book.accounts)
  return setupLines(setup.linked, setup.proposals, book).map((line): BankAccountLine => {
    const account = line.kind === 'kept' || line.kind === 'fits' ? line.account : null
    const update = line.kind === 'kept' || line.kind === 'fits' ? line.update : null
    const proposal = line.kind === 'missing' ? line.proposal : null
    const difference = account === null ? undefined : differences.find((each) => each.account.id === account.id)
    const differs = <K extends keyof Account>(field: K): Account[K] | null => (update === null || account === null || update[field] === account[field] ? null : update[field])
    return {
      id: setupLineKey(line),
      bank: line.bank,
      currency: setupLineCurrency(line),
      state: line.kind,
      account: account?.id ?? null,
      iban: line.linked.iban,
      offers: setupActions(line),
      draft: proposal?.account.name ?? null,
      opening: proposal?.account.opening ?? null,
      openedOn: proposal?.account.openedOn ?? null,
      earliestStart: proposal === null ? null : startDays(proposal).earliest,
      rowsHeld: proposal?.rows.rows.length ?? null,
      takesBank: differs('bank'),
      takesIban: differs('iban'),
      takesKind: differs('kind'),
      bankBalance: difference?.stated ?? null,
      fixedOpening: difference?.fixedOpening ?? null,
    }
  })
}

/** What the chat can read of Spending: seven kinds of record and the bank set-up list, with every field classified, and the figures the screens show, from the same functions. Nothing here writes. */
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
        kind: PART_RECORDS,
        about: words.reads.line,
        fields: PART_FIELDS,
        dated: null,
        rows: () => rows((book) => book.lines),
        currencyOf: (line) => accountCurrency(rows((book) => book.transactions).find((row) => row.id === line.transaction)?.account ?? ''),
      }),
      readableKind<BankAccountLine>({
        kind: BANK_ACCOUNT_LINES,
        about: words.reads.bankAccount,
        fields: BANK_ACCOUNT_FIELDS,
        dated: null,
        rows: () => {
          const setup = reading.bankSetup()
          return setup === null ? [] : rows((book) => bankAccountLines(setup, book))
        },
        currencyOf: (line) => line.currency,
      }),
    ],
    reports: [
      { id: 'month', title: words.reports.month.title, about: words.reports.month.about, period: 'month', figures: report(monthReport) },
      { id: 'categories', title: words.reports.categories.title, about: words.reports.categories.about, period: 'month', figures: report(categoriesReport) },
      { id: 'limits', title: words.reports.limits.title, about: words.reports.limits.about, period: 'month', figures: report(limitsReport) },
      { id: 'balances', title: words.reports.balances.title, about: words.reports.balances.about, period: 'day', figures: report(balancesReport) },
    ],
    bookings: {
      kind: TRANSACTION_RECORDS.name,
      accountKind: ACCOUNT_RECORDS.name,
      of: (account) => {
        const book = reading.book()
        if (book === null || !book.accounts.some((held) => held.id === account)) return null
        return book.transactions.filter((row) => row.account === account).map((row) => ({ id: row.id, booking: bookingOf(row) }))
      },
      onlyAccount: () => {
        const accounts = reading.book()?.accounts ?? []
        return accounts.length === 1 ? accounts[0]!.id : null
      },
    },
  }
}
