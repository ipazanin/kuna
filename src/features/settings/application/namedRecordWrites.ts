import { normaliseIban } from '../../../shared/text/fold'
import { countedBy, usesOf } from '../../workbook/domain/slug'
import type { SlugUses } from '../../workbook/domain/slug'
import { readAccounts } from '../../workbook/domain/accountsReading'
import { readCategories } from '../../workbook/domain/categoriesReading'
import { readClients } from '../../workbook/domain/clientsReading'
import { slugListOf, slugOf, textOf } from '../../workbook/domain/storedFields'
import type { StoredFields } from '../../workbook/domain/storedFields'
import { accountChangeRefusals } from '../domain/accountGuards'
import { categoryChangeRefusals } from '../domain/categoryGuards'
import { clientChangeRefusals } from '../domain/clientGuards'
import { ACCOUNT_RECORDS, BILLING_RECORDS, CATEGORY_RECORDS, CLIENT_RECORDS, INVOICE_RECORDS, LEDGER_RECORDS, RULE_RECORDS, SETTING_RECORDS, SPLIT_PART_RECORDS } from '../../workbook/domain/recordKind'
import type { RecordKind } from '../../workbook/domain/recordKind'
import { storedFieldsOf } from '../../workbook/domain/recordsRead'
import type { RecordsRead } from '../../workbook/domain/recordsRead'
import type { AccountRecord } from '../../workbook/domain/accountsReading'
import type { CategoryRecord } from '../../workbook/domain/categoriesReading'
import type { ClientRow } from '../../workbook/domain/clientsReading'
import { pickedEdits, pickedUntouched } from '../../workbook/domain/writeRules'
import type { WriteRules } from '../../workbook/domain/writeRules'
import { installedPackKind } from '../../packs/packContribution'

/** The records of a kind, from a fresh read or from the records on screen. */
export type RecordsOfKind = (kind: RecordKind<unknown>) => RecordsRead<unknown>

/** The fields of every stored record a tab holds, refused ones too, by the tab's name in the workbook format. */
type FieldsOf = (tab: string) => readonly StoredFields[]

/** The rules that file rows into each category, by id, as "the rule merchant-model". */
function rulesNaming(rules: readonly StoredFields[]): ReadonlyMap<string, string> {
  const ids = new Map<string, string[]>()
  for (const fields of rules) {
    const category = slugOf(fields.category)
    if (category !== '') ids.set(category, [...(ids.get(category) ?? []), textOf(fields.rule) || 'one without an id'])
  }
  return new Map([...ids].map(([slug, named]) => [slug, named.length === 1 ? `the rule ${named[0]}` : `the rules ${named.join(', ')}`]))
}

/** What names each category outside its tab: ledger rows, rules, owner advances, split parts, year-end konto rows and plan rows. */
export function categoryUses(records: RecordsOfKind): SlugUses {
  const fieldsOfKind = fieldsOfRecords(records)
  return usesOf([
    countedBy(fieldsOfKind('ledger'), (fields) => [slugOf(fields.category)], 'ledger row', 'ledger rows'),
    rulesNaming(fieldsOfKind('rules')),
    countedBy(fieldsOfKind('owner-advances'), (fields) => [slugOf(fields.category)], 'owner advance', 'owner advances'),
    countedBy(fieldsOfKind('splits'), (fields) => [slugOf(fields.category)], 'split part', 'split parts'),
    countedBy(fieldsOfKind('year-end'), (fields) => slugListOf(fields.categories), 'year-end konto row', 'year-end konto rows'),
    countedBy(fieldsOfKind('plan'), (fields) => [slugOf(fields.item)], 'plan tab row', 'plan tab rows'),
  ])
}

/** What names each account outside its tab, which is the ledger's rows. */
export function accountUses(records: RecordsOfKind): SlugUses {
  const fieldsOfKind = fieldsOfRecords(records)
  return usesOf([countedBy(fieldsOfKind('ledger'), (fields) => [slugOf(fields.account)], 'ledger row', 'ledger rows')])
}

/** What names each client outside its tab: invoices, billing plan rows and the billing_client setting. */
function clientUses(records: RecordsOfKind): SlugUses {
  const fieldsOfKind = fieldsOfRecords(records)
  const billingClient = fieldsOfKind('settings').find((fields) => slugOf(fields.key) === 'billing_client')
  return usesOf([
    countedBy(fieldsOfKind('invoices'), (fields) => [slugOf(fields.client)], 'invoice', 'invoices'),
    countedBy(fieldsOfKind('outgoing-plan'), (fields) => [slugOf(fields.client)], 'billing plan row', 'billing plan rows'),
    new Map(billingClient === undefined || slugOf(billingClient.value) === '' ? [] : [[slugOf(billingClient.value), 'the billing_client setting']]),
  ])
}

/** The kind each tab a category, an account or a client is named on holds, the pack's by name since core imports nothing from the pack. */
const NAMING_KINDS: Readonly<Record<string, RecordKind<unknown> | string>> = {
  ledger: LEDGER_RECORDS,
  rules: RULE_RECORDS,
  splits: SPLIT_PART_RECORDS,
  invoices: INVOICE_RECORDS,
  'outgoing-plan': BILLING_RECORDS,
  settings: SETTING_RECORDS,
  'owner-advances': 'owner-advance',
  'year-end': 'year-end-line',
  plan: 'plan-line',
}

function namingKind(tab: string): RecordKind<unknown> | null {
  const kind = NAMING_KINDS[tab]
  return kind === undefined ? null : typeof kind === 'string' ? installedPackKind(kind) : kind
}

function namingKinds(tabs: readonly string[]): RecordKind<unknown>[] {
  return tabs.map(namingKind).filter((kind) => kind !== null)
}

/** The fields of every stored record of the kinds, by the tab that holds them. */
function fieldsOfRecords(records: RecordsOfKind): FieldsOf {
  return (tab) => {
    const kind = namingKind(tab)
    return kind === null ? [] : storedFieldsOf(records(kind))
  }
}

const TABS_NAMING_CATEGORIES = ['ledger', 'rules', 'owner-advances', 'splits', 'year-end', 'plan']

/** A category keeps to the slug format, once on its tab, keeps its name while anything names it, and keeps owner advances in an operating or taxes bucket. */
export const CATEGORY_WRITES: WriteRules<CategoryRecord> = {
  kind: CATEGORY_RECORDS,
  get reads() {
    return namingKinds(TABS_NAMING_CATEGORIES)
  },
  undoable: true,
  read: (read) => readCategories(read),
  refusals: (change, fresh) => {
    const recordsOfKind: RecordsOfKind = (kind) => fresh.of(kind)
    const advances = new Map<string, number>()
    for (const fields of fieldsOfRecords(recordsOfKind)('owner-advances')) {
      const slug = slugOf(fields.category)
      advances.set(slug, (advances.get(slug) ?? 0) + 1)
    }
    return categoryChangeRefusals(
      pickedEdits(change, (fields) => ({ slug: slugOf(fields.category), bucket: slugOf(fields.bucket) })),
      pickedUntouched(change, (fields) => ({ slug: slugOf(fields.category) })).filter((row) => row.slug !== ''),
      { named: categoryUses(recordsOfKind), advances },
    )
  },
}

function accountOfFields(fields: StoredFields): { readonly slug: string; readonly iban: string } {
  return { slug: slugOf(fields.account), iban: normaliseIban(textOf(fields.iban)) }
}

/** An account keeps to the slug format, keeps its name and IBAN while ledger rows name it, and its IBAN is valid, its own and no client's. */
export const ACCOUNT_WRITES: WriteRules<AccountRecord> = {
  kind: ACCOUNT_RECORDS,
  reads: [LEDGER_RECORDS, CLIENT_RECORDS],
  undoable: true,
  read: (read) => readAccounts(read, null),
  refusals: (change, fresh) =>
    accountChangeRefusals(pickedEdits(change, accountOfFields), pickedUntouched(change, accountOfFields).filter((row) => row.slug !== ''), {
      named: accountUses((kind) => fresh.of(kind)),
      clientIbans: new Map(readClients(fresh.of(CLIENT_RECORDS)).facts.map((row) => [row.iban, row.slug])),
    }),
}

function clientOfFields(fields: StoredFields): { readonly slug: string; readonly name: string; readonly iban: string } {
  return { slug: slugOf(fields.client), name: textOf(fields.name), iban: normaliseIban(textOf(fields.iban)) }
}

/** A client keeps to the slug format, keeps its name while invoices, plan rows or billing_client name it, and its IBAN is valid, its own and none of the accounts'. */
export const CLIENT_WRITES: WriteRules<ClientRow> = {
  kind: CLIENT_RECORDS,
  reads: [ACCOUNT_RECORDS, INVOICE_RECORDS, BILLING_RECORDS, SETTING_RECORDS],
  undoable: true,
  read: (read) => readClients(read),
  refusals: (change, fresh) =>
    clientChangeRefusals(pickedEdits(change, clientOfFields), pickedUntouched(change, clientOfFields).filter((row) => row.slug !== ''), {
      named: clientUses((kind) => fresh.of(kind)),
      accountIbans: new Map(readAccounts(fresh.of(ACCOUNT_RECORDS), null).facts.flatMap((account) => (account.iban === '' ? [] : [[account.iban, account.slug] as const]))),
    }),
}
