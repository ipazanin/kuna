import { addMoney, plainAmount, subtractMoney } from '../../../shared/money/money'
import { definedCategories, definedCategorySlugs } from '../../workbook/domain/categoriesReading'
import { readLedger } from '../../workbook/domain/ledgerReading'
import type { LedgerEntry } from '../../workbook/domain/ledgerReading'
import type { RecordId } from '../../workbook/domain/recordId'
import { CATEGORY_RECORDS, LEDGER_RECORDS } from '../../workbook/domain/recordKind'
import { slugOf, textOf } from '../../workbook/domain/storedFields'
import type { StoredFields } from '../../workbook/domain/storedFields'
import type { Transaction } from '../../workbook/domain/workbook'
import type { KindChange, WriteRules } from '../../workbook/domain/writeRules'

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
        refusals.push(`A new ${account} row is dated ${date}, before ${latest.date}, the newest row of ${account} on the tab now.`)
        break
      }
      if (balance !== null && addMoney(balance, amount) !== after) {
        refusals.push(`The new ${account} rows open at ${plainAmount(subtractMoney(after, amount))}, but the tab now leaves ${account} at ${plainAmount(balance)}. Look at the dry run again.`)
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
      refusals.push(`The ${account} row of ${newer.date} with the balance ${plainAmount(newer.balance)} is booked after the rows to take out, so its balance follows from them. Take it out first, or leave the rows.`)
    }
  }
  return refusals
}

/** A verdict names a category the categories tab defines, unless it puts back what an earlier write replaced. */
function verdictRefusals(change: KindChange<LedgerEntry>, definedCategories: ReadonlySet<string>): string[] {
  if (change.undoing) return []
  return change.edits.flatMap((edit) => {
    if (edit.before === null || edit.after === null) return []
    const category = textOf(edit.after.fields.category)
    return definedCategories.has(category.toLowerCase()) ? [] : [`"${category}" is not a category on the categories tab.`]
  })
}

/**
 * Ledger records: statement rows added newest first, where a person reading an export looks, and
 * taken out again by Undo, and the verdict of a record already there with the owner share filed with
 * it, which is all of it the app changes. Against the ledger as it is right before the write, each
 * account's new records must open at its newest balance and run on from it, and none may predate the account's newest record. A
 * record already there by its account and reference is refused as every kind refuses a record it holds. A record taken out must have no
 * record of its account booked after it left in. A verdict names a defined category.
 */
export const LEDGER_WRITES: WriteRules<LedgerEntry> = {
  kind: LEDGER_RECORDS,
  reads: [CATEGORY_RECORDS],
  changeable: ['category', 'flaggedBy', 'ownerShare'] satisfies (keyof LedgerEntry)[],
  undoable: true,
  read: (read, records) => readLedger(read, definedCategories(records.of(CATEGORY_RECORDS))),
  refusals: (change, fresh) => {
    const before = readLedger(change.before, definedCategories(fresh.of(CATEGORY_RECORDS))).facts
    const added = change.edits.flatMap((edit) => (edit.before === null && edit.after !== null ? [edit.after.fields] : []))
    const removed = new Set(change.edits.flatMap((edit) => (edit.after === null && edit.before !== null ? [edit.before.id] : [])))
    return [...addedRefusals(added, before), ...removedRefusals(removed, before), ...verdictRefusals(change, definedCategorySlugs(fresh.of(CATEGORY_RECORDS)))]
  },
}
