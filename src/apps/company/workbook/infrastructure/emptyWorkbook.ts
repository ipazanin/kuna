import { OWNER_SHARE_ROLES } from '../../owner-share/domain/ownerShare'
import { installedPack } from '../../packs/packContribution'
import { DEFAULT_SETTINGS, settingsTabEntries } from '../../settings/domain/settings'
import type { Settings } from '../../settings/domain/settings'
import type { DefinedBucket } from '../domain/bucket'
import { CORE_TABS, cellsOfRecord } from './spreadsheetTab'
import type { CellValue, SheetRow, WorkbookTabs } from './workbookSnapshot'

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
    categories: [['owner-salary'], ['owner-dividend'], ['owner-drawings'], ['benefits-from-company-costs', OWNER_SHARE_ROLES.ownerBenefit]],
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

/** The names of the categories new books start with. */
export const DEFAULT_CATEGORY_NAMES: readonly string[] = DEFAULT_CATEGORIES.flatMap((seed) => seed.categories.map(([category]) => category))

/** Rows numbered from 2, under the header, as a tab holds them. */
function rowsFrom(cellsOfRows: readonly Readonly<Record<string, CellValue>>[]): SheetRow[] {
  return cellsOfRows.map((cells, index) => ({ sheetRow: index + 2, cells: withoutBlanks(cells) }))
}

/** A settings tab of core's settings and the installed pack's defaults, with any rows to keep below them. */
export function settingsTabRows(settings: Settings, keptRows: readonly SheetRow[] = []): SheetRow[] {
  const pack = installedPack().workbook
  return rowsFrom([
    ...settingsTabEntries(settings, pack === null ? null : { settings: pack.settings, values: pack.settings.defaults }).map((entry) => cellsOfRecord(CORE_TABS.settings, entry)),
    ...keptRows.map((row) => row.cells),
  ])
}

/** A workbook with no transactions or accounts yet, the default categories, and a row for every setting with these values and the pack's defaults. */
export function emptyWorkbookTabs(settings: Settings = DEFAULT_SETTINGS): WorkbookTabs {
  return {
    ledger: [],
    categories: rowsFrom(DEFAULT_CATEGORIES.flatMap((seed) => seed.categories.map(([category, roles = '']) => ({ category, family: seed.family, bucket: seed.bucket, colour: seed.colour, roles })))),
    accounts: [],
    settings: settingsTabRows(settings),
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
    employees: [],
    splits: [],
    dismissed: [],
  }
}

function withoutBlanks(cells: Readonly<Record<string, CellValue>>): Record<string, CellValue> {
  return Object.fromEntries(Object.entries(cells).filter(([, cell]) => cell !== ''))
}
