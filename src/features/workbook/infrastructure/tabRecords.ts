import { civilDateFromSerial } from '../../../shared/calendar/civilDate'
import { cellText } from '../../../shared/text/cellText'
import { normaliseIban } from '../../../shared/text/fold'
import { recordIdOf } from '../domain/recordId'
import type { RecordId } from '../domain/recordId'
import {
  ACCOUNT_RECORDS,
  ASSET_RECORDS,
  BILLING_RECORDS,
  CATEGORY_RECORDS,
  CLIENT_RECORDS,
  DISMISSAL_RECORDS,
  GRANT_RECORDS,
  INVOICE_RECORDS,
  LEDGER_RECORDS,
  OWNER_ADVANCE_RECORDS,
  PLAN_RECORDS,
  RULE_RECORDS,
  SCENARIO_RECORDS,
  SETTING_RECORDS,
  SPLIT_PART_RECORDS,
  YEAR_END_RECORDS,
} from '../domain/recordKind'
import type { RecordKind } from '../domain/recordKind'
import type { CellValue, WorkbookTab } from './workbookSnapshot'
import { ID_COLUMN } from './workbookTemplate'

type Cells = Readonly<Record<string, CellValue>>

/** How a tab's rows map to records: the kind, the key or id a row holds, and the words that name it. */
interface TabRecords {
  readonly kind: RecordKind
  /** The key the tab's reader keeps the record by, or null when the row lacks it. */
  key(cells: Cells): string | null
  label(cells: Cells): string
}

const UNNAMED = 'unnamed'

function slug(cell: CellValue | undefined): string {
  return cellText(cell).toLowerCase()
}

/** A date cell as a day, anything else as its text. */
function day(cell: CellValue | undefined): string {
  return typeof cell === 'number' && Number.isFinite(cell) ? civilDateFromSerial(cell) : cellText(cell)
}

function words(parts: readonly string[]): string {
  return parts.filter((part) => part !== '').join(', ') || UNNAMED
}

/** "month 3", or blank for a blank cell. */
function labelled(name: string, text: string): string {
  return text === '' ? '' : `${name} ${text}`
}

function filled(text: string): string | null {
  return text === '' ? null : text
}

function byId(kind: RecordKind, label: (cells: Cells) => string): TabRecords {
  return { kind, key: (cells) => filled(cellText(cells[ID_COLUMN])), label }
}

/**
 * The ledger row's `LedgerRowKey`: its account and reference, or for a row without a reference its
 * account, day, amount, balance and description. Null for a row the ledger reader leaves out.
 */
function ledgerKey(cells: Cells): string | null {
  const account = slug(cells.account)
  if (typeof cells.date !== 'number' || !Number.isFinite(cells.date) || account === '' || typeof cells.amount !== 'number' || typeof cells.balance !== 'number') {
    return null
  }
  const reference = cellText(cells.reference)
  return reference === ''
    ? JSON.stringify([account, civilDateFromSerial(cells.date), cells.amount, cells.balance, cellText(cells.description)])
    : JSON.stringify([account, reference])
}

const TAB_RECORDS: Readonly<Record<WorkbookTab, TabRecords>> = {
  ledger: {
    kind: LEDGER_RECORDS,
    key: ledgerKey,
    label: (cells) => words([day(cells.date), cellText(cells.counterparty) || cellText(cells.description), cellText(cells.amount), labelled('balance', cellText(cells.balance))]),
  },
  categories: { kind: CATEGORY_RECORDS, key: (cells) => filled(slug(cells.category)), label: (cells) => words([cellText(cells.category)]) },
  accounts: { kind: ACCOUNT_RECORDS, key: (cells) => filled(slug(cells.account)), label: (cells) => words([cellText(cells.account)]) },
  settings: { kind: SETTING_RECORDS, key: (cells) => filled(slug(cells.key)), label: (cells) => words([slug(cells.key)]) },
  rules: { kind: RULE_RECORDS, key: (cells) => filled(slug(cells.rule)), label: (cells) => words([cellText(cells.rule)]) },
  invoices: {
    kind: INVOICE_RECORDS,
    key: (cells) => (slug(cells.client) === '' || cellText(cells.number) === '' ? null : JSON.stringify([slug(cells.client), cellText(cells.number)])),
    label: (cells) => words([cellText(cells.number)]),
  },
  clients: { kind: CLIENT_RECORDS, key: (cells) => filled(normaliseIban(cellText(cells.iban))), label: (cells) => words([cellText(cells.client), cellText(cells.iban)]) },
  'outgoing-plan': byId(BILLING_RECORDS, (cells) => words([cellText(cells.item), cellText(cells.client), day(cells.date), cellText(cells.amount)])),
  'owner-advances': byId(OWNER_ADVANCE_RECORDS, (cells) => words([cellText(cells.description), cellText(cells.amount), day(cells.date)])),
  assets: byId(ASSET_RECORDS, (cells) => words([cellText(cells.asset)])),
  grants: { kind: GRANT_RECORDS, key: (cells) => filled(slug(cells.grant)), label: (cells) => words([cellText(cells.grant)]) },
  'year-end': byId(YEAR_END_RECORDS, (cells) => [cells.year, cells.statement, cells.line].map((cell) => cellText(cell)).filter((part) => part !== '').join(' ') || UNNAMED),
  plan: byId(PLAN_RECORDS, (cells) => words([cellText(cells.item), cellText(cells.year), labelled('month', cellText(cells.month)), cellText(cells.amount)])),
  scenarios: {
    kind: SCENARIO_RECORDS,
    key: (cells) => (slug(cells.scenario) === '' ? null : JSON.stringify([slug(cells.scenario), slug(cells.component), day(cells.from), day(cells.to)])),
    label: (cells) => words([cellText(cells.scenario), cellText(cells.component), labelled('from', day(cells.from))]),
  },
  splits: byId(SPLIT_PART_RECORDS, (cells) => words([cellText(cells.category), cellText(cells.amount), day(cells.date)])),
  dismissed: byId(DISMISSAL_RECORDS, (cells) => words([cellText(cells.key), day(cells.dismissed_on)])),
}

/** The record a row of the tab holds, by its key or id, or null when the row lacks it. */
export function recordIdOfRow(tab: WorkbookTab, cells: Cells): RecordId | null {
  const records = TAB_RECORDS[tab]
  const key = records.key(cells)
  return key === null ? null : recordIdOf(records.kind, key)
}

/** What names a row's record for a person, such as an invoice's number or an asset's name. */
export function labelOfRow(tab: WorkbookTab, cells: Cells): string {
  return TAB_RECORDS[tab].label(cells)
}

/** The record id a reader gives a record it read, which has its key or id. */
export function readRecordId(tab: WorkbookTab, cells: Cells): RecordId {
  const id = recordIdOfRow(tab, cells)
  if (id === null) {
    throw new Error(`A ${tab} record was read from a row without its key.`)
  }
  return id
}
