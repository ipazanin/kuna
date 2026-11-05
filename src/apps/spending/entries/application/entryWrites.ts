import { SPENDING_KINDS, bookWith, dependentRefusals } from '../../workbook/application/spendingWriteGuards'
import type { SpendingRecords } from '../../workbook/domain/readSpendingBook'
import { TRANSACTION_RECORDS } from '../../workbook/domain/spendingKinds'
import type { Transaction } from '../../workbook/domain/transaction'
import { moneyFromCents, negateMoney } from '../../../../shared/money/money'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'
import { newRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import { recordsOf } from '../../../../shared/storage/domain/recordsRead'
import type { WriteRules } from '../../../../shared/storage/domain/writeRules'

/** An entry may be a transfer's leg, which its other leg names back, so a write keeps both or neither. */
export const TRANSACTION_WRITES: WriteRules<Transaction> = {
  kind: TRANSACTION_RECORDS,
  reads: SPENDING_KINDS,
  undoable: true,
  read: (read, records) => bookWith(TRANSACTION_RECORDS, read, records).readings.transactions,
  refusals: (_change, fresh, after) => dependentRefusals(['transactions'], fresh, after),
}

/** A new typed entry, its text trimmed, with an id of its own. */
export function newEntry(entry: Omit<Transaction, 'id' | 'source' | 'pair'>): Transaction {
  return { ...entry, payee: entry.payee.trim(), note: entry.note.trim(), source: 'typed', pair: null, id: recordIdOf(TRANSACTION_RECORDS, newRecordId()) }
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
  const shared = { date: entry.date, payee: entry.payee.trim(), note: entry.note.trim(), category: entry.category, source: 'typed' as const }
  return [
    { ...shared, id: outId, account: from.account, amount: negateMoney(moneyFromCents(Math.abs(from.amount))), pair: inId },
    { ...shared, id: inId, account: to.account, amount: moneyFromCents(Math.abs(to.amount)), pair: outId },
  ]
}

/** The entry's other leg in the file, or null for an entry that is no transfer's leg. */
export function otherLegOf(records: SpendingRecords, entry: Transaction): Transaction | null {
  return entry.pair === null ? null : (recordsOf(records.transactions).find((other) => other.id === entry.pair) ?? null)
}

/** Deletes the entry and its other leg in one write, so one Undo puts both back. */
export function removeEntry(unit: UnitOfWork, records: SpendingRecords, entry: Transaction): void {
  const other = otherLegOf(records, entry)
  unit.of(TRANSACTION_WRITES).remove(entry)
  if (other !== null) unit.of(TRANSACTION_WRITES).remove(other)
}
