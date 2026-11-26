import { normaliseIban } from '../../../../shared/text/fold'
import { ACCOUNT_RECORDS, CATEGORY_RECORDS, CLIENT_RECORDS, LEDGER_RECORDS, SETTING_RECORDS } from '../../workbook/domain/coreKinds'
import { counted, countedBy, usesOf } from '../../workbook/domain/slug'
import type { SlugUses } from '../../workbook/domain/slug'
import { readAccounts } from '../../workbook/domain/accountsReading'
import { readClients } from '../../workbook/domain/clientsReading'
import { slugOf, textOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'
import { accountChangeRefusals } from '../domain/accountGuards'
import { storedFieldsOf } from '../../../../shared/storage/domain/recordsRead'
import type { AccountRecord } from '../../workbook/domain/accountsReading'
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
import type { RecordsOfKind, WorkbookRecords } from '../../workbook/domain/readWorkbook'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'
import { words } from './words'

/** What names each account outside its tab, which is the ledger's rows. */
export function accountUses(records: RecordsOfKind): SlugUses {
  return usesOf([countedBy(storedFieldsOf(records(LEDGER_RECORDS)), (fields) => [slugOf(fields.account)], counted(words.uses.ledgerRows))])
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
