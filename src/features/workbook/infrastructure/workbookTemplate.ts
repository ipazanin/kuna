import { RULE_COLUMNS } from '../../rules/domain/rule'
import { installedPack } from '../../packs/packContribution'
import { DEFAULT_SETTINGS, settingsTabEntries } from '../../settings/domain/settings'
import type { Settings } from '../../settings/domain/settings'
import type { DefinedBucket } from '../domain/bucket'
import { SUGGESTION_KINDS } from '../domain/dismissals'
import { VAT_TREATMENTS } from '../domain/vatTreatment'
import { packTabOf } from './packTabs'
import type { CellValue, CoreTab, SheetRow, WorkbookTab, WorkbookTabs } from './workbookSnapshot'

export interface TemplateColumn {
  readonly name: string
  /** The note on the header cell of the template and every export. */
  readonly note: string
}

const RULE_COLUMN_NOTES: Readonly<Record<(typeof RULE_COLUMNS)[number], string>> = {
  rule: 'A short id, used once, such as merchant-telecom. Required.',
  order: 'A number. Rules are tried from the lowest, and the first enabled one whose conditions all hold decides the row. Give each enabled rule its own order. Required.',
  enabled: 'TRUE or FALSE. A FALSE rule is kept but never tried. Required.',
  direction: 'Condition: credit for money in, debit for money out, or blank.',
  counterparty_iban: 'Condition: the counterparty IBAN, spaces and case ignored.',
  has_counterparty_iban: 'Condition: TRUE when the row must carry a counterparty IBAN, FALSE when it must not, or blank.',
  counterparty_is_own: 'Condition: TRUE when the counterparty is one of the accounts in the accounts tab, or blank.',
  counterparty_is_client: 'Condition: TRUE when the counterparty IBAN is on the clients tab, or blank.',
  counterparty_contains: 'Condition: text the counterparty contains, accents and case ignored.',
  description_contains: 'Condition: text the description contains, accents and case ignored.',
  description_starts_with: 'Condition: text the description starts with, accents and case ignored.',
  tx_domain: 'Condition: the ISO bank transaction domain code, such as PMNT.',
  tx_family: 'Condition: the ISO bank transaction family code, such as CCRD.',
  tx_sub_family: 'Condition: the ISO bank transaction sub-family code, such as CHRG.',
  purpose: 'Condition: the ISO purpose code, such as LOAN.',
  revenue_code: 'Condition: a four-digit revenue code, from the creditor reference or the head of the description. Enter it as text.',
  is_card: 'Condition: TRUE for a card purchase, or blank.',
  foreign_currency: "Condition: TRUE for a payment in a currency other than the account's, or blank.",
  category: 'What the rule files the row as, from the categories tab. A review rule may leave it blank.',
  confidence: 'rule files the row as settled. review files it as ai, so it waits for review.',
  note: 'Why the rule exists and why it sits where it does. Optional.',
}

/** The tabs whose rows have no business key of their own, so each row carries an id. */
export const TABS_WITH_IDS = ['outgoing-plan', 'owner-advances', 'assets', 'year-end', 'plan', 'splits', 'dismissed'] as const satisfies readonly WorkbookTab[]

/** The column that holds a row's id on the tabs that carry one. */
export const ID_COLUMN = 'id'

export const ID_TEMPLATE_COLUMN: TemplateColumn = {
  name: ID_COLUMN,
  note: 'A code the app gives each row so it can find the row again. Leave it as it is. On a copied row, clear it, and the app gives the copy its own.',
}

/**
 * The columns of each core tab, in the order the template and an export write them. The ledger
 * keeps the Google Sheet's own order, A to R, so an export lines up with the Sheet column for
 * column. The reader finds every column by name, so a file may order them as it likes and add its own.
 */
const TEMPLATE_COLUMNS: Readonly<Record<CoreTab, readonly TemplateColumn[]>> = {
  ledger: [
    { name: 'date', note: 'The booking date, as a date cell. Required.' },
    { name: 'account', note: 'Which of your accounts, by the name in the accounts tab. Required.' },
    { name: 'statement', note: 'The bank statement the row came from. Optional.' },
    { name: 'counterparty', note: 'Who paid or was paid. Optional, but Analysis groups by it.' },
    { name: 'counterparty_iban', note: 'Their IBAN, which groups a payee better than a name. Optional.' },
    { name: 'description', note: 'The payment description. Optional.' },
    { name: 'amount', note: 'The amount as a number, money in positive and money out negative. Required.' },
    { name: 'balance', note: "The account's balance after this row, as a number. Required." },
    { name: 'category', note: 'A category from the categories tab. A blank or unknown one waits for review.' },
    { name: 'flagged_by', note: 'Who set the category: rule, ai for a guess that waits for review, or a person.' },
    { name: 'reference', note: "The bank's own reference for the entry. Optional." },
    { name: 'purpose', note: 'The ISO purpose code a camt statement gave the entry, such as SALA. Optional.' },
    { name: 'tx_domain', note: 'The ISO bank transaction domain code from a camt statement, such as PMNT. Optional.' },
    { name: 'tx_family', note: 'The ISO bank transaction family code from a camt statement, such as ICDT. Optional.' },
    { name: 'tx_sub_family', note: 'The ISO bank transaction sub-family code from a camt statement, such as CHRG. Optional.' },
    { name: 'creditor_reference', note: 'The structured creditor reference from a camt statement. Optional.' },
    { name: 'instructed_currency', note: 'The currency the payment was instructed in, from a camt statement. Optional.' },
    { name: 'review_reasons', note: 'Why the statement wants a person to look at the row, such as reversal, separated by |. Such a row waits for review.' },
  ],
  categories: [
    { name: 'category', note: 'A short name in lower case, such as software. Each category once. Required.' },
    { name: 'family', note: 'A group for reading, such as operating or owner. Required.' },
    {
      name: 'bucket',
      note:
        'Where the category counts: income, operating, taxes, owner-pay, financing or neutral. Required. ' +
        'owner-pay belongs to the owner-pay module: with owner_pay_module FALSE it counts as operating cost. ' +
        'financing and neutral never count as income or cost.',
    },
    {
      name: 'colour',
      note:
        'The colour the app paints the category with, one of the nine swatches on Settings, Categories, such as #2a78d6 for Blue. ' +
        'Blank, or any other colour, paints it in its bucket colour.',
    },
    { name: 'roles', note: 'Optional, comma separated, such as revenue or watched, for features that pick categories by role.' },
    { name: 'label', note: 'What the screens call the category, such as Software. Optional. Blank shows the category with spaces for hyphens.' },
    {
      name: 'vat',
      note:
        `How a purchase in the category splits into cost and VAT: ${VAT_TREATMENTS.join(', ')}. Optional. Blank means none. ` +
        'deductible-25 means the bank amount holds 25% VAT that is reclaimed, so it is not a cost.',
    },
  ],
  accounts: [
    { name: 'account', note: 'A short name for one of your bank accounts, such as main. Required.' },
    { name: 'iban', note: "The account's IBAN. Optional." },
    { name: 'currency', note: 'Optional. The app counts in the currency from the settings tab and reports an account in another one.' },
    { name: 'label', note: 'What the screens call the account, such as Main account. Optional. Blank shows the account name.' },
  ],
  rules: RULE_COLUMNS.map((name) => ({ name, note: RULE_COLUMN_NOTES[name] })),
  settings: [
    { name: 'key', note: 'A setting name. The note on each key says what it does. Unknown keys are kept and reported.' },
    { name: 'value', note: 'Its value. A blank value means the default.' },
  ],
  invoices: [
    { name: 'number', note: 'The invoice number, entered as text so a number such as 1-1-26 is not read as a date. Each number once. Required.' },
    { name: 'client', note: 'Who the invoice is for, by the client name in the clients tab. Required.' },
    { name: 'item', note: 'What was invoiced. Optional.' },
    { name: 'amount', note: 'The invoice total as a number. Required.' },
    { name: 'issued', note: 'The issue date, as a date cell. Required.' },
    { name: 'due', note: 'The due date, as a date cell. Optional. Ageing counts from it, or from the issue date when it is blank.' },
    { name: 'period_from', note: 'The first day of the work the invoice is for, as a date cell. Optional, with period_to. Blank means the issue date.' },
    { name: 'period_to', note: 'The last day of the work the invoice is for, as a date cell. Optional, with period_from.' },
  ],
  clients: [
    { name: 'client', note: 'A short name in lower case, such as northwind. One row per IBAN, so a client paying from two accounts has two rows. Required.' },
    { name: 'name', note: 'What the screens call the client. Optional.' },
    { name: 'iban', note: 'An IBAN the client pays from. A payment from it counts against that client’s invoices. Required.' },
    { name: 'address', note: 'The street and town an invoice to the client prints. Fill it on one of the client’s rows, or the same on each. Needed to make an invoice.' },
    { name: 'country', note: 'The country printed under the address. Optional.' },
    { name: 'tax_id', note: 'The client’s tax or VAT ID, printed on the invoice. Optional.' },
    { name: 'invoice_mail', note: 'Who the invoice mail goes to, one address. Optional.' },
    { name: 'mail_language', note: 'The language of the month’s name in the mail, such as en or hr. Blank means English.' },
    { name: 'reverse_charge', note: 'TRUE when the client accounts for the VAT, so the invoice carries none and prints the reverse-charge note. The app makes only such invoices.' },
  ],
  'outgoing-plan': [
    { name: 'item', note: 'What kind of item it is, such as the monthly fee, a bonus, a re-billed plane ticket or hotel, a contractor or a subscription. Rows of one kind share the same text. Required.' },
    { name: 'date', note: 'The day it becomes billable, as a date cell: the last day of the worked month for a monthly fee, the purchase day for a re-billed cost, the day a bonus is agreed. Required.' },
    { name: 'amount', note: 'What to invoice for it, as a number above zero. A formula is fine. Required.' },
    { name: 'client', note: 'Who to invoice, by the client name in the clients tab. Required.' },
    { name: 'description', note: 'What the invoice line says, such as October fee. Optional.' },
    ID_TEMPLATE_COLUMN,
  ],
  splits: [
    { name: 'date', note: 'The booking date of the ledger row the part belongs to, as a date cell. Required.' },
    { name: 'account', note: 'The account of that ledger row. Required.' },
    { name: 'row_amount', note: 'The amount of that ledger row, as the ledger holds it. Required.' },
    {
      name: 'row_balance',
      note: 'The balance of that ledger row, copied from the ledger. With the date, account and amount it finds exactly one row. Required.',
    },
    {
      name: 'amount',
      note: "What of the row this part is, with the row's sign. A row's parts add up to it, and a row has at least two. Required.",
    },
    { name: 'category', note: 'A category from the categories tab. The part counts there, with its own timing. Required.' },
    { name: 'note', note: 'What this part paid for. Optional.' },
    ID_TEMPLATE_COLUMN,
  ],
  dismissed: [
    { name: 'kind', note: `What was dismissed: ${SUGGESTION_KINDS.join(' or ')}, the two lists of confirmed rows no rule repeats on Review. Required.` },
    {
      name: 'key',
      note: 'The counterparty the suggestion groups its rows by: iban: and the IBAN, or name: and the name in lower case without accents. An exception adds | and the id of the rule it differs from. Required.',
    },
    { name: 'category', note: "The category most of the group's rows were in when it was dismissed. Optional." },
    { name: 'dismissed_on', note: 'The day it was dismissed, as a date cell. Optional.' },
    ID_TEMPLATE_COLUMN,
  ],
}

/** The columns of a tab, core's or the installed pack's, in template order. Throws for a pack tab no installed pack maps. */
export function templateColumns(tab: WorkbookTab): readonly TemplateColumn[] {
  if (tab in TEMPLATE_COLUMNS) {
    return TEMPLATE_COLUMNS[tab as CoreTab]
  }
  const mapping = packTabOf(tab)
  if (mapping === null) {
    throw new Error(`The ${tab} tab belongs to a pack that is not installed.`)
  }
  return mapping.columns
}

/** The names of a tab's columns, in template order. */
export function templateColumnNames(tab: WorkbookTab): string[] {
  return templateColumns(tab).map((column) => column.name)
}

/** The tab's columns other than its id, which a row the app writes is found again by. */
export function contentColumns(tab: WorkbookTab): string[] {
  return contentColumnsOf(templateColumns(tab))
}

/** The tab's columns other than its id that a header row lacks, in template order. */
function missingContentColumns(tab: WorkbookTab, header: readonly string[]): string[] {
  const held = new Set(header.map((name) => name.trim()))
  return contentColumns(tab).filter((column) => !held.has(column))
}

/** The columns other than the id that each tab's header lacks, for the tabs that lack any. */
export function missingColumnsOf(headers: readonly (readonly [tab: WorkbookTab, header: readonly string[]])[]): Partial<Record<WorkbookTab, readonly string[]>> {
  return Object.fromEntries(headers.map(([tab, header]) => [tab, missingContentColumns(tab, header)] as const).filter(([, columns]) => columns.length > 0))
}

/** The names of the columns other than the id, in template order. */
export function contentColumnsOf(columns: readonly TemplateColumn[]): string[] {
  return columns.map((column) => column.name).filter((name) => name !== ID_COLUMN)
}

interface CategorySeed {
  readonly family: string
  readonly bucket: DefinedBucket
  readonly colour: string
  readonly categories: readonly (readonly [category: string, roles?: string])[]
}

/** A generic set for a freelancer or a small company, which a user renames and extends. */
const DEFAULT_CATEGORIES: readonly CategorySeed[] = [
  {
    family: 'income',
    bucket: 'income',
    colour: '#d7f0e5',
    categories: [['revenue', 'revenue'], ['other-income'], ['interest-income'], ['client-refund', 'client-refund']],
  },
  {
    family: 'operating',
    bucket: 'operating',
    colour: '#dce9f9',
    categories: [
      ['software'],
      ['equipment'],
      ['contractors'],
      ['accounting-and-legal'],
      ['office-rent'],
      ['office-supplies'],
      ['travel'],
      ['client-meals'],
      ['marketing'],
      ['telecom'],
      ['insurance'],
      ['training'],
      ['bank-fees'],
      ['other-costs'],
      ['vat-refund', 'vat-settlement'],
    ],
  },
  {
    family: 'taxes',
    bucket: 'taxes',
    colour: '#f9dcdc',
    categories: [['income-tax'], ['vat', 'vat-settlement'], ['payroll-tax'], ['social-contributions', 'watched'], ['tax-refund']],
  },
  {
    family: 'owner',
    bucket: 'owner-pay',
    colour: '#e4e1f6',
    categories: [['owner-salary'], ['owner-dividend'], ['owner-drawings']],
  },
  {
    family: 'financing',
    bucket: 'financing',
    colour: '#f6e1ee',
    categories: [['loan-received'], ['loan-repayment'], ['owner-reimbursement', 'reimbursement']],
  },
  {
    family: 'neutral',
    bucket: 'neutral',
    colour: '#ececec',
    categories: [['internal-transfer'], ['owner-capital']],
  },
]

/** Rows numbered from 2, under the header, as a tab holds them. */
function rowsFrom(cellsOfRows: readonly Readonly<Record<string, CellValue>>[]): SheetRow[] {
  return cellsOfRows.map((cells, index) => ({ sheetRow: index + 2, cells: withoutBlanks(cells) }))
}

/** A settings tab of core's settings and the installed pack's defaults, with any rows to keep below them. */
export function settingsTabRows(settings: Settings, keptRows: readonly SheetRow[] = []): SheetRow[] {
  const pack = installedPack().workbook
  return rowsFrom([
    ...settingsTabEntries(settings, pack === null ? null : { settings: pack.settings, values: pack.settings.defaults }).map(({ key, value }) => ({ key, value })),
    ...keptRows.map((row) => row.cells),
  ])
}

/** A workbook with no transactions or accounts yet, the default categories and the default settings. */
export function emptyWorkbookTabs(): WorkbookTabs {
  return {
    ledger: [],
    categories: rowsFrom(
      DEFAULT_CATEGORIES.flatMap((seed) =>
        seed.categories.map(([category, roles = '']) => ({ category, family: seed.family, bucket: seed.bucket, colour: seed.colour, roles })),
      ),
    ),
    accounts: [],
    settings: settingsTabRows(DEFAULT_SETTINGS),
    rules: [],
    invoices: [],
    clients: [],
    'outgoing-plan': [],
    'owner-advances': [],
    assets: [],
    grants: [],
    'year-end': [],
    plan: [],
    scenarios: [],
    splits: [],
    dismissed: [],
  }
}

function withoutBlanks(cells: Readonly<Record<string, CellValue>>): Record<string, CellValue> {
  return Object.fromEntries(Object.entries(cells).filter(([, cell]) => cell !== ''))
}
