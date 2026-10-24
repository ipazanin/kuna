import { civilDateFromSerial, serialFromCivilDate } from '../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../shared/calendar/civilDate'
import { amountOf } from '../../../shared/money/money'
import { cellText } from '../../../shared/text/cellText'
import { normaliseIban } from '../../../shared/text/fold'
import { installedPack } from '../../packs/packContribution'
import { accountOf } from '../domain/accountsReading'
import { billingItemOf } from '../domain/billingPlanReading'
import { categoryOf } from '../domain/categoriesReading'
import { clientRowOf } from '../domain/clientsReading'
import { dismissalOf } from '../domain/dismissalsReading'
import { invoiceKeyOf, invoiceOf } from '../domain/invoicesReading'
import { ledgerEntryOf, ledgerKeyOf, referencedLedgerKey } from '../domain/ledgerReading'
import type { PackRecords } from '../domain/packPart'
import type { WorkbookRecordTypes, WorkbookRecords } from '../domain/readWorkbook'
import { readWorkbook } from '../domain/readWorkbook'
import { keyOfRecordId, recordIdOf } from '../domain/recordId'
import type { RecordId } from '../domain/recordId'
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
} from '../domain/recordKind'
import type { RecordKind } from '../domain/recordKind'
import type { ReadRecord, RecordsRead, RefusedRecord } from '../domain/recordsRead'
import { splitPartOf } from '../domain/splitsReading'
import { refusalOr } from '../domain/storedFields'
import type { StoredFields } from '../domain/storedFields'
import type { Workbook } from '../domain/workbook'
import { fieldsOf, textOf } from './cellReading'
import { installedPackTabs } from './packTabs'
import type { CellValue, CoreTab, SheetRow, WorkbookSnapshot, WorkbookTab } from './workbookSnapshot'
import { ID_COLUMN, OWNER_SHARE_COLUMN, contentColumns } from './workbookTemplate'

/** A row's cells, keyed by header. */
export type Cells = Readonly<Record<string, CellValue>>

/** One row as its tab's mapping hands it to the kind's factory. */
interface StoredRow {
  readonly cells: Cells
  readonly fields: StoredFields
  /** By the key or id the row holds, or null when it lacks it. */
  readonly id: RecordId | null
}

/**
 * How one tab holds one kind of record: the kind, the key or id a row holds, the words that name
 * it, the record the kind's domain factory makes of it, and the cells a record is written as. The
 * factory refuses a row it cannot read by throwing.
 */
export interface SpreadsheetTab<R> {
  readonly tab: WorkbookTab
  readonly kind: RecordKind<R>
  /** The columns the tab needs before anything is written to it. */
  readonly required: readonly string[]
  /** The key the record is kept by, or null when the row lacks it. */
  key(cells: Cells): string | null
  label(cells: Cells): string
  record(row: StoredRow): R
  /** The record as a row holds it: a date as its serial number, an amount as a number, a blank field as an empty string. */
  cells(record: R): Cells
}

/** What names a row that gives nothing to name it by. */
export const UNNAMED = 'unnamed'

/** A cell's text in lower case, as a slug key reads it. */
export function slugText(cell: CellValue | undefined): string {
  return cellText(cell).toLowerCase()
}

/** A date cell as a day, anything else as its text. */
export function dayText(cell: CellValue | undefined): string {
  return typeof cell === 'number' && Number.isFinite(cell) ? civilDateFromSerial(cell) : cellText(cell)
}

/** A label of the parts that are not blank, comma separated. */
export function labelWords(parts: readonly string[]): string {
  return parts.filter((part) => part !== '').join(', ') || UNNAMED
}

/** "month 3", or blank for a blank cell. */
export function labelled(name: string, text: string): string {
  return text === '' ? '' : `${name} ${text}`
}

/** A key, or null when the row leaves it blank. */
export function filledKey(text: string): string | null {
  return text === '' ? null : text
}

/** A date cell as its serial number, blank for no date. */
export function dayCell(date: CivilDate | null): number | string {
  return date === null ? '' : serialFromCivilDate(date)
}

/** The mapping of a tab whose rows carry their record's id in the id column, which `cells` writes beside the record's other cells. */
export function byId<R extends { readonly id: RecordId }, Tab extends WorkbookTab>(
  tab: Tab,
  kind: RecordKind<R>,
  required: readonly string[],
  label: (cells: Cells) => string,
  factory: (fields: StoredFields, id: RecordId | null) => R,
  cells: (record: R) => Cells,
): SpreadsheetTab<R> & { readonly tab: Tab } {
  return {
    tab,
    kind,
    required,
    key: (row) => filledKey(cellText(row[ID_COLUMN])),
    label,
    record: ({ fields, id }) => factory(fields, id),
    cells: (record) => ({ ...cells(record), [ID_COLUMN]: keyOfRecordId(kind, record.id) }),
  }
}

/**
 * The ledger row's key. A row with a reference is known by it even when the ledger's factory refuses
 * the row, so a statement carrying that reference is never added beside it. Null for a refused row
 * without one.
 */
function ledgerKey(cells: Cells): string | null {
  const account = slugText(cells.account)
  const reference = cellText(cells.reference)
  if (account !== '' && reference !== '') {
    return referencedLedgerKey(account, reference)
  }
  if (typeof cells.date !== 'number' || !Number.isFinite(cells.date) || account === '' || typeof cells.amount !== 'number' || typeof cells.balance !== 'number') {
    return null
  }
  return ledgerKeyOf({ account, reference, date: civilDateFromSerial(cells.date), amount: cells.amount, balance: cells.balance, description: cellText(cells.description) })
}

/** The records of each core tab, each by its tab's mapping. */
export const CORE_TABS: { readonly [Tab in CoreTab]: SpreadsheetTab<WorkbookRecordTypes[Tab]> & { readonly tab: Tab } } = {
  ledger: {
    tab: 'ledger',
    kind: LEDGER_RECORDS,
    required: ['date', 'account', 'amount', 'balance'],
    key: ledgerKey,
    label: (cells) => labelWords([dayText(cells.date), cellText(cells.counterparty) || cellText(cells.description), cellText(cells.amount), labelled('balance', cellText(cells.balance))]),
    record: ({ fields, id }) => ledgerEntryOf(fields, id),
    cells: (entry) => ({
      date: serialFromCivilDate(entry.date),
      account: entry.account,
      statement: entry.statement,
      counterparty: entry.counterparty,
      counterparty_iban: entry.counterpartyIban,
      description: entry.description,
      amount: amountOf(entry.amount),
      balance: amountOf(entry.balance),
      category: entry.category,
      flagged_by: entry.flaggedBy,
      reference: entry.reference,
      purpose: entry.signals.purpose,
      tx_domain: entry.signals.txDomain,
      tx_family: entry.signals.txFamily,
      tx_sub_family: entry.signals.txSubFamily,
      creditor_reference: entry.signals.creditorReference,
      instructed_currency: entry.signals.instructedCurrency,
      review_reasons: entry.reviewReasons.join(' | '),
      owner_share: entry.ownerShare ?? '',
    }),
  },
  categories: {
    tab: 'categories',
    kind: CATEGORY_RECORDS,
    required: ['category', 'family', 'bucket'],
    key: (cells) => filledKey(slugText(cells.category)),
    label: (cells) => labelWords([cellText(cells.category)]),
    record: ({ fields, id }) => categoryOf(fields, id),
    cells: (category) => ({
      category: category.slug,
      family: category.family,
      bucket: category.bucket,
      colour: category.colour.stored,
      roles: category.roles.join(', '),
      label: category.label ?? '',
      vat: category.vat === 'none' ? '' : category.vat,
      owner_share: category.ownerShare ?? '',
    }),
  },
  accounts: {
    tab: 'accounts',
    kind: ACCOUNT_RECORDS,
    required: ['account', 'iban'],
    key: (cells) => filledKey(slugText(cells.account)),
    label: (cells) => labelWords([cellText(cells.account)]),
    record: ({ fields, id }) => accountOf(fields, id),
    cells: (account) => ({ account: account.slug, iban: account.iban, currency: account.currency, label: account.label ?? '' }),
  },
  settings: {
    tab: 'settings',
    kind: SETTING_RECORDS,
    required: ['key', 'value'],
    key: (cells) => filledKey(slugText(cells.key)),
    label: (cells) => labelWords([slugText(cells.key)]),
    record: ({ cells }) => ({ key: textOf(cells.key), value: cells.value }),
    cells: (setting) => ({ key: setting.key, value: setting.value ?? '' }),
  },
  rules: {
    tab: 'rules',
    kind: RULE_RECORDS,
    required: [],
    key: (cells) => filledKey(slugText(cells.rule)),
    label: (cells) => labelWords([cellText(cells.rule)]),
    record: ({ cells }) => ({ cells }),
    cells: (rule) => rule.cells,
  },
  invoices: {
    tab: 'invoices',
    kind: INVOICE_RECORDS,
    required: contentColumns('invoices'),
    key: (cells) => (slugText(cells.client) === '' || cellText(cells.number) === '' ? null : invoiceKeyOf({ client: slugText(cells.client), number: cellText(cells.number) })),
    label: (cells) => labelWords([cellText(cells.number)]),
    record: ({ fields, id }) => invoiceOf(fields, id),
    cells: (invoice) => ({
      number: invoice.number,
      client: invoice.client,
      item: invoice.item,
      amount: amountOf(invoice.amount),
      issued: serialFromCivilDate(invoice.issued),
      due: dayCell(invoice.due),
      period_from: dayCell(invoice.deliveryPeriod?.from ?? null),
      period_to: dayCell(invoice.deliveryPeriod?.to ?? null),
    }),
  },
  clients: {
    tab: 'clients',
    kind: CLIENT_RECORDS,
    required: ['client', 'iban'],
    key: (cells) => filledKey(normaliseIban(cellText(cells.iban))),
    label: (cells) => labelWords([cellText(cells.client), cellText(cells.iban)]),
    record: ({ fields, id }) => clientRowOf(fields, id),
    cells: (client) => ({
      client: client.slug,
      name: client.name,
      iban: client.iban,
      address: client.invoicing.address,
      country: client.invoicing.country,
      tax_id: client.invoicing.taxId,
      invoice_mail: client.invoicing.invoiceMail,
      mail_language: client.invoicing.mailLanguage,
      reverse_charge: client.invoicing.reverseCharge ?? '',
    }),
  },
  'outgoing-plan': byId(
    'outgoing-plan',
    BILLING_RECORDS,
    contentColumns('outgoing-plan'),
    (cells) => labelWords([cellText(cells.item), cellText(cells.client), dayText(cells.date), cellText(cells.amount)]),
    billingItemOf,
    (item) => ({ item: item.item, date: serialFromCivilDate(item.date), amount: amountOf(item.amount), client: item.client, description: item.description }),
  ),
  splits: byId(
    'splits',
    SPLIT_PART_RECORDS,
    contentColumns('splits').filter((column) => column !== 'note' && column !== OWNER_SHARE_COLUMN),
    (cells) => labelWords([cellText(cells.category), cellText(cells.amount), dayText(cells.date)]),
    splitPartOf,
    (part) => ({
      date: serialFromCivilDate(part.key.date),
      account: part.key.account,
      row_amount: amountOf(part.key.rowAmount),
      row_balance: amountOf(part.key.rowBalance),
      amount: amountOf(part.amount),
      category: part.category,
      note: part.note,
      owner_share: part.ownerShare ?? '',
    }),
  ),
  dismissed: byId(
    'dismissed',
    DISMISSAL_RECORDS,
    ['kind', 'key'],
    (cells) => labelWords([cellText(cells.key), dayText(cells.dismissed_on)]),
    dismissalOf,
    (dismissal) => ({ kind: dismissal.kind, key: dismissal.key, category: dismissal.category, dismissed_on: dayCell(dismissal.dismissedOn) }),
  ),
}

/** The mapping of a kind, core's or the installed pack's. Throws for a kind no tab holds. */
export function spreadsheetTabOfKind<R>(kind: RecordKind<R>): SpreadsheetTab<R> {
  const mapping = [...Object.values(CORE_TABS), ...installedPackTabs()].find((candidate) => candidate.kind.name === kind.name)
  if (mapping === undefined) {
    throw new Error(`No tab holds ${kind.noun.many}.`)
  }
  return mapping as SpreadsheetTab<unknown> as SpreadsheetTab<R>
}

/** The records a tab's rows hold by the tab's mapping, and the rows the kind's domain refuses, in the order of the rows. */
export function recordsOfRows<R>(mapping: SpreadsheetTab<R>, rows: readonly SheetRow[]): RecordsRead<R> {
  const records: ReadRecord<R>[] = []
  const refused: RefusedRecord[] = []
  for (const { cells } of rows) {
    const key = mapping.key(cells)
    const stored = { cells, fields: fieldsOf(cells), id: key === null ? null : recordIdOf(mapping.kind, key) }
    const label = mapping.label(cells)
    const read = refusalOr(() => mapping.record(stored))
    if ('made' in read) {
      records.push({ record: read.made, id: stored.id, label, fields: stored.fields })
    } else {
      refused.push({ id: stored.id, label, fields: stored.fields, reason: read.refused })
    }
  }
  return { records, refused }
}

/** The records of the installed pack's tabs, by kind. A tab the workbook lacks reads as empty. */
function packRecordsOf(rowsOf: (tab: WorkbookTab) => readonly SheetRow[]): PackRecords {
  return new Map(installedPackTabs().map((mapping) => [mapping.kind.name, recordsOfRows(mapping, rowsOf(mapping.tab))]))
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
