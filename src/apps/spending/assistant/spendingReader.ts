import { spendingFigures } from '../analytics/domain/spendingFigures'
import { monthFlow } from '../analytics/domain/monthFlow'
import { categoryTotal } from '../analytics/domain/monthTotals'
import { categoryTree } from '../categories/domain/categoryTree'
import { countedAccounts, euroRows } from '../rates/domain/euroRows'
import { eventTotals } from '../events/domain/eventTotals'
import { labelTotals } from '../labels/domain/labelTotals'
import { inPeriod } from '../payees/domain/payeePeriod'
import { payeeAmount, payeeTotals, payeesRanked } from '../payees/domain/payeeTotals'
import type { PayeeSide } from '../payees/domain/payeeTotals'
import { usualCategories } from '../payees/domain/usualCategory'
import { reviewCount } from '../statements/domain/reviewQueue'
import { bookingOf } from '../statements/domain/statementDryRun'
import type { BankSetup } from '../bankSync/application/bankSync'
import { BANK_ACCOUNT_LINES, setupActions, setupLineCurrency, setupLineKey, setupLines, startDays } from '../bankSync/domain/bankAccountSetup'
import type { SetupAction, SetupLine } from '../bankSync/domain/bankAccountSetup'
import { currentDifferences } from '../bankSync/domain/bankBalance'
import { fiscalQrOn } from '../receipts/domain/fiscalQr'
import { linkStateOf, paidLoansIn, sameRecord } from '../links/domain/linkTarget'
import type { AppTargets, LinkTarget } from '../links/domain/linkTarget'
import { receiptMatches } from '../receipts/domain/receiptMatch'
import { waitsForBank } from '../receipts/domain/waitingReceipts'
import { SPENDING_ACCOUNT_ROUTE } from '../overview/presentation/spendingLinks'
import { bankLinkOffered } from '../workbook/domain/account'
import type { Account } from '../workbook/domain/account'
import type { Budget } from '../workbook/domain/budget'
import type { Category } from '../workbook/domain/category'
import { BY_DAYS, OUT_OF_EVENTS } from '../workbook/domain/event'
import type { SpendingEvent } from '../workbook/domain/event'
import type { Label } from '../workbook/domain/label'
import type { SpendingBook } from '../workbook/domain/readSpendingBook'
import type { Receipt } from '../workbook/domain/receipt'
import type { TransactionItem } from '../workbook/domain/transactionItem'
import { rowItemsOf, waitsOnReview } from '../workbook/domain/rowItems'
import {
  ACCOUNT_RECORDS,
  BUDGET_RECORDS,
  CATEGORY_RECORDS,
  HELD_ROW_RECORDS,
  ITEM_RECORDS,
  EVENT_RECORDS,
  LABEL_RECORDS,
  RECEIPT_RECORDS,
  RULE_RECORDS,
  SETTING_RECORDS,
  SHORTCUT_PART_RECORDS,
  SHORTCUT_RECORDS,
  TRANSACTION_RECORDS,
  LINE_RECORDS,
} from '../workbook/domain/spendingKinds'
import type { LinkableBank } from '../workbook/domain/spendingSettings'
import { conditionText } from './ruleConditionText'
import type { SpendingRule } from '../workbook/domain/spendingRule'
import type { Shortcut, ShortcutPart } from '../workbook/domain/shortcut'
import type { Transaction } from '../workbook/domain/transaction'
import { readableKind } from '../../../shared/app/assistantReader'
import type { AppReader, ReceiptPayments, ReportFigure } from '../../../shared/app/assistantReader'
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
import type { RecordKind } from '../../../shared/storage/domain/recordKind'
import { words } from './words'

/** What the reader reads from, which `app.ts` hands in over the app's own store, so this folder holds no store. */
export interface SpendingReading {
  status(): ReturnType<AppReader['status']>
  book(): SpendingBook | null
  rates(): RateBook
  /** What the bank set-up list works from, held by the page, or null before any fetch on this device. */
  bankSetup(): BankSetup | null
  /** The text of the QR code on a photo, or null for none. Throws for a photo this browser cannot decode. */
  qrTextOn(photo: Blob): Promise<string | null>
  /** The records of the app a link names, as the screens read them. */
  linkTargets(app: string): AppTargets<LinkTarget>
}

/** The payments a receipt may be, as Entries, Add a receipt finds them, on the QR code's date and total when the photo holds one. */
function receiptPayments(reading: SpendingReading): ReceiptPayments {
  return {
    kind: TRANSACTION_RECORDS.name,
    match: async ({ date, total, merchant, photo }) => {
      const qr = photo === null ? null : await fiscalQrOn(photo, reading.qrTextOn)
      const issuedOn = qr?.issuedOn ?? date
      const totalOn = qr?.total ?? total
      const book = reading.book()
      const matches = book === null ? { kind: 'none' as const } : receiptMatches({ merchant, issuedOn, total: totalOn }, book, null)
      const candidates = matches.kind === 'none' ? [] : matches.candidates.map(({ row, difference }) => ({ id: row.id, date: row.date, amount: row.amount, difference, currency: EURO }))
      return { date: issuedOn, total: totalOn, fromCode: qr !== null, match: matches.kind, candidates }
    },
  }
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
  readonly takesRowsFrom: string | null
  readonly bankBalance: AccountMoney | null
  readonly fixedOpening: AccountMoney | null
}

/**
 * The kinds that stay out of the chat's reach with why: a setting's value can route bank data or is an identifier, and the
 * catalogue already says what each setting means. A bank row on hold is answered on To review, which the chat has no action for.
 * A line of a file from before items is read as the item it makes.
 */
export const UNREAD_KINDS: readonly string[] = [SETTING_RECORDS.name, HELD_ROW_RECORDS.name, LINE_RECORDS.name]

const ACCOUNT_FIELDS: FieldDocs<Account> = {
  id: { exposure: 'ref', to: ACCOUNT_RECORDS.name, meaning: 'The account.' },
  name: { exposure: 'plain', meaning: 'The name the owner gave it.' },
  kind: { exposure: 'plain', meaning: 'bank, cash or savings.' },
  bank: { exposure: 'plain', meaning: 'otp, revolut, other or empty.' },
  currency: { exposure: 'plain', meaning: 'Its one currency.' },
  opening: { exposure: 'plain', amount: 'account', sign: 'either', meaning: 'What it held at the start of openedOn.' },
  openedOn: { exposure: 'plain', meaning: 'The day its figures start.' },
  iban: { exposure: 'identifier', meaning: "The account's own IBAN." },
  cards: {
    exposure: 'plain',
    meaning: 'The last four digits of each card that pays from it. A row on another account that names one, such as Top-Up by *3670, pairs with this account as a transfer.',
  },
  rowsFrom: { exposure: 'plain', meaning: 'bank-link when the bank sync brings its rows, or by-hand when typing, the chat and files do. Cash is always by-hand.' },
  closed: { exposure: 'plain', meaning: 'Closed by the owner.' },
}

const LABEL_FIELDS: FieldDocs<Label> = {
  id: { exposure: 'ref', to: LABEL_RECORDS.name, meaning: 'The label.' },
  name: { exposure: 'plain', meaning: 'The name the owner gave it, such as a trip or a renovation.' },
}

const EVENT_FIELDS: FieldDocs<SpendingEvent> = {
  id: { exposure: 'ref', to: EVENT_RECORDS.name, meaning: 'The event.' },
  name: { exposure: 'plain', meaning: 'The name the owner gave it, such as a trip. Two events may share a name, and their days tell them apart.' },
  days: { exposure: 'plain', meaning: 'Its first and last day, both counted, such as 2027-07-10 to 2027-07-14.', read: (event) => `${event.days.from} to ${event.days.to}` },
}

const CATEGORY_FIELDS: FieldDocs<Category> = {
  id: { exposure: 'ref', to: CATEGORY_RECORDS.name, meaning: 'The category.' },
  name: { exposure: 'plain', meaning: 'The name the owner gave it.' },
  kind: {
    exposure: 'plain',
    meaning:
      'spending, income, saving, transfer, company, repayment, a bank loan principal paid back, or informal-loan, money lent to, borrowed from or paid back between you and a person. Only spending and income count as such in the figures.',
  },
  parent: { exposure: 'ref', to: CATEGORY_RECORDS.name, meaning: 'The group it sits in, or none for a group.' },
  order: { exposure: 'plain', meaning: 'Its place among its siblings.' },
  colour: { exposure: 'never', meaning: 'Its colour on screen.' },
  hidden: { exposure: 'plain', meaning: 'Hidden from the pickers, while its rows keep counting.' },
  role: { exposure: 'plain', meaning: 'bank-fees where a statement files its fees, loan-interest where a linked instalment files its interest, or empty for a category Kuna does not fill.' },
}

/** What a part's link names, as the chat reads it, or null for a part with none. */
function linkRead(item: TransactionItem, targetsOf: (app: string) => AppTargets<LinkTarget>): string | null {
  if (item.link === null) return null
  const read = linkStateOf(item.link, targetsOf(item.link.app))
  if (read.state === 'there') {
    const { target } = read
    switch (target.kind) {
      case 'instalment':
        return (target.interim ? words.reads.linkInterim : words.reads.linkInstalment)(target.loanName, target.due)
      case 'informal-loan':
        return words.reads.linkInformalLoan(target.name)
      case 'movement':
        return words.reads.linkMovement(target.loanName, target.movement, target.day)
      case 'extra-payment':
        return words.reads.linkExtraPayment(target.loanName, target.day)
    }
  }
  return { gone: words.reads.linkGone, opening: words.reads.linkUnknown, failed: words.reads.linkUnknown, 'not-set-up': words.reads.linkNotSetUp }[read.state]
}

const TRANSACTION_FIELDS: FieldDocs<Transaction> = {
  id: { exposure: 'ref', to: TRANSACTION_RECORDS.name, meaning: 'The entry.' },
  account: { exposure: 'ref', to: ACCOUNT_RECORDS.name, meaning: 'The account it is on.' },
  date: { exposure: 'plain', meaning: 'The day.' },
  amount: { exposure: 'plain', amount: 'account', sign: 'either', meaning: "Credits above zero, debits below, in the account's currency." },
  payee: { exposure: 'party', meaning: 'Who was paid or who paid. An alias for a person Kuna knows, a shop or a company as it is. Its parts say what the money is.' },
  source: { exposure: 'plain', meaning: 'typed, statement or receipt.' },
  pair: { exposure: 'ref', to: TRANSACTION_RECORDS.name, meaning: 'The other leg of a transfer between own accounts.' },
  description: { exposure: 'free-text', meaning: "The bank's text for the row." },
  counterpartyIban: { exposure: 'identifier', meaning: "The other side's IBAN." },
  importKey: { exposure: 'never', meaning: 'What names the row in its statement.' },
  statement: { exposure: 'free-text', meaning: 'The label of the statement file that brought it.' },
  categorisedBy: { exposure: 'plain', meaning: 'Who filed its parts: person or rule, or empty.' },
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

/** What the bank loan a rule's rows pay reads as, or null for a rule that names none. */
function paidLoanRead(rule: SpendingRule, targetsOf: (app: string) => AppTargets<LinkTarget>): string | null {
  if (rule.link === null) return null
  const loans = targetsOf(rule.link.app)
  if (loans === null) return words.reads.linkNotSetUp
  if (typeof loans === 'string') return words.reads.linkUnknown
  const { link } = rule
  const loan = paidLoansIn(loans).find((paid) => sameRecord(paid.link, link))
  return loan === undefined ? words.reads.linkGone : words.reads.linkBankLoan(loan.loanName)
}

const ruleFields = (targetsOf: (app: string) => AppTargets<LinkTarget>, accounts: () => readonly Account[]): FieldDocs<SpendingRule> => ({
  id: { exposure: 'ref', to: RULE_RECORDS.name, meaning: 'The rule.' },
  order: { exposure: 'plain', meaning: 'Rules are tried lowest first. The first that holds and files decides the category, and the first that holds and labels decides the labels.' },
  conditions: {
    exposure: 'free-text',
    meaning: 'What it tests, every condition holding, as add-rule types them.',
    read: (rule) => {
      const names = new Map<string, string>(accounts().map((account) => [account.id, account.name]))
      return rule.conditions.map((condition) => conditionText(condition, (id) => names.get(id) ?? id))
    },
  },
  category: { exposure: 'ref', to: CATEGORY_RECORDS.name, meaning: 'The category it files into, or empty for a rule that only labels.' },
  labels: { exposure: 'ref', to: LABEL_RECORDS.name, list: true, meaning: 'The labels it adds to the rows it holds for, never taking one off.' },
  stop: { exposure: 'plain', meaning: 'Whether no later rule is tried for a row it holds for.' },
  withdrawal: {
    exposure: 'plain',
    meaning: 'Whether it spots cash taken out, whose other leg Kuna puts on a cash account.',
    read: (rule) => rule.withdrawal !== null,
  },
  link: {
    exposure: 'free-text',
    meaning: 'The bank loan its rows pay, or empty. Each row it files is linked to the instalment it pays and split into the interest under the category and the principal under Loan principal.',
    read: (rule) => paidLoanRead(rule, targetsOf),
  },
})

const SHORTCUT_FIELDS: FieldDocs<Shortcut> = {
  id: { exposure: 'ref', to: SHORTCUT_RECORDS.name, meaning: 'The quick add.' },
  order: { exposure: 'plain', meaning: 'Its place among the Quick add buttons on Entries, lowest first.' },
  name: { exposure: 'free-text', meaning: 'What its button says, or empty to show the payee.' },
  account: { exposure: 'ref', to: ACCOUNT_RECORDS.name, meaning: 'The account its entry goes on. One on a closed account shows no button.' },
  payee: { exposure: 'party', meaning: 'Who its entry pays or is paid by. An alias for a person Kuna knows.' },
}

const SHORTCUT_PART_FIELDS: FieldDocs<ShortcutPart> = {
  id: { exposure: 'ref', to: SHORTCUT_PART_RECORDS.name, meaning: 'The part.' },
  shortcut: { exposure: 'ref', to: SHORTCUT_RECORDS.name, meaning: 'The quick add it is part of. One part writes an entry not split, and two or more one entry split into them.' },
  amount: { exposure: 'plain', amount: 'account', sign: 'either', meaning: "Below zero for money out, in the account's currency. The parts add up to the entry." },
  category: { exposure: 'ref', to: CATEGORY_RECORDS.name, meaning: 'What this part of the money is filed under.' },
  note: { exposure: 'free-text', meaning: "The owner's note on this money, or empty." },
  labels: { exposure: 'ref', to: LABEL_RECORDS.name, list: true, meaning: 'The labels this money carries.' },
}

const RECEIPT_FIELDS: FieldDocs<Receipt> = {
  id: { exposure: 'ref', to: RECEIPT_RECORDS.name, meaning: 'The receipt.' },
  transaction: { exposure: 'ref', to: TRANSACTION_RECORDS.name, meaning: "The entry it split, or null while it waits for the bank's row." },
  account: { exposure: 'ref', to: ACCOUNT_RECORDS.name, meaning: "The account the bank fills that it waits on for the bank's row, or null once it is on its entry." },
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

const itemFields = (targetsOf: (app: string) => AppTargets<LinkTarget>, events: () => readonly SpendingEvent[]): FieldDocs<TransactionItem> => ({
  id: { exposure: 'ref', to: ITEM_RECORDS.name, meaning: 'The part.' },
  transaction: { exposure: 'ref', to: TRANSACTION_RECORDS.name, meaning: "The entry it is part of, or null for a line of a receipt that waits for the bank's row." },
  receipt: { exposure: 'ref', to: RECEIPT_RECORDS.name, meaning: 'The receipt whose line it is, or null for a part split by hand and for the one part of a whole entry.' },
  printed: { exposure: 'free-text', meaning: 'As the till printed it, or empty.' },
  note: { exposure: 'free-text', meaning: "The owner's note on this money, or a receipt line's plain words, or empty." },
  amount: { exposure: 'plain', amount: 'account', sign: 'either', meaning: 'Signed as the entry is.' },
  category: { exposure: 'ref', to: CATEGORY_RECORDS.name, meaning: 'What this part of the money is filed under, or none while the entry waits on To review. The figures count it.' },
  link: {
    exposure: 'free-text',
    meaning: 'The record in another app this money is, such as the loan instalment it pays, or empty. It changes no figure: the part counts by its category.',
    read: (item) => linkRead(item, targetsOf),
  },
  labels: { exposure: 'ref', to: LABEL_RECORDS.name, list: true, meaning: 'The labels this money carries, beside its category, such as a trip. A label changes no figure of its category.' },
  ruleLabels: { exposure: 'ref', to: LABEL_RECORDS.name, list: true, meaning: 'Those of its labels a rule put on, which a rule change may take off.' },
  event: {
    exposure: 'plain',
    meaning: 'by-days when this money joins the event its day falls in, out when it was taken out of every event by hand, or the event it was put in by hand, as its name and days.',
    read: (item) => eventRead(item.event, events()),
  },
  splitByLink: { exposure: 'plain', meaning: "yes when linking the entry to a loan's instalment split this part off, no for a part split by hand, a receipt's line or a whole entry." },
})

/** An event as the chat reads it, by name and days, so two events of one name stay apart. */
function eventNamed(event: SpendingEvent): string {
  return `${event.name} (${event.days.from} to ${event.days.to})`
}

function eventRead(choice: TransactionItem['event'], events: readonly SpendingEvent[]): string {
  if (choice === BY_DAYS) return 'by-days'
  if (choice === OUT_OF_EVENTS) return 'out'
  const picked = events.find((event) => event.id === choice)
  return picked === undefined ? 'by-days' : eventNamed(picked)
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

/** What each label counts over its entries up to the day, as the Labels screen counts it, which is as Spending counts its months. */
function labelsReport(book: SpendingBook, rates: RateBook, period: string | null): readonly ReportFigure[] {
  const day = period === null ? today() : parseCivilDate(period)
  if (day === null) throw new RangeError('Not a day.')
  const names = new Map(book.categories.map((category) => [category.id, category.name]))
  const rows = euroRows(book, rates).filter((row) => row.transaction.date <= day)
  return labelTotals(rows, book.categories, book.labels).flatMap(({ label, spent, income, saved, groups, rows: carried, unrated }): readonly ReportFigure[] => [
    euros(`${label.name}: spent`, spent),
    ...groups.map(({ group, spent: groupSpent }) => euros(`${label.name} / ${names.get(group) ?? ''}: spent`, groupSpent)),
    ...(income === 0 ? [] : [euros(`${label.name}: received`, income)]),
    ...(saved === 0 ? [] : [euros(`${label.name}: saved to investments`, saved)]),
    { label: `${label.name}: entries`, count: carried },
    ...(unrated === 0 ? [] : [{ label: `${label.name}: entries left out because no exchange rate reaches them yet`, count: unrated }]),
  ])
}

/** What each event counts over its parts up to the day, as the Events screen counts it, which is as Spending counts its months. Two events of one name read apart by their days. */
function eventsReport(book: SpendingBook, rates: RateBook, period: string | null): readonly ReportFigure[] {
  const day = period === null ? today() : parseCivilDate(period)
  if (day === null) throw new RangeError('Not a day.')
  const names = new Map(book.categories.map((category) => [category.id, category.name]))
  const rows = euroRows(book, rates).filter((row) => row.transaction.date <= day)
  return eventTotals(rows, book.categories, book.events).flatMap(({ event, spent, income, saved, groups, rows: counted, unrated }): readonly ReportFigure[] => {
    const named = eventNamed(event)
    return [
      euros(`${named}: spent`, spent),
      ...groups.map(({ group, spent: groupSpent }) => euros(`${named} / ${names.get(group) ?? ''}: spent`, groupSpent)),
      ...(income === 0 ? [] : [euros(`${named}: received`, income)]),
      ...(saved === 0 ? [] : [euros(`${named}: saved to investments`, saved)]),
      { label: `${named}: entries`, count: counted },
      ...(unrated === 0 ? [] : [{ label: `${named}: entries left out because no exchange rate reaches them yet`, count: unrated }]),
    ]
  })
}

/** How many payees the payees report names on each side before one line holds the rest. */
const PAYEES_NAMED = 20

/** Whom money went to and came from over the twelve months up to the day's month, as the Payees tab counts it. A person's name leaves under their alias. */
function payeesReport(book: SpendingBook, rates: RateBook, period: string | null): readonly ReportFigure[] {
  const day = period === null ? today() : parseCivilDate(period)
  if (day === null) throw new RangeError('Not a day.')
  const counted = inPeriod('year', day)
  const totals = payeeTotals(
    euroRows(book, rates).filter((row) => counted(row.transaction.date)),
    book.categories,
  )
  const side = (shown: PayeeSide, word: string): readonly ReportFigure[] => {
    const { top, rest } = payeesRanked(totals, shown, PAYEES_NAMED)
    return [
      ...top.flatMap((payee): readonly ReportFigure[] => [euros(`${payee.name}: ${word}`, payeeAmount(payee, shown)), { label: `${payee.name}: entries`, count: payee.rows }]),
      ...(rest === null ? [] : [euros(`other payees: ${word}`, rest.sum), { label: `other payees who were ${word}: how many`, count: rest.payees }]),
    ]
  }
  return [
    ...side('paid', 'paid'),
    ...side('received', 'received'),
    { label: 'entries left out because no exchange rate reaches them yet', count: totals.reduce((sum, payee) => sum + payee.unrated, 0) },
  ]
}

/** One payee as the chat reads it, derived from the entries. It is no record of the file. */
interface PayeeLine {
  readonly id: string
  readonly name: string
  readonly ibans: readonly string[]
  readonly entries: number
  readonly newestDay: CivilDate | null
  readonly usualOut: RecordId | null
  readonly usualIn: RecordId | null
}

/** The payees of the book, as the Payees tab lists them. */
export const PAYEE_LINES: Pick<RecordKind, 'name' | 'noun'> = {
  name: 'payee',
  noun: {
    en: { one: 'payee', many: 'payees', article: 'a' },
    hr: { one: 'primatelj ili platitelj', of: 'primatelja ili platitelja', few: 'primatelja ili platitelja', other: 'primatelja ili platitelja', gender: 'masculine' },
  },
}

const PAYEE_FIELDS: FieldDocs<PayeeLine> = {
  id: { exposure: 'ref', to: PAYEE_LINES.name, meaning: 'The payee.' },
  name: { exposure: 'party', meaning: 'The payee as their newest entry spells it.' },
  ibans: { exposure: 'identifier', meaning: "The IBANs the payee's bank rows carry, newest first." },
  entries: { exposure: 'plain', meaning: 'How many entries under a spending or an income category name the payee, of all time.' },
  newestDay: { exposure: 'plain', meaning: 'The day of their newest such entry.' },
  usualOut: { exposure: 'ref', to: CATEGORY_RECORDS.name, meaning: "The category the payee's money out usually goes under, which the entry dialog fills in, or none." },
  usualIn: { exposure: 'ref', to: CATEGORY_RECORDS.name, meaning: "The category the payee's money in usually goes under, or none." },
}

/** Every payee of all time, with the categories their entries usually go under. */
function payeeLines(book: SpendingBook, rates: RateBook): readonly PayeeLine[] {
  const [usualOut, usualIn] = [usualCategories(book, 'out'), usualCategories(book, 'in')]
  return payeeTotals(euroRows(book, rates), book.categories).map((payee) => ({
    id: payee.key,
    name: payee.name,
    ibans: payee.ibans,
    entries: payee.rows,
    newestDay: payee.latest,
    usualOut: usualOut.get(payee.key) ?? null,
    usualIn: usualIn.get(payee.key) ?? null,
  }))
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
  takesRowsFrom: { exposure: 'plain', meaning: 'bank-link when update has the bank bring the rows of an account kept by hand. keep-mine keeps it by hand and stops the offer.' },
  bankBalance: { exposure: 'plain', amount: 'account', sign: 'either', meaning: "The bank's balance at the fetch, when it differs from Kuna's." },
  fixedOpening: {
    exposure: 'plain',
    amount: 'account',
    sign: 'either',
    meaning: "The opening fix-opening sets so Kuna's balance agrees with the bank's, or none when pending rows may explain the difference.",
  },
}

/** Whether a new account can take its rows from a bank link, as one line for the chat. The deployment itself stays with the person. */
interface BankSyncLine {
  readonly id: string
  readonly bankLinkOffered: boolean
}

/** The one line that says whether a bank link is offered. It is no record of the file. */
export const BANK_SYNC_LINES: Pick<RecordKind, 'name' | 'noun'> = {
  name: 'bank-sync',
  noun: {
    en: { one: 'bank sync', many: 'bank syncs', article: 'a' },
    hr: { one: 'sinkronizacija s bankom', of: 'sinkronizacije s bankom', few: 'sinkronizacije s bankom', other: 'sinkronizacija s bankom', gender: 'feminine' },
  },
}

const BANK_SYNC_FIELDS: FieldDocs<BankSyncLine> = {
  id: { exposure: 'plain', meaning: 'The one line.' },
  bankLinkOffered: {
    exposure: 'plain',
    meaning: 'Whether a bank sync deployment is saved, so a new bank or savings account can take rowsFrom bank-link. Without it, add-account takes by-hand.',
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
      takesRowsFrom: differs('rowsFrom'),
      bankBalance: difference?.stated ?? null,
      fixedOpening: difference?.fixedOpening ?? null,
    }
  })
}

/** What the chat can read of Spending: seven kinds of record, the payees and the bank set-up list, with every field classified, and the figures the screens show, from the same functions. Nothing here writes. */
export function spendingReader(reading: SpendingReading): AppReader {
  const rows = <R>(of: (book: SpendingBook) => readonly R[]): readonly R[] => {
    const book = reading.book()
    return book === null ? [] : of(book)
  }
  const accountCurrency = (id: string): string => reading.book()?.accounts.find((account) => account.id === id)?.currency ?? EURO
  let itemsIn: { readonly book: SpendingBook; readonly of: (row: Transaction) => readonly TransactionItem[] } | null = null
  /** The items of a row of the book read last, so a set over every row builds them once. */
  const itemsOf = (book: SpendingBook, row: Transaction): readonly TransactionItem[] => {
    if (itemsIn?.book !== book) itemsIn = { book, of: rowItemsOf(book) }
    return itemsIn.of(row)
  }
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
        sets: [
          {
            name: 'waiting',
            about: words.reads.waiting,
            holds: (row) => {
              const book = reading.book()
              return book !== null && waitsOnReview(itemsOf(book, row))
            },
          },
        ],
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
      readableKind({ kind: LABEL_RECORDS, about: words.reads.label, fields: LABEL_FIELDS, dated: null, rows: () => rows((book) => book.labels), currencyOf: () => EURO }),
      readableKind({ kind: EVENT_RECORDS, about: words.reads.event, fields: EVENT_FIELDS, dated: null, rows: () => rows((book) => book.events), currencyOf: () => EURO }),
      readableKind({ kind: BUDGET_RECORDS, about: words.reads.budget, fields: BUDGET_FIELDS, dated: 'from', rows: () => rows((book) => book.budgets), currencyOf: () => EURO }),
      readableKind({
        kind: RULE_RECORDS,
        about: words.reads.rule,
        fields: ruleFields(reading.linkTargets, () => reading.book()?.accounts ?? []),
        dated: null,
        rows: () => rows((book) => book.rules),
        currencyOf: () => EURO,
      }),
      readableKind({
        kind: SHORTCUT_RECORDS,
        about: words.reads.shortcut,
        fields: SHORTCUT_FIELDS,
        dated: null,
        rows: () => rows((book) => book.shortcuts),
        currencyOf: (shortcut) => accountCurrency(shortcut.account),
      }),
      readableKind({
        kind: SHORTCUT_PART_RECORDS,
        about: words.reads.shortcutPart,
        fields: SHORTCUT_PART_FIELDS,
        dated: null,
        rows: () => rows((book) => book.shortcutParts),
        currencyOf: (part) => accountCurrency(rows((book) => book.shortcuts).find((shortcut) => shortcut.id === part.shortcut)?.account ?? ''),
      }),
      readableKind<Receipt>({
        kind: RECEIPT_RECORDS,
        about: words.reads.receipt,
        fields: RECEIPT_FIELDS,
        dated: 'issuedOn',
        rows: () => rows((book) => book.receipts),
        currencyOf: () => EURO,
        sets: [{ name: 'waiting', about: words.reads.waitingReceipt, holds: waitsForBank }],
      }),
      readableKind({
        kind: ITEM_RECORDS,
        about: words.reads.line,
        fields: itemFields(reading.linkTargets, () => reading.book()?.events ?? []),
        dated: null,
        rows: () => rows((book) => [...book.transactions.flatMap((row) => itemsOf(book, row)), ...book.items.filter((line) => line.transaction === null)]),
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
      readableKind<PayeeLine>({
        kind: PAYEE_LINES,
        about: words.reads.payee,
        fields: PAYEE_FIELDS,
        dated: 'newestDay',
        rows: () => rows((book) => payeeLines(book, reading.rates())),
        currencyOf: () => EURO,
      }),
      readableKind<BankSyncLine>({
        kind: BANK_SYNC_LINES,
        about: words.reads.bankSync,
        fields: BANK_SYNC_FIELDS,
        dated: null,
        rows: () => rows((book) => [{ id: BANK_SYNC_LINES.name, bankLinkOffered: bankLinkOffered('bank', null, book.settings) }]),
        currencyOf: () => EURO,
      }),
    ],
    reports: [
      { id: 'month', title: words.reports.month.title, about: words.reports.month.about, period: 'month', figures: report(monthReport) },
      { id: 'categories', title: words.reports.categories.title, about: words.reports.categories.about, period: 'month', figures: report(categoriesReport) },
      { id: 'limits', title: words.reports.limits.title, about: words.reports.limits.about, period: 'month', figures: report(limitsReport) },
      { id: 'balances', title: words.reports.balances.title, about: words.reports.balances.about, period: 'day', figures: report(balancesReport) },
      { id: 'labels', title: words.reports.labels.title, about: words.reports.labels.about, period: 'day', figures: report(labelsReport) },
      { id: 'events', title: words.reports.events.title, about: words.reports.events.about, period: 'day', figures: report(eventsReport) },
      { id: 'payees', title: words.reports.payees.title, about: words.reports.payees.about, period: 'day', figures: report(payeesReport) },
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
    receipts: receiptPayments(reading),
  }
}
