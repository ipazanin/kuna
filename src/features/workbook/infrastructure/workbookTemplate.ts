import { DEFAULT_SETTINGS, settingsTabEntries } from '../../settings/domain/settings'
import type { Settings } from '../../settings/domain/settings'
import type { DefinedBucket } from '../domain/bucket'
import type { CellValue, SheetRow, WorkbookTab, WorkbookTabs } from './workbookSnapshot'

export interface TemplateColumn {
  readonly name: string
  /** The note on the header cell of the template and every export. */
  readonly note: string
}

/**
 * The columns of each tab, in the order the template and an export write them. The ledger keeps
 * the Google Sheet's own order, A to N, so an export lines up with the Sheet column for column.
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
  ],
  accounts: [
    { name: 'account', note: 'A short name for one of your bank accounts, such as main. Required.' },
    { name: 'iban', note: "The account's IBAN. Optional." },
    { name: 'currency', note: 'Optional. The app counts in the currency from the settings tab and reports an account in another one.' },
  ],
  settings: [
    { name: 'key', note: 'A setting name. The note on each key says what it does. Unknown keys are kept and reported.' },
    { name: 'value', note: 'Its value. A blank value means the default.' },
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
  }
}

function withoutBlanks(cells: Readonly<Record<string, CellValue>>): Record<string, CellValue> {
  return Object.fromEntries(Object.entries(cells).filter(([, cell]) => cell !== ''))
}
