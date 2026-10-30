import { parseCivilDate, serialFromCivilDate } from '../../../../shared/calendar/civilDate'
import { cellText } from '../../../../shared/text/cellText'
import { installedPack } from '../../packs/packContribution'
import { settingTypeOf } from '../../settings/domain/settings'
import type { SettingType } from '../../settings/domain/settings'
import { codecOfKind } from '../application/recordCodecs'
import {
  ACCOUNT_RECORDS,
  BILLING_RECORDS,
  CATEGORY_RECORDS,
  CLIENT_RECORDS,
  DISMISSAL_RECORDS,
  INVOICE_RECORDS,
  LEDGER_RECORDS,
  RULE_RECORDS,
  SETTING_RECORDS,
  SPLIT_PART_RECORDS,
} from '../domain/coreKinds'
import type { WorkbookRecordTypes, WorkbookRecords } from '../domain/readWorkbook'
import { readWorkbook, workbookRecordsOf } from '../domain/readWorkbook'
import type { FieldValue, RecordFields } from '../../../../shared/storage/domain/recordFields'
import { recordIdOf } from '../../../../shared/storage/domain/recordId'
import type { RecordKind } from '../../../../shared/storage/domain/recordKind'
import { NO_RECORDS } from '../../../../shared/storage/domain/recordsRead'
import type { ReadRecord, RecordsRead, RefusedRecord } from '../../../../shared/storage/domain/recordsRead'
import { decimalOf, refusalOr } from '../../../../shared/storage/domain/storedFields'
import type { Workbook } from '../domain/workbook'
import { byColumn, numberFormatOfCell } from './cellFormats'
import type { CellFormat, CellFormatOf } from './cellFormats'
import { storedFieldsOfCells } from './cellReading'
import { installedPackTabs, packTabOf } from './packTabs'
import type { CellValue, CoreTab, SheetRow, WorkbookSnapshot, WorkbookTab } from './workbookSnapshot'

/** A row's cells, keyed by header. */
export type Cells = Readonly<Record<string, CellValue>>

/** How one tab holds one kind of record: the kind, and the cell format of each column a record's fields are written to as numbers. */
export interface SpreadsheetTab<R> {
  readonly tab: WorkbookTab
  readonly kind: RecordKind<R>
  readonly formatOf: CellFormatOf
}

const SETTING_FORMATS: Readonly<Partial<Record<SettingType, CellFormat>>> = { date: 'date', number: 'number' }

/** The records of each core tab, each by its tab's mapping. */
export const CORE_TABS: { readonly [Tab in CoreTab]: SpreadsheetTab<WorkbookRecordTypes[Tab]> & { readonly tab: Tab } } = {
  ledger: {
    tab: 'ledger',
    kind: LEDGER_RECORDS,
    formatOf: byColumn({ date: 'date', amount: 'amount', balance: 'amount', owner_share: 'number' }),
  },
  categories: { tab: 'categories', kind: CATEGORY_RECORDS, formatOf: byColumn({ owner_share: 'number' }) },
  accounts: { tab: 'accounts', kind: ACCOUNT_RECORDS, formatOf: byColumn({}) },
  settings: {
    tab: 'settings',
    kind: SETTING_RECORDS,
    // A value is a date or a number as its key says, core's or the pack's.
    formatOf: (column, fieldOf) => (column === 'value' ? (SETTING_FORMATS[settingTypeOf(fieldOf('key'), installedPack().workbook?.settings ?? null)] ?? null) : null),
  },
  rules: { tab: 'rules', kind: RULE_RECORDS, formatOf: byColumn({ order: 'number' }) },
  invoices: {
    tab: 'invoices',
    kind: INVOICE_RECORDS,
    formatOf: byColumn({ amount: 'amount', issued: 'date', due: 'date', period_from: 'date', period_to: 'date' }),
  },
  clients: { tab: 'clients', kind: CLIENT_RECORDS, formatOf: byColumn({}) },
  'outgoing-plan': { tab: 'outgoing-plan', kind: BILLING_RECORDS, formatOf: byColumn({ date: 'date', amount: 'amount' }) },
  splits: {
    tab: 'splits',
    kind: SPLIT_PART_RECORDS,
    formatOf: byColumn({ date: 'date', row_amount: 'amount', row_balance: 'amount', amount: 'amount', owner_share: 'number' }),
  },
  dismissed: { tab: 'dismissed', kind: DISMISSAL_RECORDS, formatOf: byColumn({ dismissed_on: 'date' }) },
}

/** The mapping of a kind, core's or the installed pack's. Throws for a kind no tab holds. */
export function spreadsheetTabOfKind<R>(kind: RecordKind<R>): SpreadsheetTab<R> {
  const mapping = [...Object.values(CORE_TABS), ...installedPackTabs()].find((candidate) => candidate.kind.name === kind.name)
  if (mapping === undefined) {
    throw new Error(`No tab holds ${kind.noun.en.many}.`)
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
  return cellsOfFields(mapping as SpreadsheetTab<unknown>, codecOfKind(mapping.kind).fieldsOf(record))
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

/** The records a tab's rows hold by the tab's mapping, and the rows the kind's domain refuses, in the order of the rows. */
export function recordsOfRows<R>(mapping: SpreadsheetTab<R>, rows: readonly SheetRow[]): RecordsRead<R> {
  const codec = codecOfKind(mapping.kind)
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

/** The records of every tab of a workbook's tabs. A tab the workbook lacks reads as empty. */
function recordsOfTabs(tabs: Readonly<Record<WorkbookTab, readonly SheetRow[]>>): WorkbookRecords {
  return workbookRecordsOf(<R>(kind: RecordKind<R>): RecordsRead<R> => {
    const mapping = spreadsheetTabOfKind(kind)
    const rows = tabs[mapping.tab]
    return rows === undefined ? NO_RECORDS : recordsOfRows(mapping, rows)
  }, installedPack().workbook)
}

/** The records of an xlsx file's tabs and the workbook they make. */
export function readSnapshot(snapshot: WorkbookSnapshot): { readonly records: WorkbookRecords; readonly workbook: Workbook } {
  const { id, source, title, syncedAt } = snapshot.meta
  const records = recordsOfTabs(snapshot)
  return { records, workbook: readWorkbook({ id, source, title, syncedAt }, records, installedPack().workbook) }
}
