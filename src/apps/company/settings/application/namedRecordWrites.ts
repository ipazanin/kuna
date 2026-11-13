import { normaliseIban } from '../../../../shared/text/fold'
import {
  ACCOUNT_RECORDS,
  BILLING_RECORDS,
  CATEGORY_RECORDS,
  CLIENT_RECORDS,
  INVOICE_RECORDS,
  ITEM_RECORDS,
  LEDGER_RECORDS,
  RULE_RECORDS,
  SETTING_RECORDS,
  SPLIT_PART_RECORDS,
} from '../../workbook/domain/coreKinds'
import { counted, countedBy, countsBy, usesOf } from '../../workbook/domain/slug'
import type { SlugUses } from '../../workbook/domain/slug'
import { readAccounts } from '../../workbook/domain/accountsReading'
import { ibanListOf } from '../../workbook/domain/iban'
import { readCategories } from '../../workbook/domain/categoriesReading'
import { readClients } from '../../workbook/domain/clientsReading'
import { slugListOf, slugOf, textOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'
import { accountChangeRefusals } from '../domain/accountGuards'
import { categoryChangeRefusals, categoryClassRefusals, categoryColourRefusals, categoryRoleRefusals, categoryShareRefusals, knownRoles } from '../domain/categoryGuards'
import { storedOwnerShare } from '../../owner-share/domain/ownerShare'
import type { OwnerShare } from '../../owner-share/domain/ownerShare'
import { clientChangeRefusals } from '../domain/clientGuards'
import type { RecordKind, RecordNoun } from '../../../../shared/storage/domain/recordKind'
import type { EditedOn } from '../../workbook/domain/packPart'
import { recordsOf, storedFieldsOf } from '../../../../shared/storage/domain/recordsRead'
import type { RecordsRead } from '../../../../shared/storage/domain/recordsRead'
import type { AccountRecord } from '../../workbook/domain/accountsReading'
import type { CategoryRecord } from '../../workbook/domain/categoriesReading'
import type { ClientRecord } from '../../workbook/domain/clientsReading'
import { pickedEdits, pickedUntouched } from '../../../../shared/storage/domain/writeRules'
import type { WriteRules } from '../../../../shared/storage/domain/writeRules'
import { installedPack } from '../../packs/packContribution'
import { LEDGER_WRITES } from '../../imports/application/ledgerWrites'
import { RULE_WRITES } from '../../rules/application/ruleWrites'
import { ITEM_WRITES } from '../../transactions/application/itemWrites'
import { SPLIT_WRITES } from '../../transactions/application/splitWrites'
import type { ShareDefault } from '../../owner-share/domain/ownerShare'
import type { WorkbookRecords } from '../../workbook/domain/readWorkbook'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'
import { categoryMove, keptByMove } from '../domain/categoryMove'
import type { CategoryMove, KeptByMove, PackNamedRecords } from '../domain/categoryMove'
import { recordsOfKindIn } from '../../workbook/domain/readWorkbook'
import { words } from './words'

/** The records of a kind, from a fresh read or from the records on screen. */
export type RecordsOfKind = (kind: RecordKind<unknown>) => RecordsRead<unknown>

/** The rules that file rows into each category, by id, as "the rule merchant-model". */
function rulesNaming(rules: readonly StoredFields[]): ReadonlyMap<string, string> {
  const ids = new Map<string, string[]>()
  for (const fields of rules) {
    const category = slugOf(fields.category)
    if (category !== '') ids.set(category, [...(ids.get(category) ?? []), textOf(fields.rule) || words.uses.ruleWithoutId])
  }
  return new Map([...ids].map(([slug, named]) => [slug, named.length === 1 ? words.uses.rule(named[0]!) : words.uses.rules(named.join(', '))]))
}

/** What names each category outside its tab: ledger rows, rules, split parts and the pack's records that name one. */
export function categoryUses(records: RecordsOfKind): SlugUses {
  return usesOf([
    countedBy(storedFieldsOf(records(LEDGER_RECORDS)), (fields) => [slugOf(fields.category)], counted(words.uses.ledgerRows)),
    rulesNaming(storedFieldsOf(records(RULE_RECORDS))),
    countedBy(storedFieldsOf(records(SPLIT_PART_RECORDS)), (fields) => [slugOf(fields.category)], counted(words.uses.splitParts)),
    ...itemUses(storedFieldsOf(records(ITEM_RECORDS))),
    ...packNaming(records),
  ])
}

/** What the items tab names each category by: the one item of a row as that ledger row, and an item of a split row as a split part. */
function itemUses(items: readonly StoredFields[]): ReadonlyMap<string, string>[] {
  const perRow = countsBy(items, (fields) => [textOf(fields.row_id)])
  const ofSplit = (fields: StoredFields) => (perRow.get(textOf(fields.row_id)) ?? 0) > 1
  return [
    countedBy(
      items.filter((fields) => !ofSplit(fields)),
      (fields) => [slugOf(fields.category)],
      counted(words.uses.ledgerRows),
    ),
    countedBy(items.filter(ofSplit), (fields) => [slugOf(fields.category)], counted(words.uses.splitParts)),
  ]
}

/** The pack's records that name categories, of each of its kinds. */
function packNamedRecords(records: RecordsOfKind): PackNamedRecords[] {
  return (installedPack().workbook?.categoryNaming ?? []).map((naming) => ({ naming, records: records(naming.writes.kind) }))
}

function packNaming(records: RecordsOfKind): ReadonlyMap<string, string>[] {
  return packNamedRecords(records).map(({ naming, records: read }) =>
    countedBy(
      storedFieldsOf(read),
      (fields) => naming.categoriesOf(fields),
      (count) => installedPack().categoryNamingWords(naming.writes.kind.name).counted(count),
    ),
  )
}

/** What a move into another category leaves naming each category: the pack's records it cannot rewrite, each with the screen that fixes them. */
export function categoryKeptAfterMove(records: RecordsOfKind): ReadonlyMap<string, readonly KeptByMove[]> {
  return keptByMove(packNamedRecords(records))
}

/** What a move leaves naming a category, such as "1 plan tab row", with each screen where a person fixes those once. */
export function keptInWords(kept: readonly KeptByMove[]): { readonly uses: readonly string[]; readonly places: readonly (EditedOn & { readonly label: string })[] } {
  const named = kept.map((use) => ({ use, words: installedPack().categoryNamingWords(use.kind.name) }))
  return {
    uses: named.map(({ use, words: said }) => said.counted(use.count)),
    places: [...new Map(named.map(({ use, words: said }) => [said.editedOn, { ...use.editedOn, label: said.editedOn }])).values()],
  }
}

/** What the move does to the pack's records that join one already in the other category, each a sentence with the noun of their kind. */
export function joinedInWords(move: CategoryMove): readonly { readonly noun: RecordNoun; readonly text: string }[] {
  return move.packs.flatMap((pack) => {
    const text = pack.removed.length === 0 ? null : installedPack().categoryNamingWords(pack.writes.kind.name).joined(pack.removed.length)
    return text === null ? [] : [{ noun: pack.writes.kind.noun, text }]
  })
}

/** What deleting the category into another changes besides the category: its ledger rows, split parts, rules and the pack's records that name it. */
export function categoryMoveOf(records: WorkbookRecords, category: string, into: string, categories: readonly ShareDefault[]): CategoryMove {
  return categoryMove(
    category,
    into,
    {
      ledger: recordsOf(records.ledger),
      splits: recordsOf(records.splits),
      items: recordsOf(records.items),
      rules: recordsOf(records.rules),
      packs: packNamedRecords((kind) => recordsOfKindIn(records, kind)),
    },
    categories,
  )
}

/**
 * Deletes the category and moves its ledger rows, split parts, rules and the pack's records that name it into another, all in one
 * write, so one Undo puts it all back. Gives the move it wrote.
 */
export function deleteCategoryInto(unit: UnitOfWork, records: WorkbookRecords, category: CategoryRecord, into: string, categories: readonly ShareDefault[]): CategoryMove {
  const move = categoryMoveOf(records, category.slug, into, categories)
  move.ledger.forEach(({ before, after }) => unit.of(LEDGER_WRITES).change(before, after))
  move.splits.forEach(({ before, after }) => unit.of(SPLIT_WRITES).change(before, after))
  move.items.forEach(({ before, after }) => unit.of(ITEM_WRITES).change(before, after))
  move.rules.forEach(({ before, after }) => unit.of(RULE_WRITES).change(before, after))
  for (const pack of move.packs) {
    pack.changed.forEach(({ before, after }) => unit.of(pack.writes).change(before, after))
    pack.removed.forEach((record) => unit.of(pack.writes).remove(record))
  }
  unit.of(CATEGORY_WRITES).remove(category)
  return move
}

/** What names each account outside its tab, which is the ledger's rows. */
export function accountUses(records: RecordsOfKind): SlugUses {
  return usesOf([countedBy(storedFieldsOf(records(LEDGER_RECORDS)), (fields) => [slugOf(fields.account)], counted(words.uses.ledgerRows))])
}

/** What names each client outside its tab: invoices, billing plan rows and the billing_client setting. */
function clientUses(records: RecordsOfKind): SlugUses {
  const billingClient = storedFieldsOf(records(SETTING_RECORDS)).find((fields) => slugOf(fields.key) === 'billing_client')
  return usesOf([
    countedBy(storedFieldsOf(records(INVOICE_RECORDS)), (fields) => [slugOf(fields.client)], counted(words.uses.invoices)),
    countedBy(storedFieldsOf(records(BILLING_RECORDS)), (fields) => [slugOf(fields.client)], counted(words.uses.billingPlanRows)),
    new Map(billingClient === undefined || slugOf(billingClient.value) === '' ? [] : [[slugOf(billingClient.value), words.uses.billingClient]]),
  ])
}

/** How many owner advances carry each category, none without the pack. */
function advancesByCategory(records: RecordsOfKind): ReadonlyMap<string, number> {
  const naming = installedPack().workbook?.ownerAdvanceNaming
  const advances = new Map<string, number>()
  if (naming === undefined) {
    return advances
  }
  for (const fields of storedFieldsOf(records(naming.writes.kind))) {
    for (const slug of naming.categoriesOf(fields)) {
      advances.set(slug, (advances.get(slug) ?? 0) + 1)
    }
  }
  return advances
}

function categoryFieldsOf(fields: StoredFields): {
  readonly slug: string
  readonly bucket: string
  readonly colour: string
  readonly roles: readonly string[]
  readonly vat: string
  readonly ownerShare: OwnerShare | null
} {
  return {
    slug: slugOf(fields.category),
    bucket: slugOf(fields.bucket),
    colour: textOf(fields.colour),
    roles: slugListOf(fields.roles),
    vat: slugOf(fields.vat),
    ownerShare: storedOwnerShare(fields.owner_share),
  }
}

/**
 * A category keeps to the slug format, once on its tab, keeps its name while anything the write leaves names it, and
 * keeps owner advances in an operating or taxes bucket. Unless Undo puts them back, a colour it is
 * given comes from the palette, a role it is given is one the app knows, an owner share it holds
 * keeps to the share guards, and roles, VAT or a bucket it is given keep to the pack's classes.
 */
export const CATEGORY_WRITES: WriteRules<CategoryRecord> = {
  kind: CATEGORY_RECORDS,
  get reads() {
    return [LEDGER_RECORDS, RULE_RECORDS, SPLIT_PART_RECORDS, ITEM_RECORDS, ...(installedPack().workbook?.categoryNaming.map((naming) => naming.writes.kind) ?? [])]
  },
  undoable: true,
  read: (read) => readCategories(read),
  refusals: (change, _fresh, after) => {
    const recordsOfKind: RecordsOfKind = (kind) => after.of(kind)
    const edits = pickedEdits(change, categoryFieldsOf)
    return [
      ...categoryChangeRefusals(
        edits,
        pickedUntouched(change, (fields) => ({ slug: slugOf(fields.category) })).filter((row) => row.slug !== ''),
        {
          named: categoryUses(recordsOfKind),
          advances: advancesByCategory(recordsOfKind),
        },
      ),
      ...(change.undoing
        ? []
        : [
            ...categoryColourRefusals(edits),
            ...categoryRoleRefusals(edits, knownRoles(installedPack().workbook?.categoryRoles ?? [])),
            ...categoryShareRefusals(
              edits,
              change.after.records.map((stored) => categoryFieldsOf(stored.fields)),
            ),
            ...categoryClassRefusals(edits, installedPack().workbook?.categoryClasses ?? []),
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
    accountChangeRefusals(
      pickedEdits(change, accountOfFields),
      pickedUntouched(change, accountOfFields).filter((row) => row.slug !== ''),
      {
        named: accountUses((kind) => fresh.of(kind)),
        clientIbans: new Map(readClients(fresh.of(CLIENT_RECORDS)).facts.flatMap((client) => client.ibans.map((iban) => [iban, client.slug] as const))),
      },
    ),
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
    clientChangeRefusals(
      pickedEdits(change, clientCellsOf),
      pickedUntouched(change, clientCellsOf).filter((client) => client.slug !== ''),
      {
        named: clientUses((kind) => fresh.of(kind)),
        accountIbans: new Map(readAccounts(fresh.of(ACCOUNT_RECORDS), null).facts.flatMap((account) => (account.iban === '' ? [] : [[account.iban, account.slug] as const]))),
      },
    ),
}
