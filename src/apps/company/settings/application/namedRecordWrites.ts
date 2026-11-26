import { normaliseIban } from '../../../../shared/text/fold'
import { ACCOUNT_RECORDS, BILLING_RECORDS, CATEGORY_RECORDS, CLIENT_RECORDS, INVOICE_RECORDS, LEDGER_RECORDS, SETTING_RECORDS } from '../../workbook/domain/coreKinds'
import { counted, countedBy, usesOf } from '../../workbook/domain/slug'
import type { SlugUses } from '../../workbook/domain/slug'
import { readAccounts } from '../../workbook/domain/accountsReading'
import { ibanListOf } from '../../../../shared/text/iban'
import { readClients } from '../../workbook/domain/clientsReading'
import { slugOf, textOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'
import { accountChangeRefusals } from '../domain/accountGuards'
import { clientChangeRefusals } from '../domain/clientGuards'
import type { ClientCells, ClientChecks } from '../domain/clientGuards'
import type { RecordKind } from '../../../../shared/storage/domain/recordKind'
import { storedFieldsOf } from '../../../../shared/storage/domain/recordsRead'
import type { RecordsRead } from '../../../../shared/storage/domain/recordsRead'
import type { AccountRecord } from '../../workbook/domain/accountsReading'
import type { ClientRecord } from '../../workbook/domain/clientsReading'
import { pickedEdits, pickedUntouched } from '../../../../shared/storage/domain/writeRules'
import type { FreshRecords, KindChange, WriteRules } from '../../../../shared/storage/domain/writeRules'
import { periodsChangeRefusal } from '../../../../shared/app/accountSource'
import type { PeriodsChangeRefusal } from '../../../../shared/app/accountSource'
import { today } from '../../../../shared/calendar/civilDate'
import { accountsWithSources, folderFiledOnSync, ledgerRowOrigin } from '../../workbook/domain/accountSources'
import { sourceHandover } from '../domain/sourceHandover'
import type { SourceHandover } from '../domain/sourceHandover'
import { writeDrafts } from '../../workbook/application/draftWrites'
import { replaceLedgerRows } from '../../transactions/application/itemWrites'
import { recordWithId } from '../../../../shared/storage/domain/recordsRead'
import type { StoredRecord } from '../../../../shared/storage/domain/recordsRead'
import type { Account, Transaction } from '../../workbook/domain/workbook'
import { definedCategories } from '../../workbook/domain/categoriesReading'
import { readLedger } from '../../workbook/domain/ledgerReading'
import { installedPack } from '../../packs/packContribution'
import type { WorkbookRecords } from '../../workbook/domain/readWorkbook'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'
import { words } from './words'

/** The records of a kind, from a fresh read or from the records on screen. */
export type RecordsOfKind = (kind: RecordKind<unknown>) => RecordsRead<unknown>

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

function accountOfFields(fields: StoredFields): { readonly slug: string; readonly iban: string } {
  return { slug: slugOf(fields.account), iban: normaliseIban(textOf(fields.iban)) }
}

/** The sentence of a refused change of periods, for the accounts editor, the chat and the write alike. */
export function periodsRefusalText(refusal: PeriodsChangeRefusal, undoing: boolean): string {
  if (refusal.kind === 'filed') return words.sources.filed(refusal.firstOpen)
  return undoing ? words.sources.undoAfterHandover : words.sources.rowsOfAnotherSource(refusal.count)
}

/** The accounts as the records read them, each with the periods it says or derives. */
function accountsOfRecords(fresh: FreshRecords, ledger: readonly Transaction[]): ReadonlyMap<string, Account> {
  return new Map(accountsWithSources(readAccounts(fresh.of(ACCOUNT_RECORDS), null).facts, ledger, folderFiledOnSync(fresh.of(SETTING_RECORDS))).map((account) => [account.slug, account]))
}

/**
 * Why the write would give days of an account to another source over a filed day, which the pack says, or leave a row on a day
 * whose new source would not take it. A write that gives days away carries those rows out with it, so only a change written
 * some other way is refused. Each row's origin is read by the periods it came in under: one already in by the old periods, one
 * the write puts back by the new. So an Undo after the new source brought a row on the handed days is refused.
 */
function periodsRefusals(change: KindChange<AccountRecord>, fresh: FreshRecords, after: FreshRecords): string[] {
  const categories = definedCategories(fresh.of(CATEGORY_RECORDS))
  const ledgerBefore = readLedger(fresh.of(LEDGER_RECORDS), categories).facts
  const ledgerAfter = readLedger(after.of(LEDGER_RECORDS), categories).facts
  const before = accountsOfRecords(fresh, ledgerBefore)
  const there = new Set(ledgerBefore.map((row) => row.id))
  const firstOpen = change.undoing ? null : installedPack().firstOpenDay(today())
  return change.edits.flatMap((edit) => {
    const account = edit.after !== null && 'record' in edit.after ? edit.after.record : undefined
    const was = account === undefined ? undefined : before.get(account.slug)
    if (account === undefined || account.sources === null || was === undefined) return []
    const sources = account.sources
    const rows = ledgerAfter.filter((row) => row.account === account.slug).map((row) => ({ date: row.date, origin: ledgerRowOrigin(row, there.has(row.id) ? was.sources : sources) }))
    const refusal = periodsChangeRefusal(was.sources, sources, rows, firstOpen)
    return refusal === null ? [] : [`${account.slug}: ${periodsRefusalText(refusal, change.undoing)}`]
  })
}

/** What each account's new periods carry out of the ledger, by the account's name: none for an account whose days keep their source. */
export function accountHandovers(
  books: { readonly workbook: { readonly accounts: readonly Account[]; readonly transactions: readonly Transaction[] } },
  made: readonly { readonly record: AccountRecord }[],
): readonly SourceHandover[] {
  return made.flatMap(({ record }) => {
    const was = books.workbook.accounts.find((account) => account.slug === record.slug)
    const handover = was === undefined || record.sources === null ? null : sourceHandover(was, record.sources, books.workbook.transactions)
    return handover === null || handover.rows.length === 0 ? [] : [handover]
  })
}

/**
 * Writes the accounts as an editor made them, and in the same write carries out the ledger rows each new list of periods gives to
 * another source, with their items, so one Undo puts all of it back.
 */
export function writeAccounts(
  unit: UnitOfWork,
  books: { readonly records: WorkbookRecords; readonly workbook: { readonly accounts: readonly Account[]; readonly transactions: readonly Transaction[] } },
  stored: readonly StoredRecord<AccountRecord>[],
  made: readonly { readonly saved: number | null; readonly record: AccountRecord }[],
): void {
  writeDrafts(unit.of(ACCOUNT_WRITES), stored, made)
  const going = accountHandovers(books, made).flatMap((handover) => handover.rows.flatMap((row) => recordWithId(books.records.ledger, row.id)?.record ?? []))
  if (going.length > 0) replaceLedgerRows(unit, books.records, going, [])
}

/**
 * An account keeps to the slug format, keeps its name and IBAN while ledger rows name it, and its IBAN is valid, its own and no
 * client's. Periods that give days to another source reach no filed day and leave no row there the new source would not take.
 */
export const ACCOUNT_WRITES: WriteRules<AccountRecord> = {
  kind: ACCOUNT_RECORDS,
  reads: [LEDGER_RECORDS, CLIENT_RECORDS, CATEGORY_RECORDS, SETTING_RECORDS],
  undoable: true,
  read: (read) => readAccounts(read, null),
  refusals: (change, fresh, after) => [
    ...accountChangeRefusals(
      pickedEdits(change, accountOfFields),
      pickedUntouched(change, accountOfFields).filter((row) => row.slug !== ''),
      {
        named: accountUses((kind) => fresh.of(kind)),
        clientIbans: new Map(readClients(fresh.of(CLIENT_RECORDS)).facts.flatMap((client) => client.ibans.map((iban) => [iban, client.slug] as const))),
      },
    ),
    ...periodsRefusals(change, fresh, after),
  ],
}

/** The cells of a client its checks read. */
export function clientCellsOf(fields: StoredFields): ClientCells {
  return { slug: slugOf(fields.client), ibans: ibanListOf(textOf(fields.iban)), lines: textOf(fields.invoice_lines) }
}

/** What a change to the clients is checked against: what names each client, and the IBANs of your own accounts. */
export function clientChecksOf(records: FreshRecords): ClientChecks {
  return {
    named: clientUses((kind) => records.of(kind)),
    accountIbans: new Map(readAccounts(records.of(ACCOUNT_RECORDS), null).facts.flatMap((account) => (account.iban === '' ? [] : [[account.iban, account.slug] as const]))),
  }
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
      clientChecksOf(fresh),
    ).map((refusal) => refusal.reason),
}
