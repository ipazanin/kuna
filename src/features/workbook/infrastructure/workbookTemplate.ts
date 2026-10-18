import { RULE_COLUMNS } from '../../rules/domain/rule'
import { DEFAULT_SETTINGS, settingsTabEntries } from '../../settings/domain/settings'
import type { Settings } from '../../settings/domain/settings'
import type { DefinedBucket } from '../domain/bucket'
import type { CellValue, SheetRow, WorkbookTab, WorkbookTabs } from './workbookSnapshot'

export interface TemplateColumn {
  readonly name: string
  /** The note on the header cell of the template and every export. */
  readonly note: string
}

const RULE_COLUMN_NOTES: Readonly<Record<(typeof RULE_COLUMNS)[number], string>> = {
  rule: 'A short id, used once, such as merchant-telecom. Required.',
  order: 'A number. Rules are tried from the lowest, and the first enabled one whose conditions all hold decides the row. Required.',
  enabled: 'TRUE or FALSE. A FALSE rule is kept but never tried. Required.',
  direction: 'Condition: credit for money in, debit for money out, or blank.',
  counterparty_iban: 'Condition: the counterparty IBAN, spaces and case ignored.',
  has_counterparty_iban: 'Condition: TRUE when the row must carry a counterparty IBAN, FALSE when it must not, or blank.',
  counterparty_is_own: 'Condition: TRUE when the counterparty is one of the accounts in the accounts tab, or blank.',
  counterparty_is_client: 'Condition: the app does not test this one yet, so leave it blank and name the client by counterparty_iban.',
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

/**
 * The columns of each tab, in the order the template and an export write them. The ledger keeps
 * the Google Sheet's own order, A to U, so an export lines up with the Sheet column for column.
 * The reader finds every column by name, so a file may order them as it likes and add its own.
 */
export const TEMPLATE_COLUMNS: Readonly<Record<WorkbookTab, readonly TemplateColumn[]>> = {
  ledger: [
    { name: 'date', note: 'The booking date, as a date cell. Required.' },
    { name: 'account', note: 'Which of your accounts, by the name in the accounts tab. Required.' },
    { name: 'statement', note: 'The bank statement the row came from. Optional.' },
    { name: 'counterparty', note: 'Who paid or was paid. Optional, but the spending screen groups by it.' },
    { name: 'counterparty_iban', note: 'Their IBAN, which groups a payee better than a name. Optional.' },
    { name: 'description', note: 'The payment description. Optional.' },
    { name: 'amount', note: 'The amount as a number, money in positive and money out negative. Required.' },
    { name: 'balance', note: "The account's balance after this row, as a number. Required." },
    { name: 'category', note: 'A category from the categories tab. A blank or unknown one waits for review.' },
    { name: 'family', note: 'Filled in from categories on export, and ignored on import.' },
    { name: 'bucket', note: 'Filled in from categories on export, and ignored on import.' },
    { name: 'month', note: 'Filled in from the date on export, and ignored on import.' },
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
    { name: 'colour', note: 'Your own note of a colour, such as #dce9f9. The app does not use it.' },
    { name: 'roles', note: 'Optional, comma separated, such as revenue or watched, for features that pick categories by role.' },
    { name: 'label', note: 'What the screens call the category, such as Software. Optional. Blank shows the category with spaces for hyphens.' },
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
  ],
  clients: [
    { name: 'client', note: 'A short name in lower case, such as northwind. One row per IBAN, so a client paying from two accounts has two rows. Required.' },
    { name: 'name', note: 'What the screens call the client. Optional.' },
    { name: 'iban', note: 'An IBAN the client pays from. A payment from it counts against that client’s invoices. Required.' },
  ],
  'owner-advances': [
    { name: 'date', note: 'When the owner paid, as a date cell. Required.' },
    { name: 'amount', note: 'What the owner paid for the company, as a positive number. Required.' },
    { name: 'description', note: 'What it was for. Optional.' },
    { name: 'category', note: 'A category from the categories tab in the operating or taxes bucket. The cost counts there on its date. Required.' },
  ],
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
    ],
  },
  {
    family: 'taxes',
    bucket: 'taxes',
    colour: '#f9dcdc',
    categories: [['income-tax'], ['vat'], ['payroll-tax'], ['social-contributions', 'watched'], ['tax-refund']],
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
export function rowsFrom(cellsOfRows: readonly Readonly<Record<string, CellValue>>[]): SheetRow[] {
  return cellsOfRows.map((cells, index) => ({ sheetRow: index + 2, cells: withoutBlanks(cells) }))
}

export function settingsTabRows(settings: Settings, keptRows: readonly SheetRow[] = []): SheetRow[] {
  return rowsFrom([
    ...settingsTabEntries(settings).map(({ key, value }) => ({ key, value })),
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
    'owner-advances': [],
  }
}

function withoutBlanks(cells: Readonly<Record<string, CellValue>>): Record<string, CellValue> {
  return Object.fromEntries(Object.entries(cells).filter(([, cell]) => cell !== ''))
}
