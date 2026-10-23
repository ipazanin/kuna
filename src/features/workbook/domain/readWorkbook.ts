import { readRules } from '../../rules/domain/readRules'
import type { RuleTabRow } from '../../rules/domain/readRules'
import { orderTies } from '../../rules/domain/rule'
import type { Rule } from '../../rules/domain/rule'
import { readSettingsTab } from '../../settings/domain/settings'
import type { SettingRow } from '../../settings/domain/settings'
import type { AccountRecord } from './accountsReading'
import { readAccounts } from './accountsReading'
import type { BillingItem } from './billingPlan'
import { readBillingPlan } from './billingPlanReading'
import type { CategoryRecord } from './categoriesReading'
import { readCategories, withoutIds } from './categoriesReading'
import { clientsOf, readClients } from './clientsReading'
import type { ClientRow } from './clientsReading'
import type { Dismissal } from './dismissals'
import { readDismissals } from './dismissalsReading'
import { readInvoices } from './invoicesReading'
import { readLedger } from './ledgerReading'
import type { LedgerEntry } from './ledgerReading'
import { recordsOfKind } from './packPart'
import type { PackPart, PackRecords } from './packPart'
import { recordIdOf } from './recordId'
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
} from './recordKind'
import type { RecordKind } from './recordKind'
import { recordsOf } from './recordsRead'
import type { Reading, RecordsRead } from './recordsRead'
import { readSplits } from './splitsReading'
import type { SplitTabRow } from './splitsReading'
import { tabProblems } from './workbook'
import type { Category, Invoice, RecordProblem, Workbook, WorkbookProblem } from './workbook'

/** The record type of each part of the workbook core reads, by its name in the workbook format. */
export interface WorkbookRecordTypes {
  readonly ledger: LedgerEntry
  readonly categories: CategoryRecord
  readonly accounts: AccountRecord
  readonly settings: SettingRow
  readonly rules: RuleTabRow
  readonly invoices: Invoice
  readonly clients: ClientRow
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

/** Which workbook the records are of, and whether its storage holds a clients tab, which the rules need. */
export type WorkbookIdentity = Pick<Workbook, 'id' | 'source' | 'title' | 'syncedAt' | 'hasClientsTab'>

/**
 * Turns the records into the workbook the screens read, with the rules across records: keys that
 * more than one record holds, and references to categories and clients that the workbook lacks. A
 * missing kind reads as empty, and settings default. The rules are read the way `Rules.gs` reads
 * them, against the categories read here. The pack, when one is installed, then makes its part from
 * its records, the values of its settings keys and core's workbook.
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
  const clients = clientsOf(keep('clients', readClients(records.clients)))
  const clientSlugs = new Set(clients.map((client) => client.slug))
  const categorySlugs = new Set(categories.map((category) => category.slug))
  const transactions = keep('ledger', readLedger(records.ledger, categories))
  const splits = readSplits(records.splits, transactions, categories)
  problems.push(...tabProblems('splits', splits.problems))
  const core: Workbook = {
    ...identity,
    transactions,
    categories,
    accounts: withoutIds(keep('accounts', readAccounts(records.accounts, settings.currency))),
    rules: readRulesOf(records.rules, categorySlugs, identity.hasClientsTab, problems),
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

/** The rules as `readRules` reads them, with enabled rules that share an order reported, since the app and `Rules.gs` break that tie differently. */
function readRulesOf(read: RecordsRead<RuleTabRow>, categorySlugs: ReadonlySet<string>, hasClientsTab: boolean, problems: WorkbookProblem[]): readonly Rule[] {
  const rules = readRules(recordsOf(read), categorySlugs, hasClientsTab)
  const tied = orderTies(rules.rules).flatMap((tie) =>
    tie.map((rule): RecordProblem => {
      const others = tie.filter((other) => other !== rule).map((other) => other.id)
      const reason = `shares the order ${rule.order} with ${others.join(' and ')}, so the app tries them by id and the Apps Script by row. Give each its own order`
      return { id: recordIdOf(RULE_RECORDS, rule.id.toLowerCase()), label: rule.id, reason }
    }),
  )
  problems.push(...tabProblems('rules', [...rules.problems, ...tied]))
  return rules.rules
}
