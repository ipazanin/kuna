import { normaliseIban } from '../../../../shared/text/fold'
import { ACCOUNT_RECORDS, BILLING_RECORDS, CATEGORY_RECORDS, CLIENT_RECORDS, INVOICE_RECORDS, LEDGER_RECORDS, RULE_RECORDS, SETTING_RECORDS, SPLIT_PART_RECORDS } from '../../workbook/domain/coreKinds'
import { countedBy, usesOf } from '../../workbook/domain/slug'
import type { SlugUses } from '../../workbook/domain/slug'
import { readAccounts } from '../../workbook/domain/accountsReading'
import { ibanListOf } from '../../workbook/domain/iban'
import { readCategories } from '../../workbook/domain/categoriesReading'
import { readClients } from '../../workbook/domain/clientsReading'
import { slugListOf, slugOf, textOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'
import { accountChangeRefusals } from '../domain/accountGuards'
import { categoryChangeRefusals, categoryColourRefusals, categoryRoleRefusals, categoryShareRefusals, knownRoles } from '../domain/categoryGuards'
import { storedOwnerShare } from '../../owner-share/domain/ownerShare'
import type { OwnerShare } from '../../owner-share/domain/ownerShare'
import { clientChangeRefusals } from '../domain/clientGuards'
import type { RecordKind } from '../../../../shared/storage/domain/recordKind'
import { storedFieldsOf } from '../../../../shared/storage/domain/recordsRead'
import type { RecordsRead } from '../../../../shared/storage/domain/recordsRead'
import type { AccountRecord } from '../../workbook/domain/accountsReading'
import type { CategoryRecord } from '../../workbook/domain/categoriesReading'
import type { ClientRecord } from '../../workbook/domain/clientsReading'
import { pickedEdits, pickedUntouched } from '../../../../shared/storage/domain/writeRules'
import type { WriteRules } from '../../../../shared/storage/domain/writeRules'
import { installedPack } from '../../packs/packContribution'

/** The records of a kind, from a fresh read or from the records on screen. */
export type RecordsOfKind = (kind: RecordKind<unknown>) => RecordsRead<unknown>

/** The rules that file rows into each category, by id, as "the rule merchant-model". */
function rulesNaming(rules: readonly StoredFields[]): ReadonlyMap<string, string> {
  const ids = new Map<string, string[]>()
  for (const fields of rules) {
    const category = slugOf(fields.category)
    if (category !== '') ids.set(category, [...(ids.get(category) ?? []), textOf(fields.rule) || 'one without an id'])
  }
  return new Map([...ids].map(([slug, named]) => [slug, named.length === 1 ? `the rule ${named[0]}` : `the rules ${named.join(', ')}`]))
}

/** What names each category outside its tab: ledger rows, rules, split parts and the pack's records that name one. */
export function categoryUses(records: RecordsOfKind): SlugUses {
  return usesOf([
    countedBy(storedFieldsOf(records(LEDGER_RECORDS)), (fields) => [slugOf(fields.category)], 'ledger row', 'ledger rows'),
    rulesNaming(storedFieldsOf(records(RULE_RECORDS))),
    countedBy(storedFieldsOf(records(SPLIT_PART_RECORDS)), (fields) => [slugOf(fields.category)], 'split part', 'split parts'),
    ...(installedPack().workbook?.categoryNaming ?? []).map((naming) => countedBy(storedFieldsOf(records(naming.kind)), (fields) => naming.categoriesOf(fields), naming.one, naming.many)),
  ])
}

/** What names each account outside its tab, which is the ledger's rows. */
export function accountUses(records: RecordsOfKind): SlugUses {
  return usesOf([countedBy(storedFieldsOf(records(LEDGER_RECORDS)), (fields) => [slugOf(fields.account)], 'ledger row', 'ledger rows')])
}

/** What names each client outside its tab: invoices, billing plan rows and the billing_client setting. */
function clientUses(records: RecordsOfKind): SlugUses {
  const billingClient = storedFieldsOf(records(SETTING_RECORDS)).find((fields) => slugOf(fields.key) === 'billing_client')
  return usesOf([
    countedBy(storedFieldsOf(records(INVOICE_RECORDS)), (fields) => [slugOf(fields.client)], 'invoice', 'invoices'),
    countedBy(storedFieldsOf(records(BILLING_RECORDS)), (fields) => [slugOf(fields.client)], 'billing plan row', 'billing plan rows'),
    new Map(billingClient === undefined || slugOf(billingClient.value) === '' ? [] : [[slugOf(billingClient.value), 'the billing_client setting']]),
  ])
}

/** How many owner advances carry each category, none without the pack. */
function advancesByCategory(records: RecordsOfKind): ReadonlyMap<string, number> {
  const naming = installedPack().workbook?.ownerAdvanceNaming
  const advances = new Map<string, number>()
  if (naming === undefined) {
    return advances
  }
  for (const fields of storedFieldsOf(records(naming.kind))) {
    for (const slug of naming.categoriesOf(fields)) {
      advances.set(slug, (advances.get(slug) ?? 0) + 1)
    }
  }
  return advances
}

function categoryFieldsOf(fields: StoredFields): { readonly slug: string; readonly bucket: string; readonly colour: string; readonly roles: readonly string[]; readonly ownerShare: OwnerShare | null } {
  return { slug: slugOf(fields.category), bucket: slugOf(fields.bucket), colour: textOf(fields.colour), roles: slugListOf(fields.roles), ownerShare: storedOwnerShare(fields.owner_share) }
}

/**
 * A category keeps to the slug format, once on its tab, keeps its name while anything names it, and
 * keeps owner advances in an operating or taxes bucket. Unless Undo puts them back, a colour it is
 * given comes from the palette, a role it is given is one the app knows, and an owner share it holds
 * keeps to the share guards.
 */
export const CATEGORY_WRITES: WriteRules<CategoryRecord> = {
  kind: CATEGORY_RECORDS,
  get reads() {
    return [LEDGER_RECORDS, RULE_RECORDS, SPLIT_PART_RECORDS, ...(installedPack().workbook?.categoryNaming.map((naming) => naming.kind) ?? [])]
  },
  undoable: true,
  read: (read) => readCategories(read),
  refusals: (change, fresh) => {
    const recordsOfKind: RecordsOfKind = (kind) => fresh.of(kind)
    const edits = pickedEdits(change, categoryFieldsOf)
    return [
      ...categoryChangeRefusals(edits, pickedUntouched(change, (fields) => ({ slug: slugOf(fields.category) })).filter((row) => row.slug !== ''), {
        named: categoryUses(recordsOfKind),
        advances: advancesByCategory(recordsOfKind),
      }),
      ...(change.undoing
        ? []
        : [
            ...categoryColourRefusals(edits),
            ...categoryRoleRefusals(edits, knownRoles(installedPack().workbook?.categoryRoles ?? [])),
            ...categoryShareRefusals(edits, change.after.records.map((stored) => categoryFieldsOf(stored.fields))),
          ]),
    ]
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
      clientIbans: new Map(readClients(fresh.of(CLIENT_RECORDS)).facts.flatMap((client) => client.ibans.map((iban) => [iban, client.slug] as const))),
    }),
}

function clientCellsOf(fields: StoredFields): { readonly slug: string; readonly ibans: readonly string[] } {
  return { slug: slugOf(fields.client), ibans: ibanListOf(textOf(fields.iban)) }
}

/** A client keeps to the slug format and to one row, keeps its name while invoices, plan rows or billing_client name it, and its IBANs are valid, its own and none of the accounts'. */
export const CLIENT_WRITES: WriteRules<ClientRecord> = {
  kind: CLIENT_RECORDS,
  reads: [ACCOUNT_RECORDS, INVOICE_RECORDS, BILLING_RECORDS, SETTING_RECORDS],
  undoable: true,
  read: (read) => readClients(read),
  refusals: (change, fresh) =>
    clientChangeRefusals(pickedEdits(change, clientCellsOf), pickedUntouched(change, clientCellsOf).filter((client) => client.slug !== ''), {
      named: clientUses((kind) => fresh.of(kind)),
      accountIbans: new Map(readAccounts(fresh.of(ACCOUNT_RECORDS), null).facts.flatMap((account) => (account.iban === '' ? [] : [[account.iban, account.slug] as const]))),
    }),
}
