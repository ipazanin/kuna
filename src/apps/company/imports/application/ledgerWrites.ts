import { addMoney, subtractMoney } from '../../../../shared/money/money'
import { definedCategories, definedCategorySlugs } from '../../workbook/domain/categoriesReading'
import { ACCOUNT_RECORDS, CATEGORY_RECORDS, LEDGER_RECORDS, SETTING_RECORDS } from '../../workbook/domain/coreKinds'
import { accountsWithIntakes, folderFiledOnSync } from '../../workbook/domain/accountIntakes'
import { readAccounts } from '../../workbook/domain/accountsReading'
import { isBankStatementRow } from '../../workbook/domain/rowOrigin'
import { alsoFromOf, takesRowFrom } from '../../../../shared/app/accountSource'
import { changesOnly } from '../../workbook/domain/fieldEdits'
import { readLedger } from '../../workbook/domain/ledgerReading'
import type { LedgerEntry } from '../../workbook/domain/ledgerReading'
import { ID_FIELD } from '../../../../shared/storage/domain/recordCodec'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { slugOf, textOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'
import type { CompanyIntake, Transaction } from '../../workbook/domain/workbook'
import type { FreshRecords, KindChange, WriteRules } from '../../../../shared/storage/domain/writeRules'
import { words } from './words'

/** How each account's rows come in, by its name, as the reader reads the accounts tab over the ledger before the write. */
function intakesOfRecords(fresh: FreshRecords, ledger: readonly Transaction[]): ReadonlyMap<string, CompanyIntake> {
  const accounts = accountsWithIntakes(readAccounts(fresh.of(ACCOUNT_RECORDS), null).facts, ledger, folderFiledOnSync(fresh.of(SETTING_RECORDS)))
  return new Map(accounts.map((account) => [account.slug, account.intake]))
}

/** Each account's newest row in booking order, as the readers take a closing balance. */
function newestByAccount(transactions: readonly Transaction[]): Map<string, Transaction> {
  const newest = new Map<string, Transaction>()
  for (const transaction of transactions) {
    const held = newest.get(transaction.account)
    if (held === undefined || transaction.date > held.date || (transaction.date === held.date && transaction.sequence > held.sequence)) {
      newest.set(transaction.account, transaction)
    }
  }
  return newest
}

/** Added rows of one account, oldest first: statements in the order given, each held newest first. */
function inBookingOrder(added: readonly StoredFields[]): StoredFields[] {
  const blocks: StoredFields[][] = []
  for (const fields of added) {
    const block = blocks[blocks.length - 1]
    if (block !== undefined && textOf(block[0]!.statement) === textOf(fields.statement)) {
      block.push(fields)
    } else {
      blocks.push([fields])
    }
  }
  return blocks.flatMap((block) => [...block].reverse())
}

function addedRefusals(added: readonly StoredFields[], before: readonly Transaction[]): string[] {
  if (added.length === 0) return []
  const refusals: string[] = []
  const newest = newestByAccount(before)
  for (const account of new Set(added.map((fields) => slugOf(fields.account)))) {
    const rows = inBookingOrder(added.filter((fields) => slugOf(fields.account) === account))
    const latest = newest.get(account)
    let balance = latest?.balance ?? null
    for (const fields of rows) {
      const date = fields.date?.date ?? null
      const amount = fields.amount?.money ?? null
      const after = fields.balance?.money ?? null
      if (date === null || amount === null || after === null) continue
      if (latest !== undefined && date < latest.date) {
        refusals.push(words.ledger.beforeNewest(account, date, latest.date))
        break
      }
      if (balance !== null && addMoney(balance, amount) !== after) {
        refusals.push(words.ledger.opensElsewhere(account, subtractMoney(after, amount), balance))
        break
      }
      balance = after
    }
  }
  return refusals
}

function removedRefusals(removedRows: ReadonlySet<RecordId | null>, before: readonly Transaction[]): string[] {
  const removed = before.filter((row) => removedRows.has(row.id))
  const refusals: string[] = []
  for (const account of new Set(removed.map((row) => row.account))) {
    const oldest = Math.min(...removed.filter((row) => row.account === account).map((row) => row.sequence))
    const newer = before.find((row) => row.account === account && row.sequence > oldest && !removedRows.has(row.id))
    if (newer !== undefined) {
      refusals.push(words.ledger.bookedAfter(account, newer.date, newer.balance))
    }
  }
  return refusals
}

/**
 * Each account an added row by hand would go on, a sheet's or a copied one, that the bank's statements fill. Such an account
 * takes no row by hand on any day, as `takesRowFrom` says. A camt row's origin the dry run checked, since only it knows whether
 * the statement came from the folder or from the person.
 */
function byHandRefusals(added: readonly StoredFields[], intakes: ReadonlyMap<string, CompanyIntake>): string[] {
  const refused = new Set(
    added.flatMap((fields) => {
      const account = slugOf(fields.account)
      const intake = intakes.get(account)
      const byHand = !isBankStatementRow({ statement: textOf(fields.statement), reference: textOf(fields.reference) })
      return intake !== undefined && byHand && !takesRowFrom(intake.rowsFrom, alsoFromOf(intake), 'by-hand') ? [account] : []
    }),
  )
  return [...refused].map((account) => words.ledger.statementsFill(account))
}

/**
 * A verdict names a category the categories tab defines, unless it puts back what an earlier write replaced. Giving a row its id
 * files nothing, and neither does a row left without a category, as books with an items tab keep every row, since its items hold it.
 */
function verdictRefusals(change: KindChange<LedgerEntry>, definedCategories: ReadonlySet<string>): string[] {
  if (change.undoing) return []
  return change.edits.flatMap((edit) => {
    if (edit.before === null || edit.after === null || changesOnly(edit.before.fields, edit.after.fields, ID_FIELD)) return []
    const category = textOf(edit.after.fields.category)
    return category === '' || definedCategories.has(category.toLowerCase()) ? [] : [words.ledger.notACategory(category)]
  })
}

/** A row keeps the id it was given, unless the write puts back what an earlier write replaced. */
function rowIdRefusals(change: KindChange<LedgerEntry>): string[] {
  if (change.undoing) return []
  return change.edits.flatMap((edit) => {
    if (edit.before === null || edit.after === null) return []
    const given = textOf(edit.before.fields[ID_FIELD])
    return given === '' || given === textOf(edit.after.fields[ID_FIELD]) ? [] : [words.ledger.keepsRowId(edit.before.label)]
  })
}

/**
 * Ledger records: statement rows added newest first, where a person reading an export looks, and
 * taken out again by Undo or by an import whose entries take their place, and the verdict of a record
 * already there with the owner share filed with it, which is all of it the app changes. Against the
 * ledger as it is right before the write, less the records it takes out, each account's new records
 * must open at its newest balance and run on from it, and none may predate the account's newest record. A
 * record already there by its account and reference is refused as every kind refuses a record it holds. A record taken out must have no
 * record of its account booked after it left in. A verdict names a defined category. A row without an id may be given one, and keeps it.
 * A row by hand goes on no account the bank's statements fill. Undo puts back what was there.
 */
export const LEDGER_WRITES: WriteRules<LedgerEntry> = {
  kind: LEDGER_RECORDS,
  reads: [CATEGORY_RECORDS, ACCOUNT_RECORDS, SETTING_RECORDS],
  changeable: ['category', 'flaggedBy', 'ownerShare', 'rowId'] satisfies (keyof LedgerEntry)[],
  undoable: true,
  read: (read, records) => readLedger(read, definedCategories(records.of(CATEGORY_RECORDS))),
  refusals: (change, fresh) => {
    const before = readLedger(change.before, definedCategories(fresh.of(CATEGORY_RECORDS))).facts
    const added = change.edits.flatMap((edit) => (edit.before === null && edit.after !== null ? [edit.after.fields] : []))
    const removed = new Set(change.edits.flatMap((edit) => (edit.after === null && edit.before !== null ? [edit.before.id] : [])))
    const left = before.filter((row) => !removed.has(row.id))
    const intakes = change.undoing ? new Map<string, CompanyIntake>() : intakesOfRecords(fresh, before)
    return [
      ...addedRefusals(added, left),
      ...byHandRefusals(added, intakes),
      ...removedRefusals(removed, before),
      ...verdictRefusals(change, definedCategorySlugs(fresh.of(CATEGORY_RECORDS))),
      ...rowIdRefusals(change),
    ]
  },
}
