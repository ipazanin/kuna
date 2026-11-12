import { refusedOnAccount } from '../domain/bankRows'
import type { EntrySplit } from '../domain/entrySplit'
import { RECEIPT_WRITES } from '../../receipts/application/receiptRecords'
import { SPENDING_KINDS, bookWith, dependentRefusals } from '../../workbook/application/spendingWriteGuards'
import type { SpendingRecords } from '../../workbook/domain/readSpendingBook'
import type { EntryPart } from '../../workbook/domain/entryPart'
import { ACCOUNT_RECORDS, PART_RECORDS, TRANSACTION_RECORDS } from '../../workbook/domain/spendingKinds'
import { NO_BANK_FACTS } from '../../workbook/domain/transaction'
import type { RowLink } from '../../workbook/domain/rowLink'
import type { Transaction } from '../../workbook/domain/transaction'
import { words } from '../../workbook/domain/words'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'
import { newRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import { recordsOf } from '../../../../shared/storage/domain/recordsRead'
import { textOf } from '../../../../shared/storage/domain/storedFields'
import { pickedEdits } from '../../../../shared/storage/domain/writeRules'
import type { FreshRecords, KindChange, WriteRules } from '../../../../shared/storage/domain/writeRules'

/**
 * An entry may be a transfer's leg, which its other leg names back, so a write keeps both or neither. A row a statement brought
 * stays on its account, and a row a person made goes on no account the bank fills. A row split into parts keeps the amount its
 * parts add up to, and one a bank row on hold looks like stays.
 */
export const TRANSACTION_WRITES: WriteRules<Transaction> = {
  kind: TRANSACTION_RECORDS,
  reads: SPENDING_KINDS,
  undoable: true,
  read: (read, records) => bookWith(TRANSACTION_RECORDS, read, records).readings.transactions,
  refusals: (change, fresh, after) => [
    ...pickedEdits(change, (fields) => ({ account: textOf(fields.account), importKey: textOf(fields.import_key) })).flatMap(({ before, after: changed }) =>
      before !== null && changed !== null && before.importKey !== '' && before.account !== changed.account ? [words.accountOfStatementRow] : [],
    ),
    ...byHandOnBankAccounts(change, after),
    ...dependentRefusals(['transactions', 'receipts', 'lines', 'held'], fresh, after),
  ],
}

/** Each row the write puts on an account the bank fills, newly or by moving it there, that a person made. */
function byHandOnBankAccounts(change: KindChange<Transaction>, after: FreshRecords): readonly string[] {
  const accounts = new Map(recordsOf(after.of(ACCOUNT_RECORDS)).map((account) => [account.id, account]))
  return change.edits.flatMap((edit) => {
    if (edit.after === null || !('record' in edit.after)) return []
    const row = edit.after.record
    const before = edit.before !== null && 'record' in edit.before ? edit.before.record : null
    const account = accounts.get(row.account)
    if (account === undefined || before?.account === row.account || !refusedOnAccount(row, account)) return []
    return [words.byHandOnBankAccount(account.name)]
  })
}

/** The parts of an entry add up to its amount, so a write changes them together or not at all. */
export const PART_WRITES: WriteRules<EntryPart> = {
  kind: PART_RECORDS,
  reads: SPENDING_KINDS,
  undoable: true,
  read: (read, records) => bookWith(PART_RECORDS, read, records).readings.lines,
  refusals: (_change, fresh, after) => dependentRefusals(['lines'], fresh, after),
}

/** A new typed entry, its text trimmed, with an id of its own. */
export function newEntry(entry: Pick<Transaction, 'account' | 'date' | 'amount' | 'payee' | 'category' | 'note'>): Transaction {
  return {
    ...entry,
    ...NO_BANK_FACTS,
    payee: entry.payee.trim(),
    note: entry.note.trim(),
    source: 'typed',
    pair: null,
    link: null,
    categorisedBy: 'person',
    id: recordIdOf(TRANSACTION_RECORDS, newRecordId()),
  }
}

/**
 * What you typed over a row on the file. It keeps its id, its source, its link and what the bank said, so a later statement still
 * skips it, and a category you changed is yours from then on.
 */
export function retypedEntry(before: Transaction, typed: Transaction): Transaction {
  const { description, counterpartyIban, importKey, statement, movedAt, pocket, id, source, link } = before
  return { ...typed, description, counterpartyIban, importKey, statement, movedAt, pocket, id, source, link, categorisedBy: typed.category === before.category ? before.categorisedBy : 'person' }
}

/**
 * A plain row turned into a transfer: it stays the leg its money already is, so money in stays money in, and the other
 * leg joins it.
 */
export function transferOver(before: Transaction, [outLeg, inLeg]: readonly [Transaction, Transaction]): { readonly kept: Transaction; readonly added: Transaction } {
  const [stays, joins] = before.amount < 0 ? [outLeg, inLeg] : [inLeg, outLeg]
  return { kept: { ...retypedEntry(before, stays), pair: joins.id }, added: { ...joins, pair: before.id } }
}

/** The entry typed over a row on the file, or added when there is none. A transfer's other leg goes, since the row is a plain entry now. */
export function writeEntry(unit: UnitOfWork, before: Transaction | null, entry: Transaction, otherLeg: Transaction | null): void {
  const entries = unit.of(TRANSACTION_WRITES)
  if (before === null) {
    entries.add(entry)
    return
  }
  entries.change(before, retypedEntry(before, entry))
  if (otherLeg !== null) entries.remove(otherLeg)
}

/** Both legs of a transfer in one write: added, a plain row turned into the leg its money already is, or written over the transfer it was. */
export function writeTransfer(unit: UnitOfWork, before: Transaction | null, legs: readonly [Transaction, Transaction] | null, typed: readonly [Transaction, Transaction]): void {
  const entries = unit.of(TRANSACTION_WRITES)
  const [outLeg, inLeg] = typed
  if (before === null) {
    entries.add(outLeg)
    entries.add(inLeg)
  } else if (legs === null) {
    const { kept, added } = transferOver(before, typed)
    entries.change(before, kept)
    entries.add(added)
  } else {
    const [oldOut, oldIn] = legs
    entries.change(oldOut, { ...retypedEntry(oldOut, outLeg), pair: oldIn.id })
    entries.change(oldIn, { ...retypedEntry(oldIn, inLeg), pair: oldOut.id })
  }
}

/** The entry linked to the record in another app it is, or its link taken off for null. It keeps its category. */
export function linkEntry(unit: UnitOfWork, row: Transaction, link: RowLink | null): void {
  unit.of(TRANSACTION_WRITES).change(row, { ...row, link })
}

/** Whether deleting these rows lets the next overlapping statement bring one back, since nothing remembers a deleted row's key. */
export function deleteComesBack(rows: readonly Transaction[]): boolean {
  return rows.some((row) => row.importKey !== '')
}

/** The entry's other leg in the file, or null for an entry that is no transfer's leg. */
export function otherLegOf(records: SpendingRecords, entry: Transaction): Transaction | null {
  return entry.pair === null ? null : (recordsOf(records.transactions).find((other) => other.id === entry.pair) ?? null)
}

/** Deletes the entry with its other leg and its receipt in one write, so one Undo puts them all back. */
export function removeEntry(unit: UnitOfWork, records: SpendingRecords, entry: Transaction): void {
  const other = otherLegOf(records, entry)
  for (const row of other === null ? [entry] : [entry, other]) {
    unit.of(TRANSACTION_WRITES).remove(row)
    removeSplitOf(unit, records, row)
  }
}

/** The entry under its main category with the parts you split it into, in place of any it had, in one write. */
export function writeEntrySplit(unit: UnitOfWork, records: Pick<SpendingRecords, 'lines'>, { before, row, parts }: EntrySplit): void {
  unit.of(TRANSACTION_WRITES).change(before, row)
  partsOf(records, before).forEach((part) => unit.of(PART_WRITES).remove(part))
  parts.forEach((part) => unit.of(PART_WRITES).add(part))
}

/** Takes the row's parts out, with the receipt that split it when one did, which leaves the row under its main category. A photo kept on Drive stays there. */
export function removeSplitOf(unit: UnitOfWork, records: Pick<SpendingRecords, 'receipts' | 'lines'>, row: Pick<Transaction, 'id'>): void {
  partsOf(records, row).forEach((part) => unit.of(PART_WRITES).remove(part))
  recordsOf(records.receipts)
    .filter((receipt) => receipt.transaction === row.id)
    .forEach((receipt) => unit.of(RECEIPT_WRITES).remove(receipt))
}

function partsOf(records: Pick<SpendingRecords, 'lines'>, row: Pick<Transaction, 'id'>): readonly EntryPart[] {
  return recordsOf(records.lines).filter((part) => part.transaction === row.id)
}
