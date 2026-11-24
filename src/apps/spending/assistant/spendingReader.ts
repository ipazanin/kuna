import { spendingFigures } from '../analytics/domain/spendingFigures'
import { ANALYSIS_REPORTS, keptFigures } from './analysisReports'
import { normaliseIban } from '../../../shared/text/fold'
import type { Label } from '../../../shared/categorising/domain/labels'
import { monthFlow } from '../analytics/domain/monthFlow'
import { categoryTotal } from '../analytics/domain/monthTotals'
import { categoryTree } from '../categories/domain/categoryTree'
import { countedRows, sharedCostCounts } from '../analytics/domain/countedRow'
import { countedAccounts } from '../rates/domain/euroRows'
import { eventTotals } from '../events/domain/eventTotals'
import { labelTotals } from '../labels/domain/labelTotals'
import { inPeriod } from '../payees/domain/payeePeriod'
import { payeeAmount, payeeTotals, payeesRanked } from '../payees/domain/payeeTotals'
import type { PayeeSide } from '../payees/domain/payeeTotals'
import { usualCategories } from '../payees/domain/usualCategory'
import { keyOfPayee } from '../payees/domain/payeeDetails'
import type { Payee, PayeeParty } from '../workbook/domain/payee'
import { reviewCount } from '../statements/domain/reviewQueue'
import { bookingOf } from '../statements/domain/twinRows'
import type { BankSetup } from '../bankSync/application/bankSync'
import { BANK_ACCOUNT_LINES, setupActions, setupLineCurrency, setupLineKey, setupLines, startDays } from '../bankSync/domain/bankAccountSetup'
import type { SetupAction, SetupLine } from '../bankSync/domain/bankAccountSetup'
import { currentDifferences } from '../bankSync/domain/bankBalance'
import { fiscalQrOn } from '../receipts/domain/fiscalQr'
import { oibIn } from '../receipts/domain/oib'
import { placeInPhoto } from '../receipts/domain/photoPlace'
import { assetUseOf, filedAsBought, isPayLink, linkStateOf, paidLoansIn, sameRecord } from '../links/domain/linkTarget'
import type { AppTargets, LinkTarget, TargetSource } from '../links/domain/linkTarget'
import { receiptMatches } from '../receipts/domain/receiptMatch'
import { waitsForBank } from '../receipts/domain/waitingReceipts'
import { SPENDING_ACCOUNT_ROUTE } from '../overview/presentation/spendingLinks'
import { bankLinkOffered } from '../workbook/domain/account'
import { periodsText } from '../../../shared/app/accountSource'
import type { Account } from '../workbook/domain/account'
import type { Budget } from '../workbook/domain/budget'
import type { Category } from '../workbook/domain/category'
import { BY_DAYS, OUT_OF_EVENTS } from '../workbook/domain/event'
import type { SpendingEvent } from '../workbook/domain/event'
import type { SharedCost } from '../workbook/domain/sharedCost'
import type { SpendingBook } from '../workbook/domain/readSpendingBook'
import type { Receipt } from '../workbook/domain/receipt'
import type { TransactionItem } from '../workbook/domain/transactionItem'
import { rowItemsOf, waitsOnReview } from '../workbook/domain/rowItems'
import {
  ACCOUNT_RECORDS,
  BUDGET_RECORDS,
  CATEGORY_RECORDS,
  HELD_ROW_RECORDS,
  DROPPED_ROW_RECORDS,
  ITEM_RECORDS,
  EVENT_RECORDS,
  LABEL_RECORDS,
  RECEIPT_RECORDS,
  RECIPE_RECORDS,
  PAYEE_RECORDS,
  RULE_RECORDS,
  BANK_LINK_RECORDS,
  SETTING_RECORDS,
  SHARED_COST_RECORDS,
  SHORTCUT_PART_RECORDS,
  SHORTCUT_RECORDS,
  TRANSACTION_RECORDS,
  LINE_RECORDS,
} from '../workbook/domain/spendingKinds'
import { conditionText } from './ruleConditionText'
import { STATEMENT_RECIPE_FIELDS } from '../statements/domain/statementRecipeDraft'
import type { SavedRecipe } from '../workbook/domain/savedRecipe'
import { draftOfRecipe } from '../../../shared/recipes/domain/tableRecipeDraft'
import { inputOfDraft } from '../../../shared/recipes/domain/draftInput'
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
  /** Which kind of app the app a link names is: Loans, or a company app whose payments may be an employee's pay. */
  linkSource(app: string): TargetSource
}

/** The payments a receipt may be, as Entries, Add a receipt finds them, on the QR code's date and total when the photo holds one. */
function receiptPayments(reading: SpendingReading): ReceiptPayments {
  return {
    kind: TRANSACTION_RECORDS.name,
    match: async ({ date, total, merchant, merchantOib, photo }) => {
      const [qr, place] = photo === null ? [null, null] : await Promise.all([fiscalQrOn(photo, reading.qrTextOn), placeInPhoto(photo)])
      const issuedOn = qr?.issuedOn ?? date
      const totalOn = qr?.total ?? total
      const book = reading.book()
      const facts = { merchant, merchantOib: oibIn(merchantOib), issuedOn, total: totalOn, latitude: place?.latitude ?? '', longitude: place?.longitude ?? '' }
      const matches = book === null ? { kind: 'none' as const } : receiptMatches(facts, book, null)
      const candidates = matches.kind === 'none' ? [] : matches.candidates.map(({ row, difference }) => ({ id: row.id, date: row.date, amount: row.amount, difference, currency: EURO }))
      return { date: issuedOn, total: totalOn, fromCode: qr !== null, match: matches.kind, candidates }
    },
  }
}

/** One line of the bank set-up list as the chat reads it. */
interface BankAccountLine {
  readonly id: string
  /** The bank's name at Enable Banking. */
  readonly bank: string
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
  readonly takesSources: string | null
  readonly bankBalance: AccountMoney | null
  readonly fixedOpening: AccountMoney | null
  readonly unlistedPending: AccountMoney | null
}

/**
 * The kinds that stay out of the chat's reach with why: a setting's value can route bank data or is an identifier, and the
 * catalogue already says what each setting means. A bank row on hold and a payment the bank dropped are answered on To review, which the chat has no action for.
 * A line of a file from before items is read as the item it makes. A bank link is set up and linked again only on Settings, Bank sync, which the chat has no action for.
 */
export const UNREAD_KINDS: readonly string[] = [SETTING_RECORDS.name, HELD_ROW_RECORDS.name, DROPPED_ROW_RECORDS.name, LINE_RECORDS.name, BANK_LINK_RECORDS.name]

const ACCOUNT_FIELDS: FieldDocs<Account> = {
  id: { exposure: 'ref', to: ACCOUNT_RECORDS.name, meaning: 'The account.' },
  name: { exposure: 'plain', meaning: 'The name the owner gave it.' },
  kind: { exposure: 'plain', meaning: 'bank, cash or savings.' },
  bank: { exposure: 'free-text', meaning: "The bank's name as the owner or a statement file wrote it, such as Revolut, or empty for none." },
  currency: { exposure: 'plain', meaning: 'Its one currency.' },
  opening: { exposure: 'plain', amount: 'account', sign: 'either', meaning: 'What it held at the start of openedOn.' },
  openedOn: { exposure: 'plain', meaning: 'The day its figures start.' },
  iban: { exposure: 'identifier', meaning: "The account's own IBAN." },
  cards: {
    exposure: 'plain',
    meaning: 'The last four digits of each card that pays from it. A row on another account that names one, such as Top-Up by *3670, pairs with this account as a transfer.',
  },
  sources: {
    exposure: 'plain',
    read: (account) => periodsText(account.sources),
    meaning:
      "Where its new rows come from, in order, each later one with the day it takes over, such as provider-file, bank-link 2026-06-01, the first from openedOn: bank-link when the bank sync brings them, provider-file when the bank's statement file does, or by-hand when typing and the chat do. A day of bank-link or provider-file takes no typed, copied or receipt's row. Cash is always by-hand.",
  },
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
      'spending, income, saving, transfer, company, repayment, a bank loan principal paid back, informal-loan, money lent to, borrowed from or paid back between you and a person, asset, money paid for something the person bought to own, such as a car or a flat, or shared-cost, the parts a shared cost holds, which its shared cost counts. Only spending and income count as such in the figures.',
  },
  parent: { exposure: 'ref', to: CATEGORY_RECORDS.name, meaning: 'The group it sits in, or none for a group.' },
  order: { exposure: 'plain', meaning: 'Its place among its siblings.' },
  colour: { exposure: 'never', meaning: 'Its colour on screen.' },
  hidden: { exposure: 'plain', meaning: 'Hidden from the pickers, while its rows keep counting.' },
  role: {
    exposure: 'plain',
    meaning:
      'bank-fees where a statement files its fees, loan-interest where a linked instalment files its interest, salary, rental-income, profit-payout or travel-allowance where a linked payment from your company files that money, or empty for a category Kuna does not fill.',
  },
}

/** What a part's link names, as the chat reads it, or null for a part with none. An asset's link reads as its purchase when the part is under Bought assets. */
function linkRead(item: TransactionItem, targetsOf: (app: string) => AppTargets<LinkTarget>, sourceOf: (app: string) => TargetSource, categories: readonly Category[]): string | null {
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
      case 'owner-payment':
        return words.reads.linkCompanyPayment(target.parts.map((part) => part.kind).join(', '), target.day, target.direction === 'to-owner')
      case 'owner-advance':
        return words.reads.linkCompanyAdvance(target.categoryName, target.day)
      case 'cash-movement':
        return words.reads.linkCashMovement(target.accountName, target.day, target.movement === 'deposit')
      case 'asset':
        return words.reads.linkAsset[assetUseOf(target, item, filedAsBought([item], categories))](target.name)
    }
  }
  if (sourceOf(item.link.app) === 'assets') {
    return { gone: words.reads.linkAssetsGone, opening: words.reads.linkAssetsUnknown, failed: words.reads.linkAssetsUnknown, 'not-set-up': words.reads.linkAssetsNotSetUp }[read.state]
  }
  if (sourceOf(item.link.app) === 'investments') {
    return { gone: words.reads.linkInvestmentsGone, opening: words.reads.linkInvestmentsUnknown, failed: words.reads.linkInvestmentsUnknown, 'not-set-up': words.reads.linkInvestmentsNotSetUp }[
      read.state
    ]
  }
  if (sourceOf(item.link.app) === 'company') {
    return { gone: words.reads.linkCompanyGone, opening: words.reads.linkCompanyUnknown, failed: words.reads.linkCompanyUnknown, 'not-set-up': words.reads.linkCompanyNotSetUp }[read.state]
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
  pending: { exposure: 'plain', meaning: 'The bank has not booked it yet. Its day and amount may still change.' },
}

const BUDGET_FIELDS: FieldDocs<Budget> = {
  id: { exposure: 'ref', to: BUDGET_RECORDS.name, meaning: 'The limit.' },
  category: { exposure: 'ref', to: CATEGORY_RECORDS.name, meaning: 'The spending category it limits.' },
  from: { exposure: 'plain', meaning: 'The month it starts, until a later one of the category.' },
  amount: { exposure: 'plain', amount: 'app', sign: 'zero-or-more', meaning: 'Euros a month, or due each year with due. Zero ends the limit.' },
  due: { exposure: 'plain', meaning: 'A yearly cost: the first month it falls due, then every 12 months. Absent on a monthly limit.' },
}

/** What the bank loan a rule's rows pay reads as, or null for a rule that names none. */
function paidLoanRead(rule: SpendingRule, targetsOf: (app: string) => AppTargets<LinkTarget>): string | null {
  if (rule.link === null) return null
  const loans = targetsOf(rule.link.app)
  if (loans === null) return words.reads.linkNotSetUp
  if (typeof loans === 'string') return words.reads.linkUnknown
  const { link } = rule
  const asset = loans.find((target) => target.kind === 'asset' && sameRecord(target.link, link))
  if (asset?.kind === 'asset') return words.reads.linkRuleAsset(asset.name)
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

const RECIPE_FIELDS: FieldDocs<SavedRecipe> = {
  id: { exposure: 'ref', to: RECIPE_RECORDS.name, meaning: 'The recipe.' },
  bank: { exposure: 'free-text', meaning: 'The bank whose accounts take the rows, as Accounts names it.' },
  currency: { exposure: 'plain', meaning: "Every row's currency, or empty where a column names each row's own." },
  recipe: {
    exposure: 'free-text',
    meaning: 'How it reads a file, as change-recipe takes it, or empty for one that change-recipe cannot write.',
    read: (saved) => {
      const draft = draftOfRecipe(saved.recipe, STATEMENT_RECIPE_FIELDS)
      return draft === null ? null : JSON.stringify(inputOfDraft(draft, STATEMENT_RECIPE_FIELDS))
    },
  },
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

const itemFields = (
  targetsOf: (app: string) => AppTargets<LinkTarget>,
  sourceOf: (app: string) => TargetSource,
  events: () => readonly SpendingEvent[],
  categories: () => readonly Category[],
): FieldDocs<TransactionItem> => ({
  id: { exposure: 'ref', to: ITEM_RECORDS.name, meaning: 'The part.' },
  transaction: { exposure: 'ref', to: TRANSACTION_RECORDS.name, meaning: "The entry it is part of, or null for a line of a receipt that waits for the bank's row." },
  receipt: { exposure: 'ref', to: RECEIPT_RECORDS.name, meaning: 'The receipt whose line it is, or null for a part split by hand and for the one part of a whole entry.' },
  printed: { exposure: 'free-text', meaning: 'As the till printed it, or empty.' },
  note: { exposure: 'free-text', meaning: "The owner's note on this money, or a receipt line's plain words, or empty." },
  amount: { exposure: 'plain', amount: 'account', sign: 'either', meaning: 'Signed as the entry is.' },
  category: { exposure: 'ref', to: CATEGORY_RECORDS.name, meaning: 'What this part of the money is filed under, or none while the entry waits on To review. The figures count it.' },
  payee: {
    exposure: 'party',
    meaning:
      "Who this part of the money counts under on the payee report and Analysis by payee, when that is not the entry's payee, or empty for the entry's payee. The entry's payee stays who was paid.",
  },
  sharedCost: {
    exposure: 'ref',
    to: SHARED_COST_RECORDS.name,
    meaning: 'The shared cost this money is part of, or none. A part in one sits under In a shared cost and counts nowhere, since its shared cost counts its money.',
  },
  link: {
    exposure: 'free-text',
    meaning: 'The record in another app this money is, such as the loan instalment it pays, or empty. It changes no figure: the part counts by its category.',
    read: (item) => linkRead(item, targetsOf, sourceOf, categories()),
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
    ...keptFigures(book, rates, month),
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
      const figures = [
        euros(`${name}: ${limit.yearly === undefined ? 'limit' : 'set aside'}`, limit.limit),
        euros(`${name}: carried in`, limit.carriedIn),
        euros(`${name}: spent`, limit.spent),
        euros(`${name}: left`, limit.left),
      ]
      if (limit.yearly === undefined) return figures
      return [...figures, euros(`${name}: ${limit.yearly.paidEarly ? 'paid early, due in' : 'due in'} ${limit.yearly.due}`, limit.yearly.amount)]
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

/** What each label counts over its entries up to the day, as Entries filtered to the label counts it, which is as Spending counts its months. */
function labelsReport(book: SpendingBook, rates: RateBook, period: string | null): readonly ReportFigure[] {
  const day = period === null ? today() : parseCivilDate(period)
  if (day === null) throw new RangeError('Not a day.')
  const names = new Map(book.categories.map((category) => [category.id, category.name]))
  const rows = countedRows(book, rates).filter((row) => row.day <= day)
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
  const rows = countedRows(book, rates).filter((row) => row.day <= day)
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
    countedRows(book, rates).filter((row) => counted(row.day)),
    book.categories,
    book,
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

/** A shared cost as the chat reads it, with how many parts it holds and what it counts now. */
interface SharedCostLine extends SharedCost {
  readonly members: number
  readonly counts: Money | null
}

const sharedCostFields = (events: () => readonly SpendingEvent[]): FieldDocs<SharedCostLine> => ({
  id: { exposure: 'ref', to: SHARED_COST_RECORDS.name, meaning: 'The shared cost.' },
  day: { exposure: 'plain', meaning: 'The day it counts on, whatever the days of its parts, so a repayment in a later month lowers this month.' },
  payee: { exposure: 'party', meaning: 'Who it counts under on the payee report and Analysis by payee, or empty for none. Its parts count under nobody.' },
  category: { exposure: 'ref', to: CATEGORY_RECORDS.name, meaning: 'The spending or income category it counts under.' },
  labels: { exposure: 'ref', to: LABEL_RECORDS.name, list: true, meaning: 'The labels it carries.' },
  event: {
    exposure: 'plain',
    meaning: 'by-days when it joins the event its day falls in, out when taken out of every event, or the event it was put in by hand.',
    read: (sharedCost) => eventRead(sharedCost.event, events()),
  },
  note: { exposure: 'free-text', meaning: "The owner's note, or empty." },
  settled: { exposure: 'plain', meaning: 'yes once nobody owes anything more on it. It changes nothing it counts.' },
  members: { exposure: 'plain', meaning: 'How many parts of entries it holds: what was paid and what was paid back.' },
  counts: {
    exposure: 'plain',
    amount: 'app',
    sign: 'either',
    meaning: "What it counts now in euros: its parts added up, each at its own day's rate, below zero for money out. Unknown while a rate is missing.",
  },
})

/** Every shared cost with what it counts, as the figures count it. */
function sharedCostLines(book: SpendingBook, rates: RateBook): readonly SharedCostLine[] {
  const counts = sharedCostCounts(book, rates)
  return book.sharedCosts.map((sharedCost) => ({
    ...sharedCost,
    members: book.items.filter((item) => item.sharedCost === sharedCost.id).length,
    counts: counts.get(sharedCost.id)?.parts[0]?.euros ?? null,
  }))
}

/** One payee as the chat reads it: what their entries count, with the details you keep of them where you keep any. */
interface PayeeLine {
  readonly id: string
  readonly name: string
  readonly otherNames: readonly string[]
  readonly party: PayeeParty | null
  readonly ibans: readonly string[]
  readonly taxId: string
  readonly website: string
  readonly note: string
  readonly entries: number
  readonly newestDay: CivilDate | null
  readonly usualOut: RecordId | null
  readonly usualIn: RecordId | null
}

/** The payees of the book, as the Payees tab lists them, and each payee you keep details of. */
export const PAYEE_LINES: Pick<RecordKind, 'name' | 'noun'> = { name: PAYEE_RECORDS.name, noun: PAYEE_RECORDS.noun }

const PAYEE_FIELDS: FieldDocs<PayeeLine> = {
  id: { exposure: 'ref', to: PAYEE_LINES.name, meaning: 'The payee, which the payee operations take.' },
  name: { exposure: 'party', meaning: 'The name the payee shows under: the first of the names you keep, or as their newest entry spells it.' },
  otherNames: { exposure: 'party', meaning: 'Every other spelling of the payee. An entry spelt any of these ways counts under this payee.' },
  party: { exposure: 'plain', meaning: 'person, business, or null when not said. A person goes to the chat under an alias.' },
  ibans: {
    exposure: 'identifier',
    meaning:
      "The IBANs you added to the payee first, then those the payee's bank rows carry, newest first. An entry from an IBAN you added counts under this payee, unless its payee is named as another one.",
  },
  taxId: { exposure: 'identifier', meaning: 'An OIB or a foreign VAT number, or empty.' },
  website: { exposure: 'free-text', meaning: 'Or empty.' },
  note: { exposure: 'free-text', meaning: 'Or empty.' },
  entries: { exposure: 'plain', meaning: 'How many entries under a spending or an income category count under the payee, of all time.' },
  newestDay: { exposure: 'plain', meaning: 'The day of their newest such entry.' },
  usualOut: { exposure: 'ref', to: CATEGORY_RECORDS.name, meaning: "The category the payee's money out usually goes under, which the entry dialog fills in, or none." },
  usualIn: { exposure: 'ref', to: CATEGORY_RECORDS.name, meaning: "The category the payee's money in usually goes under, or none." },
}

/** Every payee of all time, with the categories their entries usually go under, then each payee you keep details of who has no such entry. */
function payeeLines(book: SpendingBook, rates: RateBook): readonly PayeeLine[] {
  const [usualOut, usualIn] = [usualCategories(book, 'out'), usualCategories(book, 'in')]
  const totals = payeeTotals(countedRows(book, rates), book.categories, book)
  const recordOf = (key: string): Payee | undefined => book.payees.find((payee) => keyOfPayee(payee) === key)
  const details = (record: Payee | undefined) => ({
    otherNames: record?.names.slice(1) ?? [],
    party: record?.party ?? null,
    taxId: record?.taxId ?? '',
    website: record?.website ?? '',
    note: record?.note ?? '',
  })
  return [
    ...totals.map((payee) => ({
      id: payee.key,
      name: payee.name,
      ...details(recordOf(payee.key)),
      ibans: payee.ibans,
      entries: payee.rows,
      newestDay: payee.latest,
      usualOut: usualOut.get(payee.key) ?? null,
      usualIn: usualIn.get(payee.key) ?? null,
    })),
    ...book.payees
      .filter((record) => !totals.some((payee) => payee.key === keyOfPayee(record)))
      .map((record) => ({ id: keyOfPayee(record), name: record.names[0] ?? '', ...details(record), ibans: record.ibans, entries: 0, newestDay: null, usualOut: null, usualIn: null })),
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
  takesSources: {
    exposure: 'plain',
    meaning: 'The sources update gives an account kept by hand, with the bank link from the day after its newest row. keep-mine keeps it by hand and stops the offer.',
  },
  bankBalance: { exposure: 'plain', amount: 'account', sign: 'either', meaning: "The bank's balance at the fetch, when it differs from Kuna's." },
  fixedOpening: {
    exposure: 'plain',
    amount: 'account',
    sign: 'either',
    meaning: "The opening fix-opening sets so Kuna's balance agrees with the bank's, when they differ.",
  },
  unlistedPending: {
    exposure: 'plain',
    amount: 'account',
    sign: 'either',
    meaning: 'What the bank holds as not booked yet without listing it as a row, at the fetch. It comes in once it books. None when the bank lists everything it holds.',
  },
}

/** Whether a new account can take its rows from a bank link, as one line for the chat. The key itself stays with the person. */
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
    meaning:
      'Whether an Enable Banking application is set up for the bank sync, so a new bank or savings account can take its rows from bank-link. Without it, add-account takes by-hand or provider-file.',
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
      takesSources: update === null || account === null || periodsText(update.sources) === periodsText(account.sources) ? null : periodsText(update.sources),
      bankBalance: difference?.stated ?? null,
      fixedOpening: difference?.fixedOpening ?? null,
      unlistedPending: account === null ? null : (setup.stated.find((stated) => stated.account.id === account.id)?.unlisted ?? null),
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
  /** Tells whether a part is linked to an employee's pay in a company app, which keeps it and its entry on this device while Anonymise is on. It reads each app's records once, however many parts it checks. */
  const payCheck = (): ((item: TransactionItem) => boolean) => {
    const companies = new Map<string, { readonly targets: AppTargets<LinkTarget> } | null>()
    const companyOf = (app: string): { readonly targets: AppTargets<LinkTarget> } | null => {
      if (!companies.has(app)) companies.set(app, reading.linkSource(app) === 'company' ? { targets: reading.linkTargets(app) } : null)
      return companies.get(app) ?? null
    }
    return (item) => {
      if (item.link === null) return false
      const company = companyOf(item.link.app)
      return company !== null && isPayLink(linkStateOf(item.link, company.targets))
    }
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
        payCheck: () => {
          const book = reading.book()
          const isPay = payCheck()
          return (row) => book !== null && itemsOf(book, row).some(isPay)
        },
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
      readableKind<SavedRecipe>({ kind: RECIPE_RECORDS, about: words.reads.recipe, fields: RECIPE_FIELDS, dated: null, rows: () => rows((book) => book.recipes), currencyOf: () => EURO }),
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
        fields: itemFields(
          reading.linkTargets,
          reading.linkSource,
          () => reading.book()?.events ?? [],
          () => reading.book()?.categories ?? [],
        ),
        dated: null,
        rows: () => rows((book) => [...book.transactions.flatMap((row) => itemsOf(book, row)), ...book.items.filter((line) => line.transaction === null)]),
        currencyOf: (line) => accountCurrency(rows((book) => book.transactions).find((row) => row.id === line.transaction)?.account ?? ''),
        payCheck,
      }),
      readableKind<SharedCostLine>({
        kind: SHARED_COST_RECORDS,
        about: words.reads.sharedCost,
        fields: sharedCostFields(() => reading.book()?.events ?? []),
        dated: 'day',
        rows: () => rows((book) => sharedCostLines(book, reading.rates())),
        currencyOf: () => EURO,
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
      { id: 'trends', title: words.reports.trends.title, about: words.reports.trends.about, period: 'month', figures: report(ANALYSIS_REPORTS.trends) },
      { id: 'year', title: words.reports.year.title, about: words.reports.year.about, period: 'month', figures: report(ANALYSIS_REPORTS.year) },
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
    ownIbans: () => rows((book) => book.accounts.map((account) => normaliseIban(account.iban)).filter((iban) => iban !== '')),
  }
}
