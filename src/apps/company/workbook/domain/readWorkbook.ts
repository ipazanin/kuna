import { readRules } from '../../rules/domain/readRules'
import type { RuleTabRow } from '../../rules/domain/readRules'
import { readSettingsTab } from '../../settings/domain/settings'
import type { SettingRow } from '../../settings/domain/settings'
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
  LEDGER_RECORDS,
  RULE_RECORDS,
  SETTING_RECORDS,
  SPLIT_PART_RECORDS,
} from './coreKinds'
import type { Dismissal } from './dismissals'
import { readDismissals } from './dismissalsReading'
import { readInvoices } from './invoicesReading'
import { readLedger } from './ledgerReading'
import type { LedgerEntry } from './ledgerReading'
import { packRecordsOf, recordsOfKind } from './packPart'
import type { PackPart, PackRecords } from './packPart'
import type { RecordKind } from '../../../../shared/storage/domain/recordKind'
import { recordsOf } from '../../../../shared/storage/domain/recordsRead'
import type { Reading, RecordsRead } from '../../../../shared/storage/domain/recordsRead'
import { readSplits } from './splitsReading'
import type { SplitTabRow } from './splitsReading'
import { tabProblems } from './workbook'
import type { Category, Invoice, Workbook, WorkbookProblem } from './workbook'

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
  [DISMISSAL_RECORDS.name, 'dismissed'],
])

/** What the records hold of a kind, core's or the installed pack's. */
export function recordsOfKindIn<R>(records: WorkbookRecords, kind: RecordKind<R>): RecordsRead<R> {
  const part = CORE_PARTS.get(kind.name)
  return part === undefined ? recordsOfKind(records.pack, kind) : (records[part] as RecordsRead<unknown> as RecordsRead<R>)
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
    dismissed: of(DISMISSAL_RECORDS),
    pack: packRecordsOf(
      (pack?.kinds ?? []).map((rules) => rules.kind),
      (kind) => of(kind),
    ),
  }
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
 * read here. The pack, when one is installed, then makes its part from its records, the values of
 * its settings keys and core's workbook.
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
  const transactions = keep('ledger', readLedger(records.ledger, categories))
  const rules = readRules(recordsOf(records.rules), categorySlugs)
  problems.push(...tabProblems('rules', rules.problems))
  const splits = readSplits(records.splits, transactions, categories)
  problems.push(...tabProblems('splits', splits.problems))
  const core: Workbook = {
    ...identity,
    transactions,
    categories,
    accounts: withoutIds(keep('accounts', readAccounts(records.accounts, settings.currency))),
    rules: rules.rules,
    invoices: keep('invoices', readInvoices(records.invoices, clientSlugs)),
    clients,
    billingPlan: keep('outgoing-plan', readBillingPlan(records['outgoing-plan'], clientSlugs)),
    ownerAdvances: [],
    splits: splits.splits,
    rowsKeptWhole: new Map(),
    dismissals: keep('dismissed', readDismissals(records.dismissed)),
    settings,
    packParts: {},
    problems,
  }
  if (pack === null) {
    return core
  }
  const { part, problems: partProblems } = pack.assemble(records.pack, settingsTab.packValues, core)
  return {
    ...core,
    ownerAdvances: pack.ownerAdvances(part),
    rowsKeptWhole: pack.rowsKeptWhole(records.pack, core),
    packParts: { [pack.key.name]: part },
    problems: [...problems, ...partProblems],
  }
}
