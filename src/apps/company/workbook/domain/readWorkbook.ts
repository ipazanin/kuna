import { readRules } from '../../rules/domain/readRules'
import type { RuleTabRow } from '../../rules/domain/readRules'
import { readSettingsTab } from '../../settings/domain/settings'
import type { SettingRow } from '../../../../shared/storage/domain/settingRows'
import type { AccountRecord } from './accountsReading'
import { readAccounts } from './accountsReading'
import type { BillingItem } from './billingPlan'
import { readBillingPlan } from './billingPlanReading'
import type { CategoryRecord } from './categoriesReading'
import { readCategories, withoutIds } from './categoriesReading'
import { readClients } from './clientsReading'
import type { ClientRecord } from './clientsReading'
import {
  ACCOUNT_RECORDS,
  BILLING_RECORDS,
  CATEGORY_RECORDS,
  CLIENT_RECORDS,
  DISMISSAL_RECORDS,
  INVOICE_RECORDS,
  ITEM_RECORDS,
  LEDGER_RECORDS,
  RULE_RECORDS,
  SETTING_RECORDS,
  SPLIT_PART_RECORDS,
} from './coreKinds'
import type { Dismissal } from './dismissals'
import { readDismissals } from './dismissalsReading'
import { readInvoices } from './invoicesReading'
import type { ItemRecord } from './splitsReading'
import { readLedger } from './ledgerReading'
import type { LedgerEntry } from './ledgerReading'
import { packRecordsOf, recordsOfKind } from './packPart'
import type { PackPart, PackRecords } from './packPart'
import type { RecordKind } from '../../../../shared/storage/domain/recordKind'
import { recordWithId, recordsOf } from '../../../../shared/storage/domain/recordsRead'
import type { Reading, RecordsRead } from '../../../../shared/storage/domain/recordsRead'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { UNCLASSIFIED } from './bucket'
import { storesItems } from './rowItems'
import { rowFiledAs } from './splits'
import type { LedgerSplit, SplitPart } from './splits'
import { readItemInvoices, readItems, readSplits, rowWithoutItems } from './splitsReading'
import type { SplitTabRow } from './splitsReading'
import { tabProblems } from './workbook'
import type { Category, Invoice, Transaction, Workbook, WorkbookProblem } from './workbook'

/** The record type of each part of the workbook core reads, by its name in the workbook format. */
export interface WorkbookRecordTypes {
  readonly ledger: LedgerEntry
  readonly categories: CategoryRecord
  readonly accounts: AccountRecord
  readonly settings: SettingRow
  readonly rules: RuleTabRow
  readonly invoices: Invoice
  readonly clients: ClientRecord
  readonly 'outgoing-plan': BillingItem
  readonly splits: SplitTabRow
  readonly items: ItemRecord
  readonly dismissed: Dismissal
}

/** What a storage holds of every kind of record. */
export type WorkbookRecords = { readonly [Part in keyof WorkbookRecordTypes]: RecordsRead<WorkbookRecordTypes[Part]> } & {
  /** The records of the installed pack's kinds. */
  readonly pack: PackRecords
}

/** The part of the records each core kind is held in. */
const CORE_PARTS: ReadonlyMap<string, keyof WorkbookRecordTypes> = new Map([
  [LEDGER_RECORDS.name, 'ledger'],
  [CATEGORY_RECORDS.name, 'categories'],
  [ACCOUNT_RECORDS.name, 'accounts'],
  [SETTING_RECORDS.name, 'settings'],
  [RULE_RECORDS.name, 'rules'],
  [INVOICE_RECORDS.name, 'invoices'],
  [CLIENT_RECORDS.name, 'clients'],
  [BILLING_RECORDS.name, 'outgoing-plan'],
  [SPLIT_PART_RECORDS.name, 'splits'],
  [ITEM_RECORDS.name, 'items'],
  [DISMISSAL_RECORDS.name, 'dismissed'],
])

/** What the records hold of a kind, core's or the installed pack's. */
export function recordsOfKindIn<R>(records: WorkbookRecords, kind: RecordKind<R>): RecordsRead<R> {
  const part = CORE_PARTS.get(kind.name)
  return part === undefined ? recordsOfKind(records.pack, kind) : (records[part] as RecordsRead<unknown> as RecordsRead<R>)
}

/** Whether the records hold a kind, core's or the installed pack's. */
export function holdsKind(records: WorkbookRecords, kind: RecordKind<unknown>): boolean {
  return CORE_PARTS.has(kind.name) || records.pack.has(kind.name)
}

/** The records with what they hold of one kind put in place, core's or the installed pack's. */
export function withRecordsOfKind<R>(records: WorkbookRecords, kind: RecordKind<R>, read: RecordsRead<R>): WorkbookRecords {
  const part = CORE_PARTS.get(kind.name)
  return part === undefined ? { ...records, pack: new Map([...records.pack, [kind.name, read as RecordsRead<unknown>]]) } : { ...records, [part]: read }
}

/** The records of every kind, core's and the pack's, as `of` gives each kind. */
export function workbookRecordsOf(of: <R>(kind: RecordKind<R>) => RecordsRead<R>, pack: PackPart<unknown, unknown> | null): WorkbookRecords {
  return {
    ledger: of(LEDGER_RECORDS),
    categories: of(CATEGORY_RECORDS),
    accounts: of(ACCOUNT_RECORDS),
    settings: of(SETTING_RECORDS),
    rules: of(RULE_RECORDS),
    invoices: of(INVOICE_RECORDS),
    clients: of(CLIENT_RECORDS),
    'outgoing-plan': of(BILLING_RECORDS),
    splits: of(SPLIT_PART_RECORDS),
    items: of(ITEM_RECORDS),
    dismissed: of(DISMISSAL_RECORDS),
    pack: packRecordsOf(
      (pack?.kinds ?? []).map((rules) => rules.kind),
      (kind) => of(kind),
    ),
  }
}

/** The records that hold the ledger rows and their items, in either shape. */
type ItemRecords = Pick<WorkbookRecords, 'ledger' | 'splits' | 'items'>

/** The items of each row whose items count, by the row's record id, and the problems of the tabs that hold them. */
interface LedgerItems {
  readonly itemsByRow: ReadonlyMap<RecordId, readonly SplitPart[]>
  readonly problems: readonly WorkbookProblem[]
}

/** The items as books from before items keep them: the parts of each split the guards pass, and every other row as its own one item. */
function itemsOfSplitsTab(records: ItemRecords, transactions: readonly Transaction[], categories: readonly Category[]): LedgerItems {
  const { splits, problems } = readSplits(records.splits, transactions, categories)
  return { itemsByRow: new Map(splits.map((split) => [split.row.id, split.parts])), problems: tabProblems('splits', problems) }
}

/** The items of the items tab, and a problem on each ledger row it holds none of. */
function itemsOfItemsTab(records: ItemRecords, transactions: readonly Transaction[], categories: readonly Category[]): LedgerItems {
  const { itemsByRow, problems, rowsWithoutItems } = readItems(records.items, transactions, categories)
  const unnamed = rowsWithoutItems.map((row) => rowWithoutItems({ id: row.id, label: recordWithId(records.ledger, row.id)?.label ?? row.date }))
  return { itemsByRow, problems: [...tabProblems('items', problems), ...tabProblems('ledger', unnamed)] }
}

/** The rows filed by their items, with the items of each row whose items count and the problems of the tabs that hold them. */
interface FiledLedger extends LedgerItems {
  readonly transactions: readonly Transaction[]
}

/**
 * Each ledger row filed as its items: a row of one item as that item. On the items tab a row of several counts whole as the item
 * of the category most of its money is in, and a row whose items do not count waits on To review. Books from before items keep the
 * category a split row's ledger cell holds, and a row whose split does not count keeps its own.
 */
function ledgerItemsOf(records: ItemRecords, ledger: readonly Transaction[], categories: readonly Category[]): FiledLedger {
  const onItemsTab = storesItems(records)
  const items = (onItemsTab ? itemsOfItemsTab : itemsOfSplitsTab)(records, ledger, categories)
  const transactions = ledger.map((row): Transaction => {
    const held = items.itemsByRow.get(row.id)
    if (held !== undefined && (held.length === 1 || onItemsTab)) return rowFiledAs(row, held)
    return onItemsTab ? { ...row, category: '', family: UNCLASSIFIED, bucket: UNCLASSIFIED, ownerShare: null } : row
  })
  return { ...items, transactions }
}

/** The ledger rows each filed as its items, with the rows of several items, in either shape, as a check of a write reads them. */
export function ledgerOfRecords(records: ItemRecords, categories: readonly Category[]): Pick<Workbook, 'transactions' | 'splits' | 'categories'> {
  const { transactions, itemsByRow } = ledgerItemsOf(records, readLedger(records.ledger, categories).facts, categories)
  return { transactions, splits: splitsOf(transactions, itemsByRow), categories }
}

/** Which workbook the records are of. */
export type WorkbookIdentity = Pick<Workbook, 'id' | 'source' | 'title' | 'syncedAt'>

/** The company's records and the workbook they make, which its store keeps on screen. */
export interface CompanyBooks {
  readonly records: WorkbookRecords
  readonly workbook: Workbook
}

/**
 * Turns the records into the workbook the screens read, with the rules across records: keys that
 * more than one record holds, and references to categories and clients that the workbook lacks. A
 * missing kind reads as empty, and settings default. The rules are read against the categories
 * read here. Books in either shape read alike: each ledger row counts as its items, as
 * `ledgerItemsOf` files it. The pack, when one is installed, then makes its part from its
 * records, the values of its settings keys and core's workbook.
 */
export function readWorkbook(identity: WorkbookIdentity, records: WorkbookRecords, pack: PackPart<unknown, unknown> | null): Workbook {
  const problems: WorkbookProblem[] = []
  const keep = <Fact>(tab: WorkbookProblem['tab'], reading: Reading<Fact>): readonly Fact[] => {
    problems.push(...tabProblems(tab, reading.problems))
    return reading.facts
  }
  const settingsTab = readSettingsTab(recordsOf(records.settings), pack?.settings ?? null)
  problems.push(...tabProblems('settings', settingsTab.problems))
  const { settings } = settingsTab
  const categories: Category[] = withoutIds(keep('categories', readCategories(records.categories)))
  const clients = withoutIds(keep('clients', readClients(records.clients)))
  const clientSlugs = new Set(clients.map((client) => client.slug))
  const categorySlugs = new Set(categories.map((category) => category.slug))
  const ledger = keep('ledger', readLedger(records.ledger, categories))
  const rules = readRules(recordsOf(records.rules), categorySlugs)
  problems.push(...tabProblems('rules', rules.problems))
  const items = ledgerItemsOf(records, ledger, categories)
  problems.push(...items.problems)
  const { transactions } = items
  const invoices = keep('invoices', readInvoices(records.invoices, clientSlugs))
  const core: Workbook = {
    ...identity,
    transactions,
    categories,
    accounts: withoutIds(keep('accounts', readAccounts(records.accounts, settings.currency))),
    rules: rules.rules,
    invoices,
    clients,
    billingPlan: keep('outgoing-plan', readBillingPlan(records['outgoing-plan'], clientSlugs)),
    ownerAdvances: [],
    splits: splitsOf(transactions, items.itemsByRow),
    rowsKeptWhole: new Map(),
    dismissals: keep('dismissed', readDismissals(records.dismissed)),
    settings,
    packParts: {},
    problems,
    ...(placesPayments(records) ? { paidInvoices: paidInvoicesOf(records.items, items.itemsByRow, invoices, problems) } : {}),
  }
  if (pack === null) {
    return core
  }
  const { part, problems: partProblems } = pack.assemble(records.pack, settingsTab.packValues, core, storesItems(records))
  return {
    ...core,
    ownerAdvances: pack.ownerAdvances(part),
    rowsKeptWhole: pack.rowsKeptWhole(records.pack, core),
    packParts: { [pack.key.name]: part },
    problems: [...problems, ...partProblems],
  }
}

/**
 * Whether the books store which invoice each payment pays, which they do once an item names one. Books with an items tab that name
 * none, as those started on the items tab before payments were placed, match the payments to the invoices on every read, as books
 * from before items do.
 */
function placesPayments(records: ItemRecords): boolean {
  return storesItems(records) && records.items.records.some(({ record }) => record.invoice !== null)
}

/** The invoice each counted item pays, by the item's id, with a problem on the items tab for each item that names an invoice the books lack. */
function paidInvoicesOf(
  read: RecordsRead<ItemRecord>,
  itemsByRow: ReadonlyMap<RecordId, readonly SplitPart[]>,
  invoices: readonly Invoice[],
  problems: WorkbookProblem[],
): ReadonlyMap<RecordId, RecordId> {
  const counted = new Set([...itemsByRow.values()].flatMap((parts) => parts.map((part) => part.id)))
  const { paid, problems: unknown } = readItemInvoices(read, counted, new Set(invoices.map((invoice) => invoice.id)))
  problems.push(...tabProblems('items', unknown))
  return paid
}

/** The rows of several items, each with its items, in the order the tab holds their first items. */
function splitsOf(transactions: readonly Transaction[], itemsByRow: ReadonlyMap<RecordId, readonly SplitPart[]>): LedgerSplit[] {
  const rowOf = new Map(transactions.map((row) => [row.id, row]))
  return [...itemsByRow].flatMap(([id, parts]) => {
    const row = rowOf.get(id)
    return row === undefined || parts.length < 2 ? [] : [{ row, parts }]
  })
}
