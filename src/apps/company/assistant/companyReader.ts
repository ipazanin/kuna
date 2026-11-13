import { latestBalances } from '../cash/domain/balances'
import { monthPeriod } from '../filters/domain/drillTarget'
import { DEFAULT_FILTERS, transactionsInPeriod } from '../filters/domain/filterState'
import { ownerShareText } from '../owner-share/domain/ownerShare'
import { AGEING_BUCKETS, ageingOf, amountsOwed } from '../receivables/domain/ageing'
import { receivablesOf } from '../receivables/domain/invoiceMatching'
import { lineLabel, shownLines } from '../settings/domain/profitAndLossLabels'
import { categoryTotals } from '../spending/domain/categoryTotals'
import type { CategoryTotal } from '../spending/domain/categoryTotals'
import { countedLedger } from '../transactions/domain/countedLedger'
import type { CountedLedger } from '../transactions/domain/countedLedger'
import { bucketTotals } from '../workbook/domain/bucketTotals'
import type { ProfitAndLossLine } from '../workbook/domain/bucketTotals'
import { ACCOUNT_RECORDS, BILLING_RECORDS, CATEGORY_RECORDS, CLIENT_RECORDS, INVOICE_RECORDS, LEDGER_RECORDS, RULE_RECORDS, SETTING_RECORDS, SPLIT_PART_RECORDS } from '../workbook/domain/coreKinds'
import { displayName, displayNamesOf } from '../workbook/domain/displayName'
import { isHumanConfirmed, needsReview, reviewCount } from '../workbook/domain/needsReview'
import type { WorkbookRecords } from '../workbook/domain/readWorkbook'
import { rowItemsOf } from '../workbook/domain/splits'
import type { SplitPart } from '../workbook/domain/splits'
import type { Category, Transaction, Workbook } from '../workbook/domain/workbook'
import type { BillingItem } from '../workbook/domain/billingPlan'
import { readableKind } from '../../../shared/app/assistantReader'
import type { AppReader, AssistantReport, ReadableKind, ReportFigure, TraceRules } from '../../../shared/app/assistantReader'
import { parseCivilDate } from '../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../shared/calendar/civilDate'
import { addMonths, monthOf, parseMonthKey } from '../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../shared/calendar/monthKey'
import { EURO, currencyCodeOf } from '../../../shared/money/currencyCode'
import { ZERO, subtractMoney } from '../../../shared/money/money'
import type { Money } from '../../../shared/money/money'
import type { FieldDocs } from '../../../shared/privacy/domain/exposure'
import { ruleConditionValues } from './ruleConditionFields'
import type { RuleConditionValues } from './ruleConditionFields'
import { words } from './words'
import { installedPack } from '../packs/packContribution'

/** What the reader reads from, which `app.ts` hands in over the company's store, so this folder holds no store. */
export interface CompanyReading {
  status(): ReturnType<AppReader['status']>
  /** The workbook as read, whatever a screen filters. */
  workbook(): Workbook | null
  /** The records of every kind, the pack's among them. */
  records(): WorkbookRecords | null
}

/** What a pack adds to what the chat reads of the company: its kinds, its settings keys, its reports, and the rules behind its build-ups. */
export interface PackReader {
  readonly kinds: readonly ReadableKind[]
  /** The pack's settings keys whose values the chat reads. */
  readonly settingKeys: ReadonlySet<string>
  readonly reports: readonly AssistantReport[]
  readonly traceRules?: TraceRules
  /** Whether a category is a cost of paying the owner or an employee, whose figures only a report marked as holding employees' pay gives. */
  readonly ownerPayCost: (category: Category) => boolean
}

/**
 * The settings keys the chat reads, by their value: the names, the labels, the switches, the billing terms and what an
 * invoice prints. A setting that routes mail or files, names the people kept under an alias, or is the owner's own review
 * label never leaves, nor does the IBAN invoices print, which a proposal names only as a warned field.
 */
const READ_SETTING_KEYS: ReadonlySet<string> = new Set([
  'company_name',
  'owner_pay_module',
  'card_settlement_ibans',
  'currency',
  'number_locale',
  'label_income',
  'label_operating',
  'label_taxes',
  'label_owner_pay',
  'label_financing',
  'label_neutral',
  'billing_monthly_amount',
  'billing_monthly_item',
  'billing_subscription_amount',
  'billing_subscription_item',
  'billing_bonus_amount',
  'billing_bonus_item',
  'billing_client',
  'invoice_company_name',
  'invoice_address',
  'invoice_country',
  'invoice_oib',
  'invoice_phone',
  'invoice_swift',
  'invoice_bank',
  'invoice_court_register',
  'invoice_share_capital',
  'invoice_place',
  'invoice_issue_time',
  'invoice_signatory',
  'invoice_signatory_title',
  'invoice_number_pattern',
  'invoice_reverse_charge_note',
])

/** The settings that are a switch, read as written. */
const SWITCH_SETTING_KEYS: ReadonlySet<string> = new Set(['owner_pay_module'])
/** The settings that hold IBANs or a tax number, comma separated, each read as an identifier. */
const IDENTIFIER_SETTING_KEYS: ReadonlySet<string> = new Set(['card_settlement_ibans', 'invoice_oib'])

/** A ledger row as the chat reads it: who set its category in Kuna's words, never the review label, and its codes joined. */
interface LedgerRowView {
  readonly id: string
  readonly account: string
  readonly date: string
  readonly amount: Money
  readonly balance: Money
  readonly counterparty: string
  readonly counterpartyIban: string
  readonly description: string
  readonly reference: string
  readonly statement: string
  readonly category: string
  readonly family: string
  readonly bucket: string
  readonly filedBy: string
  readonly waits: boolean
  readonly reviewReasons: string
  readonly signals: string
  readonly ownerShare: string
}

/** An item of a ledger row as the chat reads it, with the row whose money it is. */
interface SplitPartView {
  readonly id: string
  readonly row: string
  readonly amount: Money
  readonly category: string
  readonly family: string
  readonly bucket: string
  readonly note: string
  readonly ownerShare: string
}

interface CategoryView {
  readonly id: string
  readonly label: string
  readonly family: string
  readonly bucket: string
  readonly roles: string
  readonly vat: string
  readonly ownerShare: string
}

interface AccountView {
  readonly id: string
  readonly label: string
  readonly currency: string
  readonly iban: string
}

/** A rule as the chat reads it, with each condition under the name add-rule and change-rule give it, so a payee's name goes as a party. */
type RuleView = RuleConditionValues & {
  readonly id: string
  readonly order: number
  readonly enabled: boolean
  readonly confidence: string
  readonly category: string
  readonly note: string
}

interface ClientView {
  readonly id: string
  readonly name: string
  readonly ibans: readonly string[]
  readonly address: string
  readonly country: string
  readonly taxId: string
  readonly invoiceMail: string
  readonly mailLanguage: string
  readonly reverseCharge: boolean
}

interface InvoiceView {
  readonly id: string
  readonly number: string
  readonly client: string
  readonly item: string
  readonly amount: Money
  readonly issued: string
  readonly due: string
  readonly deliveryPeriod: string
}

/** A setting as the chat reads it, its value in the one field that classes it. */
interface SettingView {
  readonly id: string
  readonly key: string
  readonly value: string
  readonly switch: string
  readonly identifiers: readonly string[]
}

const LEDGER_FIELDS: FieldDocs<LedgerRowView> = {
  id: { exposure: 'ref', to: LEDGER_RECORDS.name, meaning: 'The ledger row.' },
  account: { exposure: 'ref', to: ACCOUNT_RECORDS.name, meaning: 'The account it was booked on.' },
  date: { exposure: 'plain', meaning: 'The day the bank booked it.' },
  amount: { exposure: 'plain', amount: 'app', sign: 'either', meaning: "Money in above zero, money out below, in the books' currency." },
  balance: { exposure: 'plain', amount: 'app', sign: 'either', meaning: "The account's balance after it." },
  counterparty: { exposure: 'party', meaning: 'The other side of the payment. An alias for a person Kuna knows, a company as it is.' },
  counterpartyIban: { exposure: 'identifier', meaning: "The other side's IBAN." },
  description: { exposure: 'free-text', meaning: "The bank's text for the row." },
  reference: { exposure: 'free-text', meaning: 'The payment reference.' },
  statement: { exposure: 'free-text', meaning: 'The statement that brought it.' },
  category: { exposure: 'ref', to: CATEGORY_RECORDS.name, meaning: 'Its category, or none while it waits.' },
  family: { exposure: 'plain', meaning: "Its category's family." },
  bucket: { exposure: 'plain', meaning: 'Where profit and loss counts it: income, operating, taxes, owner-pay, financing, neutral or unclassified.' },
  filedBy: {
    exposure: 'plain',
    meaning:
      'person or rule for who settled its category. no-rule when no rule settled it, so it waits on To review: no rule matched it, or the rule that matched only suggests a category. No AI filed it. Empty when nothing has filed it yet.',
  },
  waits: { exposure: 'plain', meaning: 'It waits on To review.' },
  reviewReasons: { exposure: 'plain', meaning: 'Why the statement wants a person to look at it, such as reversal.' },
  signals: { exposure: 'plain', meaning: "The bank's codes for the row." },
  ownerShare: { exposure: 'plain', meaning: "The owner's private share of it in percent, or empty for none." },
}

const SPLIT_PART_FIELDS: FieldDocs<SplitPartView> = {
  id: { exposure: 'ref', to: SPLIT_PART_RECORDS.name, meaning: 'The part.' },
  row: { exposure: 'ref', to: LEDGER_RECORDS.name, meaning: 'The ledger row whose money it is. A row not split is one part, and a split row counts as its parts.' },
  amount: { exposure: 'plain', amount: 'app', sign: 'either', meaning: 'What of the row counts in its category, signed as the row is.' },
  category: { exposure: 'ref', to: CATEGORY_RECORDS.name, meaning: 'Its category.' },
  family: { exposure: 'plain', meaning: "Its category's family." },
  bucket: { exposure: 'plain', meaning: 'Where profit and loss counts it.' },
  note: { exposure: 'free-text', meaning: "The person's note on the part, or empty, as it always is on the one part of a row not split." },
  ownerShare: { exposure: 'plain', meaning: "The owner's private share of it in percent, or empty for none." },
}

const CATEGORY_FIELDS: FieldDocs<CategoryView> = {
  id: { exposure: 'ref', to: CATEGORY_RECORDS.name, meaning: 'The category, by its short name.' },
  label: { exposure: 'plain', meaning: 'What the screens call it.' },
  family: { exposure: 'plain', meaning: 'The family it belongs to.' },
  bucket: { exposure: 'plain', meaning: 'Where profit and loss counts it.' },
  roles: { exposure: 'plain', meaning: 'What the figures select it for, such as revenue or its tax class.' },
  vat: { exposure: 'plain', meaning: 'How a purchase in it splits into cost and VAT.' },
  ownerShare: {
    exposure: 'plain',
    meaning:
      "The owner's private share a row filed in it takes, in percent, or empty for none. Only the business share's VAT is deducted, and the VAT on the private share, the reverse charge's included, counts in the owner's part.",
  },
}

const ACCOUNT_FIELDS: FieldDocs<AccountView> = {
  id: { exposure: 'ref', to: ACCOUNT_RECORDS.name, meaning: 'The account, by its short name.' },
  label: { exposure: 'plain', meaning: 'What the screens call it.' },
  currency: { exposure: 'plain', meaning: "Its currency, or empty for the books' own." },
  iban: { exposure: 'identifier', meaning: "The account's own IBAN." },
}

const RULE_FIELDS: FieldDocs<RuleView> = {
  id: { exposure: 'ref', to: RULE_RECORDS.name, meaning: 'The rule.' },
  order: { exposure: 'plain', meaning: 'The first enabled rule that holds decides a row.' },
  enabled: { exposure: 'plain', meaning: 'Switched on.' },
  confidence: { exposure: 'plain', meaning: 'rule files the row, review files it and leaves it waiting on To review.' },
  category: { exposure: 'ref', to: CATEGORY_RECORDS.name, meaning: 'The category it files into.' },
  note: { exposure: 'free-text', meaning: "The owner's note on it." },
  payeeWords: { exposure: 'party', meaning: "Words the other side's name must hold." },
  descriptionWords: { exposure: 'free-text', meaning: 'Words the description must hold.' },
  descriptionStart: { exposure: 'free-text', meaning: 'Words the description must start with.' },
  iban: { exposure: 'identifier', meaning: "The other side's IBAN it must have." },
  ibanPresent: { exposure: 'plain', meaning: 'yes when the other side must have an IBAN, no when it must have none, empty for either.' },
  direction: { exposure: 'plain', meaning: 'in for money in, out for money out, empty for either way.' },
  ownAccount: { exposure: 'plain', meaning: "The other side must be one of the company's own accounts." },
  client: { exposure: 'plain', meaning: 'The other side must be a client.' },
  card: { exposure: 'plain', meaning: 'The row must be a card purchase.' },
  foreignCurrency: { exposure: 'plain', meaning: 'The row must be in a foreign currency.' },
  domain: { exposure: 'plain', meaning: "The bank's domain code it must have." },
  family: { exposure: 'plain', meaning: "The bank's family code it must have." },
  subFamily: { exposure: 'plain', meaning: "The bank's sub-family code it must have." },
  purpose: { exposure: 'plain', meaning: 'The purpose code it must have.' },
  revenueCode: { exposure: 'plain', meaning: 'The revenue code it must have.' },
}

const CLIENT_FIELDS: FieldDocs<ClientView> = {
  id: { exposure: 'ref', to: CLIENT_RECORDS.name, meaning: 'The client, by its short name.' },
  name: { exposure: 'party', meaning: "The client's name." },
  ibans: { exposure: 'identifier', meaning: 'The accounts its payments come from.' },
  address: { exposure: 'free-text', meaning: 'The address an invoice prints.' },
  country: { exposure: 'plain', meaning: 'Its country.' },
  taxId: { exposure: 'identifier', meaning: 'Its VAT or tax id.' },
  invoiceMail: { exposure: 'never', meaning: 'Who the invoice mail goes to.' },
  mailLanguage: { exposure: 'plain', meaning: 'The language of the invoice mail.' },
  reverseCharge: { exposure: 'plain', meaning: 'The client accounts for the VAT, so the invoice carries none.' },
}

const INVOICE_FIELDS: FieldDocs<InvoiceView> = {
  id: { exposure: 'ref', to: INVOICE_RECORDS.name, meaning: 'The invoice.' },
  number: { exposure: 'plain', meaning: 'Its number.' },
  client: { exposure: 'ref', to: CLIENT_RECORDS.name, meaning: 'The client it was issued to.' },
  item: { exposure: 'free-text', meaning: 'What it bills.' },
  amount: { exposure: 'plain', amount: 'app', sign: 'either', meaning: 'Its total.' },
  issued: { exposure: 'plain', meaning: 'The day it was issued.' },
  due: { exposure: 'plain', meaning: 'The day it is due, or empty.' },
  deliveryPeriod: { exposure: 'plain', meaning: 'The days the work was delivered in, or empty when the issue day stands for it.' },
}

const BILLING_FIELDS: FieldDocs<BillingItem> = {
  id: { exposure: 'ref', to: BILLING_RECORDS.name, meaning: 'The plan row.' },
  item: { exposure: 'free-text', meaning: 'The kind of item, such as the monthly fee.' },
  date: { exposure: 'plain', meaning: 'The day it becomes billable.' },
  amount: { exposure: 'plain', amount: 'app', sign: 'either', meaning: 'What it bills.' },
  client: { exposure: 'ref', to: CLIENT_RECORDS.name, meaning: 'The client it bills.' },
  description: { exposure: 'free-text', meaning: 'What the invoice says about it.' },
}

const SETTING_FIELDS: FieldDocs<SettingView> = {
  id: { exposure: 'ref', to: SETTING_RECORDS.name, meaning: 'The setting.' },
  key: { exposure: 'plain', meaning: 'Its key, which the catalogue explains.' },
  value: { exposure: 'free-text', meaning: 'What it holds, as written, or empty for a switch or one that holds identifiers.' },
  switch: { exposure: 'plain', meaning: 'TRUE or FALSE on a setting that is a switch, else empty.' },
  identifiers: { exposure: 'identifier', meaning: 'The IBANs or the tax number a setting holds, else none.' },
}

function settingOf(key: string, value: string): SettingView {
  const setting = { id: key, key, value: '', switch: '', identifiers: [] }
  if (SWITCH_SETTING_KEYS.has(key)) return { ...setting, switch: value.trim() }
  if (IDENTIFIER_SETTING_KEYS.has(key)) return { ...setting, identifiers: value.split(',').flatMap((part) => (part.trim() === '' ? [] : [part.trim()])) }
  return { ...setting, value }
}

/** Who settled a row's category as the chat reads it. The categoriser's `ai` means no rule settled it, so it reads as no-rule. */
function filedByOf(flaggedBy: string): string {
  if (flaggedBy === '') return ''
  if (isHumanConfirmed({ flaggedBy })) return 'person'
  return flaggedBy === 'ai' ? 'no-rule' : 'rule'
}

function ledgerRowOf(row: Workbook['transactions'][number]): LedgerRowView {
  return {
    id: row.id,
    account: row.account,
    date: row.date,
    amount: row.amount,
    balance: row.balance,
    counterparty: row.counterparty,
    counterpartyIban: row.counterpartyIban,
    description: row.description,
    reference: row.reference,
    statement: row.statement,
    category: row.category,
    family: row.family,
    bucket: row.bucket,
    filedBy: filedByOf(row.flaggedBy),
    waits: needsReview(row),
    reviewReasons: row.reviewReasons.join(', '),
    signals: Object.values(row.signals)
      .filter((code) => code !== '')
      .join(', '),
    ownerShare: ownerShareText(row.ownerShare) ?? '',
  }
}

function splitPartOf(row: Transaction, part: SplitPart): SplitPartView {
  return {
    id: part.id,
    row: row.id,
    amount: part.amount,
    category: part.category,
    family: part.family,
    bucket: part.bucket,
    note: part.note,
    ownerShare: ownerShareText(part.ownerShare) ?? '',
  }
}

function ruleOf(rule: Workbook['rules'][number]): RuleView {
  return {
    id: rule.id,
    order: rule.order,
    enabled: rule.enabled,
    confidence: rule.confidence,
    category: rule.category,
    note: rule.note,
    ...ruleConditionValues(rule.conditions),
  }
}

/** The books' currency, which every amount of the company is in. */
function currencyOf(workbook: Workbook) {
  return currencyCodeOf(workbook.settings.currency) ?? EURO
}

function monthOfPeriod(period: string | null, newest: CivilDate): MonthKey {
  const month = period === null ? monthOf(newest) : parseMonthKey(period)
  if (month === null) throw new RangeError('Not a month.')
  return month
}

function dayOfPeriod(period: string | null, newest: CivilDate): CivilDate {
  const day = period === null ? newest : parseCivilDate(period)
  if (day === null) throw new RangeError('Not a day.')
  return day
}

/**
 * The profit and loss lines that hold no pay: income, and operating cost while the owner-pay module keeps owner pay out
 * of it. Taxes hold the taxes on pay, and every other line holds pay or what it completes.
 */
function payFreeLines(workbook: Workbook): readonly ProfitAndLossLine[] {
  return workbook.settings.ownerPayModule ? ['income', 'operating'] : ['income']
}

/** The categories whose figures hold pay, by their short names. */
function payCategories(workbook: Workbook, ownerPayCost: (category: Category) => boolean): ReadonlySet<string> {
  return new Set(workbook.categories.filter(ownerPayCost).map((category) => category.slug))
}

/** What a report reads: the workbook, the books as the screens count them with no filter, and the categories whose figures hold pay. */
interface ReportBooks {
  readonly workbook: Workbook
  readonly ledger: CountedLedger
  readonly pay: ReadonlySet<string>
}

function linesOfMonth(workbook: Workbook, ledger: CountedLedger, lines: readonly ProfitAndLossLine[], period: string | null): ReportFigure[] {
  const month = monthOfPeriod(period, ledger.window.newestDay)
  const totals = bucketTotals(transactionsInPeriod(ledger.profitAndLossRows, monthPeriod(month), ledger.window))
  const currency = currencyOf(workbook)
  return lines.map((line) => ({ label: lineLabel(workbook.settings, line), of: 'app', cents: totals[line], currency }))
}

function monthReport({ workbook, ledger }: ReportBooks, period: string | null): readonly ReportFigure[] {
  return [...linesOfMonth(workbook, ledger, payFreeLines(workbook), period), { label: 'rows waiting on To review, of any month', count: reviewCount(workbook.transactions) }]
}

function profitReport({ workbook, ledger, pay }: ReportBooks, period: string | null): readonly ReportFigure[] {
  const payFree = payFreeLines(workbook)
  const names = displayNamesOf(workbook)
  const currency = currencyOf(workbook)
  const month = monthOfPeriod(period, ledger.window.newestDay)
  const payTotals = categoryTotals(ledger.profitAndLossRows, monthPeriod(month), ledger.window).filter((total) => pay.has(total.category))
  return [
    ...linesOfMonth(
      workbook,
      ledger,
      shownLines(workbook.settings).filter((line) => !payFree.includes(line)),
      period,
    ),
    ...payTotals.map((total): ReportFigure => ({ label: names.category(total.category), of: 'app', cents: total.amount.amount, currency })),
  ]
}

function categoriesReport({ workbook, ledger, pay }: ReportBooks, period: string | null): readonly ReportFigure[] {
  const month = monthOfPeriod(period, ledger.window.newestDay)
  const totalsOf = (shown: MonthKey) => categoryTotals(ledger.profitAndLossRows, monthPeriod(shown), ledger.window).filter((total) => !pay.has(total.category))
  const now = totalsOf(month)
  const before = totalsOf(addMonths(month, -1))
  const amountIn = (totals: readonly CategoryTotal[], slug: string): Money => totals.find((total) => total.category === slug)?.amount.amount ?? ZERO
  const names = displayNamesOf(workbook)
  const currency = currencyOf(workbook)
  const slugs = [...new Set([...now, ...before].map((total) => total.category))]
  return slugs.flatMap((slug) => {
    const thisMonth = amountIn(now, slug)
    const monthBefore = amountIn(before, slug)
    const name = names.category(slug)
    return [
      { label: `${name}: this month`, of: 'app', cents: thisMonth, currency },
      { label: `${name}: month before`, of: 'app', cents: monthBefore, currency },
      { label: `${name}: change`, of: 'app', cents: subtractMoney(thisMonth, monthBefore), currency },
    ] satisfies ReportFigure[]
  })
}

function balancesReport({ workbook, ledger }: ReportBooks, period: string | null): readonly ReportFigure[] {
  const day = dayOfPeriod(period, ledger.window.newestDay)
  const balances = latestBalances(ledger.workbook.transactions.filter((row) => row.date <= day))
  const names = displayNamesOf(workbook)
  const currency = currencyOf(workbook)
  return [
    ...balances.accounts.map((account): ReportFigure => ({ label: names.account(account.account), of: 'app', cents: account.balance.amount, currency })),
    { label: 'all accounts', of: 'app', cents: balances.cashOnHand.amount, currency },
  ]
}

function receivablesReport({ workbook, ledger }: ReportBooks, period: string | null): readonly ReportFigure[] {
  const day = dayOfPeriod(period, ledger.window.newestDay)
  const { booked } = ledger
  const issued = booked.invoices.filter((invoice) => invoice.issued <= day)
  const matched = receivablesOf(
    booked.transactions.filter((row) => row.date <= day),
    booked.categories,
    issued,
    booked.clients,
  ).clients.flatMap((client) => client.invoices)
  const owed = amountsOwed(matched, day)
  const ageing = ageingOf(matched, day)
  const currency = currencyOf(workbook)
  return [
    { label: 'still owed', of: 'app', cents: owed.outstanding, currency },
    { label: 'overdue', of: 'app', cents: owed.overdue, currency },
    { label: 'invoices still open', count: owed.openCount },
    { label: 'invoices overdue', count: owed.overdueCount },
    ...AGEING_BUCKETS.map((bucket): ReportFigure => ({ label: `owed, ${bucket}`, of: 'app', cents: ageing[bucket], currency })),
  ]
}

/**
 * What the chat can read of the company: the ledger, its categories, accounts, rules, clients, invoices, billing plan and
 * a closed list of settings, with every field classified, then the pack's kinds. The reports call the screens' own
 * functions over every row, with no filter. Nothing here writes.
 */
export function companyReader(reading: CompanyReading, pack: PackReader | null): AppReader {
  const rows = <R>(of: (workbook: Workbook) => readonly R[]): readonly R[] => {
    const workbook = reading.workbook()
    return workbook === null ? [] : of(workbook)
  }
  const currency = () => {
    const workbook = reading.workbook()
    return workbook === null ? EURO : currencyOf(workbook)
  }
  const ownerPayCost = pack?.ownerPayCost ?? ((category: Category) => category.bucket === 'owner-pay')
  const report = (figures: (books: ReportBooks, period: string | null) => readonly ReportFigure[]) => (period: string | null) => {
    const workbook = reading.workbook()
    const ledger = workbook === null ? null : countedLedger(workbook, DEFAULT_FILTERS, installedPack().vatOnPrivateShare)
    return workbook === null || ledger === null ? [] : figures({ workbook, ledger, pay: payCategories(workbook, ownerPayCost) }, period)
  }
  const settingRows = (): readonly SettingView[] =>
    (reading.records()?.settings.records ?? []).flatMap(({ record }) => {
      const key = record.key.trim().toLowerCase()
      return READ_SETTING_KEYS.has(key) || (pack?.settingKeys.has(key) ?? false) ? [settingOf(key, record.value)] : []
    })
  return {
    status: () => reading.status(),
    kinds: [
      readableKind({
        kind: LEDGER_RECORDS,
        about: words.reads.ledgerRow,
        fields: LEDGER_FIELDS,
        dated: 'date',
        rows: () => rows((workbook) => workbook.transactions.map(ledgerRowOf)),
        currencyOf: currency,
        sets: [{ name: 'waiting', about: 'The rows waiting on To review.', holds: (row) => row.waits }],
      }),
      readableKind({
        kind: SPLIT_PART_RECORDS,
        about: words.reads.splitPart,
        fields: SPLIT_PART_FIELDS,
        dated: null,
        rows: () =>
          rows((workbook) => {
            const itemsOf = rowItemsOf(workbook.splits)
            return workbook.transactions.flatMap((row) => itemsOf(row).map((part) => splitPartOf(row, part)))
          }),
        currencyOf: currency,
      }),
      readableKind({
        kind: CATEGORY_RECORDS,
        about: words.reads.category,
        fields: CATEGORY_FIELDS,
        dated: null,
        rows: () =>
          rows((workbook) =>
            workbook.categories.map((category) => ({
              id: category.slug,
              label: displayName(category.slug, category.label),
              family: category.family,
              bucket: category.bucket,
              roles: category.roles.join(', '),
              vat: category.vat,
              ownerShare: ownerShareText(category.ownerShare) ?? '',
            })),
          ),
        currencyOf: currency,
      }),
      readableKind({
        kind: ACCOUNT_RECORDS,
        about: words.reads.account,
        fields: ACCOUNT_FIELDS,
        dated: null,
        rows: () =>
          rows((workbook) => workbook.accounts.map((account) => ({ id: account.slug, label: displayNamesOf(workbook).account(account.slug), currency: account.currency, iban: account.iban }))),
        currencyOf: currency,
      }),
      readableKind({ kind: RULE_RECORDS, about: words.reads.rule, fields: RULE_FIELDS, dated: null, rows: () => rows((workbook) => workbook.rules.map(ruleOf)), currencyOf: currency }),
      readableKind({
        kind: CLIENT_RECORDS,
        about: words.reads.client,
        fields: CLIENT_FIELDS,
        dated: null,
        rows: () =>
          rows((workbook) =>
            workbook.clients.map((client) => ({
              id: client.slug,
              name: client.name || client.slug,
              ibans: client.ibans,
              address: client.invoicing.address,
              country: client.invoicing.country,
              taxId: client.invoicing.taxId,
              invoiceMail: client.invoicing.invoiceMail,
              mailLanguage: client.invoicing.mailLanguage,
              reverseCharge: client.invoicing.reverseCharge,
            })),
          ),
        currencyOf: currency,
      }),
      readableKind({
        kind: INVOICE_RECORDS,
        about: words.reads.invoice,
        fields: INVOICE_FIELDS,
        dated: 'issued',
        rows: () =>
          rows((workbook) =>
            workbook.invoices.map((invoice) => ({
              id: invoice.id,
              number: invoice.number,
              client: invoice.client,
              item: invoice.item,
              amount: invoice.amount,
              issued: invoice.issued,
              due: invoice.due ?? '',
              deliveryPeriod: invoice.deliveryPeriod === null ? '' : `${invoice.deliveryPeriod.from} to ${invoice.deliveryPeriod.to}`,
            })),
          ),
        currencyOf: currency,
      }),
      readableKind({ kind: BILLING_RECORDS, about: words.reads.billingItem, fields: BILLING_FIELDS, dated: 'date', rows: () => rows((workbook) => workbook.billingPlan), currencyOf: currency }),
      readableKind({ kind: SETTING_RECORDS, about: words.reads.setting, fields: SETTING_FIELDS, dated: null, rows: settingRows, currencyOf: currency }),
      ...(pack?.kinds ?? []),
    ],
    reports: [
      { id: 'month', title: words.reports.month.title, about: words.reports.month.about, period: 'month', figures: report(monthReport) },
      { id: 'profit', title: words.reports.profit.title, about: words.reports.profit.about, period: 'month', employees: true, figures: report(profitReport) },
      { id: 'categories', title: words.reports.categories.title, about: words.reports.categories.about, period: 'month', figures: report(categoriesReport) },
      { id: 'balances', title: words.reports.balances.title, about: words.reports.balances.about, period: 'day', figures: report(balancesReport) },
      { id: 'receivables', title: words.reports.receivables.title, about: words.reports.receivables.about, period: 'day', figures: report(receivablesReport) },
      ...(pack?.reports ?? []),
    ],
    ...(pack?.traceRules === undefined ? {} : { traceRules: pack.traceRules }),
    bookings: {
      kind: LEDGER_RECORDS.name,
      accountKind: ACCOUNT_RECORDS.name,
      of: (account) => {
        const workbook = reading.workbook()
        if (workbook === null || !workbook.accounts.some((held) => held.slug === account)) return null
        return workbook.transactions.filter((row) => row.account === account).map((row) => ({ id: row.id, booking: row }))
      },
      onlyAccount: () => {
        const accounts = reading.workbook()?.accounts ?? []
        return accounts.length === 1 ? accounts[0]!.slug : null
      },
    },
  }
}
