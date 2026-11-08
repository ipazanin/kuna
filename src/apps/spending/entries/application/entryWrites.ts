import { removeReceiptOf } from '../../receipts/application/receiptRecords'
import { SPENDING_KINDS, bookWith, dependentRefusals } from '../../workbook/application/spendingWriteGuards'
import type { SpendingRecords } from '../../workbook/domain/readSpendingBook'
import { TRANSACTION_RECORDS } from '../../workbook/domain/spendingKinds'
import { NO_BANK_FACTS } from '../../workbook/domain/transaction'
import type { Transaction } from '../../workbook/domain/transaction'
import { words } from '../../workbook/domain/words'
import { absAccountMoney, negateAccountMoney } from '../../../../shared/money/accountMoney'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'
import { newRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import { recordsOf } from '../../../../shared/storage/domain/recordsRead'
import { textOf } from '../../../../shared/storage/domain/storedFields'
import { pickedEdits } from '../../../../shared/storage/domain/writeRules'
import type { WriteRules } from '../../../../shared/storage/domain/writeRules'

/** An entry may be a transfer's leg, which its other leg names back, so a write keeps both or neither. A row a statement brought stays on its account. A row a receipt split keeps the amount its lines add up to. */
export const TRANSACTION_WRITES: WriteRules<Transaction> = {
  kind: TRANSACTION_RECORDS,
  reads: SPENDING_KINDS,
  undoable: true,
  read: (read, records) => bookWith(TRANSACTION_RECORDS, read, records).readings.transactions,
  refusals: (change, fresh, after) => [
    ...pickedEdits(change, (fields) => ({ account: textOf(fields.account), importKey: textOf(fields.import_key) })).flatMap(({ before, after: changed }) =>
      before !== null && changed !== null && before.importKey !== '' && before.account !== changed.account ? [words.accountOfStatementRow] : [],
    ),
    ...dependentRefusals(['transactions', 'receipts', 'lines'], fresh, after),
  ],
}

/** A new typed entry, its text trimmed, with an id of its own. */
export function newEntry(entry: Pick<Transaction, 'account' | 'date' | 'amount' | 'payee' | 'category' | 'note'>): Transaction {
  return { ...entry, ...NO_BANK_FACTS, payee: entry.payee.trim(), note: entry.note.trim(), source: 'typed', pair: null, categorisedBy: 'person', id: recordIdOf(TRANSACTION_RECORDS, newRecordId()) }
}

/**
 * What you typed over a row on the file. It keeps its id, its source and what the bank said, so a later statement still
 * skips it, and a category you changed is yours from then on.
 */
export function retypedEntry(before: Transaction, typed: Transaction): Transaction {
  const { description, counterpartyIban, importKey, statement, movedAt, pocket, id, source } = before
  return { ...typed, description, counterpartyIban, importKey, statement, movedAt, pocket, id, source, categorisedBy: typed.category === before.category ? before.categorisedBy : 'person' }
}

/** One leg of a transfer between two of your accounts. */
export interface TransferLeg {
  readonly account: Transaction['account']
  /** Above zero: what left the one account, or reached the other, in its currency. */
  readonly amount: Transaction['amount']
}

/** The two legs of a transfer, money out of one account and into the other, each naming the other as its pair. */
export function newTransfer(from: TransferLeg, to: TransferLeg, entry: Pick<Transaction, 'date' | 'payee' | 'note' | 'category'>): readonly [Transaction, Transaction] {
  const outId = recordIdOf(TRANSACTION_RECORDS, newRecordId())
  const inId = recordIdOf(TRANSACTION_RECORDS, newRecordId())
  const shared = { ...NO_BANK_FACTS, date: entry.date, payee: entry.payee.trim(), note: entry.note.trim(), category: entry.category, source: 'typed' as const, categorisedBy: 'person' as const }
  return [
    { ...shared, id: outId, account: from.account, amount: negateAccountMoney(absAccountMoney(from.amount)), pair: inId },
    { ...shared, id: inId, account: to.account, amount: absAccountMoney(to.amount), pair: outId },
  ]
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
    removeReceiptOf(unit, records, row)
  }
}
