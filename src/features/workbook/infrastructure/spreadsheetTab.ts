import { parseCivilDate, serialFromCivilDate } from '../../../shared/calendar/civilDate'
import { cellText } from '../../../shared/text/cellText'
import { installedPack } from '../../packs/packContribution'
import { RULE_CODEC } from '../../rules/domain/readRules'
import { settingCodec, settingTypeOf } from '../../settings/domain/settings'
import type { SettingType } from '../../settings/domain/settings'
import { ACCOUNT_CODEC } from '../domain/accountsReading'
import { BILLING_CODEC } from '../domain/billingPlanReading'
import { CATEGORY_CODEC } from '../domain/categoriesReading'
import { CLIENT_CODEC } from '../domain/clientsReading'
import { DISMISSAL_CODEC } from '../domain/dismissalsReading'
import { INVOICE_CODEC } from '../domain/invoicesReading'
import { LEDGER_CODEC } from '../domain/ledgerReading'
import type { PackRecords } from '../domain/packPart'
import type { WorkbookRecordTypes, WorkbookRecords } from '../domain/readWorkbook'
import { readWorkbook } from '../domain/readWorkbook'
import type { RecordCodec } from '../domain/recordCodec'
import type { FieldValue, RecordFields } from '../domain/recordFields'
import { recordIdOf } from '../domain/recordId'
import type { RecordId } from '../domain/recordId'
import type { RecordKind } from '../domain/recordKind'
import type { ReadRecord, RecordsRead, RefusedRecord } from '../domain/recordsRead'
import { SPLIT_PART_CODEC } from '../domain/splitsReading'
import { decimalOf, refusalOr } from '../domain/storedFields'
import type { Workbook } from '../domain/workbook'
import { byColumn, numberFormatOfCell } from './cellFormats'
import type { CellFormat, CellFormatOf } from './cellFormats'
import { storedFieldsOfCells } from './cellReading'
import { installedPackTabs, packTabOf } from './packTabs'
import type { CellValue, CoreTab, SheetRow, WorkbookSnapshot, WorkbookTab } from './workbookSnapshot'
import { OWNER_SHARE_COLUMN, contentColumns } from './workbookTemplate'

/** A row's cells, keyed by header. */
export type Cells = Readonly<Record<string, CellValue>>

/**
 * How one tab holds one kind of record: the kind's codec, the columns the tab needs, and the cell
 * format of each column a record's fields are written to as numbers.
 */
export interface SpreadsheetTab<R> {
  readonly tab: WorkbookTab
  readonly codec: RecordCodec<R>
  /** The columns the tab needs before anything is written to it. */
  readonly required: readonly string[]
  readonly formatOf: CellFormatOf
}

const SETTING_FORMATS: Readonly<Partial<Record<SettingType, CellFormat>>> = { date: 'date', number: 'number' }

/** The records of each core tab, each by its tab's mapping. */
export const CORE_TABS: { readonly [Tab in CoreTab]: SpreadsheetTab<WorkbookRecordTypes[Tab]> & { readonly tab: Tab } } = {
  ledger: {
    tab: 'ledger',
    codec: LEDGER_CODEC,
    required: ['date', 'account', 'amount', 'balance'],
    formatOf: byColumn({ date: 'date', amount: 'amount', balance: 'amount', owner_share: 'number' }),
  },
  categories: { tab: 'categories', codec: CATEGORY_CODEC, required: ['category', 'family', 'bucket'], formatOf: byColumn({ owner_share: 'number' }) },
  accounts: { tab: 'accounts', codec: ACCOUNT_CODEC, required: ['account', 'iban'], formatOf: byColumn({}) },
  settings: {
    tab: 'settings',
    codec: settingCodec(() => installedPack().workbook?.settings ?? null),
    required: ['key', 'value'],
    // A value is a date or a number as its key says, core's or the pack's.
    formatOf: (column, fieldOf) => (column === 'value' ? (SETTING_FORMATS[settingTypeOf(fieldOf('key'), installedPack().workbook?.settings ?? null)] ?? null) : null),
  },
  rules: { tab: 'rules', codec: RULE_CODEC, required: [], formatOf: byColumn({ order: 'number' }) },
  invoices: {
    tab: 'invoices',
    codec: INVOICE_CODEC,
    required: contentColumns('invoices'),
    formatOf: byColumn({ amount: 'amount', issued: 'date', due: 'date', period_from: 'date', period_to: 'date' }),
  },
  clients: { tab: 'clients', codec: CLIENT_CODEC, required: ['client', 'iban'], formatOf: byColumn({}) },
  'outgoing-plan': { tab: 'outgoing-plan', codec: BILLING_CODEC, required: contentColumns('outgoing-plan'), formatOf: byColumn({ date: 'date', amount: 'amount' }) },
  splits: {
    tab: 'splits',
    codec: SPLIT_PART_CODEC,
    required: contentColumns('splits').filter((column) => column !== 'note' && column !== OWNER_SHARE_COLUMN),
    formatOf: byColumn({ date: 'date', row_amount: 'amount', row_balance: 'amount', amount: 'amount', owner_share: 'number' }),
  },
  dismissed: { tab: 'dismissed', codec: DISMISSAL_CODEC, required: ['kind', 'key'], formatOf: byColumn({ dismissed_on: 'date' }) },
}

/** The mapping of a kind, core's or the installed pack's. Throws for a kind no tab holds. */
export function spreadsheetTabOfKind<R>(kind: RecordKind<R>): SpreadsheetTab<R> {
  const mapping = [...Object.values(CORE_TABS), ...installedPackTabs()].find((candidate) => candidate.codec.kind.name === kind.name)
  if (mapping === undefined) {
    throw new Error(`No tab holds ${kind.noun.many}.`)
  }
  return mapping as SpreadsheetTab<unknown> as SpreadsheetTab<R>
}

/** The mapping of a tab, core's or the installed pack's, or null for a pack tab no installed pack maps. */
function spreadsheetTabOf(tab: WorkbookTab): SpreadsheetTab<unknown> | null {
  return tab in CORE_TABS ? CORE_TABS[tab as CoreTab] : packTabOf(tab)
}

/** A field in a date column as its serial number, in another number column as a number, and anything else as it is. */
function cellOfField(value: FieldValue, format: CellFormat | null): CellValue {
  if (typeof value === 'boolean' || format === null) {
    return value
  }
  if (format === 'date') {
    const date = parseCivilDate(value)
    return date === null ? value : serialFromCivilDate(date)
  }
  return decimalOf(value) ?? value
}

/** A record's fields as the cells of its row, each by its column's cell format. */
export function cellsOfFields(mapping: SpreadsheetTab<unknown>, fields: RecordFields): Cells {
  const fieldOf = (column: string): string => cellText(fields[column]).toLowerCase()
  return Object.fromEntries(Object.entries(fields).map(([column, value]) => [column, cellOfField(value, mapping.formatOf(column, fieldOf))]))
}

/** A record as the cells of its row. */
export function cellsOfRecord<R>(mapping: SpreadsheetTab<R>, record: R): Cells {
  return cellsOfFields(mapping as SpreadsheetTab<unknown>, mapping.codec.fieldsOf(record))
}

/**
 * The number format a number in this cell takes, by its tab's cell formats. Null for a column the
 * template keeps as typed, and for a tab no installed pack maps.
 */
export function numberFormatOf(tab: WorkbookTab, column: string, cellOf: (column: string) => CellValue | undefined): string | null {
  const mapping = spreadsheetTabOf(tab)
  return mapping === null ? null : numberFormatOfCell(mapping.formatOf(column, (other) => cellText(cellOf(other)).toLowerCase()))
}

/** Whether the cell holds a date as its serial number, so a person reads it as a day. */
export function isDateCell(tab: WorkbookTab, column: string, cellOf: (column: string) => CellValue | undefined): boolean {
  const mapping = spreadsheetTabOf(tab)
  return typeof cellOf(column) === 'number' && mapping?.formatOf(column, (other) => cellText(cellOf(other)).toLowerCase()) === 'date'
}

/** The identity the row's cells hold by the tab's mapping, or null when the row lacks its key or id. */
export function rowIdOf<R>(mapping: SpreadsheetTab<R>, cells: Cells): RecordId | null {
  const key = mapping.codec.key(storedFieldsOfCells(cells))
  return key === null ? null : recordIdOf(mapping.codec.kind, key)
}

/** The records a tab's rows hold by the tab's mapping, and the rows the kind's domain refuses, in the order of the rows. */
export function recordsOfRows<R>(mapping: SpreadsheetTab<R>, rows: readonly SheetRow[]): RecordsRead<R> {
  const { codec } = mapping
  const records: ReadRecord<R>[] = []
  const refused: RefusedRecord[] = []
  for (const { cells } of rows) {
    const fields = storedFieldsOfCells(cells)
    const key = codec.key(fields)
    const id = key === null ? null : recordIdOf(codec.kind, key)
    const label = codec.label(fields)
    const read = refusalOr(() => codec.make(fields, id))
    if ('made' in read) {
      records.push({ record: read.made, id, label, fields })
    } else {
      refused.push({ id, label, fields, reason: read.refused })
    }
  }
  return { records, refused }
}

/** The records of the installed pack's tabs, by kind. A tab the workbook lacks reads as empty. */
function packRecordsOf(rowsOf: (tab: WorkbookTab) => readonly SheetRow[]): PackRecords {
  return new Map(installedPackTabs().map((mapping) => [mapping.codec.kind.name, recordsOfRows(mapping, rowsOf(mapping.tab))]))
}

/** The records of every tab of a workbook's tabs. */
function recordsOfTabs(tabs: Readonly<Record<WorkbookTab, readonly SheetRow[]>>): WorkbookRecords {
  const of = <Tab extends CoreTab>(tab: Tab): RecordsRead<WorkbookRecordTypes[Tab]> => recordsOfRows(CORE_TABS[tab], tabs[tab])
  return {
    ledger: of('ledger'),
    categories: of('categories'),
    accounts: of('accounts'),
    settings: of('settings'),
    rules: of('rules'),
    invoices: of('invoices'),
    clients: of('clients'),
    'outgoing-plan': of('outgoing-plan'),
    splits: of('splits'),
    dismissed: of('dismissed'),
    pack: packRecordsOf((tab) => tabs[tab]),
  }
}

/** A snapshot's records and the workbook they make, whether it came from a Google Sheet or an xlsx file. */
export function readSnapshot(snapshot: WorkbookSnapshot): { readonly records: WorkbookRecords; readonly workbook: Workbook } {
  const { id, source, title, syncedAt } = snapshot.meta
  const records = recordsOfTabs(snapshot)
  return { records, workbook: readWorkbook({ id, source, title, syncedAt }, records, installedPack().workbook) }
}
