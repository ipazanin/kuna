import { words } from './words'
import { loneLeg } from '../domain/startDayMove'
import type { StartDayMove } from '../domain/startDayMove'
import { ITEM_WRITES, TRANSACTION_WRITES } from '../../entries/application/entryWrites'
import { RECEIPT_WRITES } from '../../receipts/application/receiptRecords'
import { HELD_ROW_WRITES } from '../../statements/application/statementWrites'
import { SPENDING_KINDS, bookWith, dependentRefusals } from '../../workbook/application/spendingWriteGuards'
import { bankLinkWithoutIban } from '../../workbook/domain/account'
import type { Account } from '../../workbook/domain/account'
import { ACCOUNT_RECORDS, TRANSACTION_RECORDS } from '../../workbook/domain/spendingKinds'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'
import { newRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import { recordsOf } from '../../../../shared/storage/domain/recordsRead'
import type { WriteRules } from '../../../../shared/storage/domain/writeRules'

/**
 * An account keeps the entries that name it, so one with entries is closed rather than deleted, and keeps the currency their
 * amounts are in. A cash account a rule names stays cash, and one the bank fills holds the IBAN the bank sync finds it by.
 */
export const ACCOUNT_WRITES: WriteRules<Account> = {
  kind: ACCOUNT_RECORDS,
  reads: SPENDING_KINDS,
  undoable: true,
  read: (read, records) => bookWith(ACCOUNT_RECORDS, read, records).readings.accounts,
  refusals: (change, fresh, after) => {
    const named = new Set(recordsOf(fresh.of(TRANSACTION_RECORDS)).map((entry) => entry.account))
    const currencyChanged = change.edits.flatMap((edit) =>
      edit.before !== null && edit.after !== null && 'record' in edit.before && 'record' in edit.after && edit.before.record.currency !== edit.after.record.currency && named.has(edit.before.record.id)
        ? [words.currencyKept(edit.before.label, edit.before.record.currency)]
        : [],
    )
    const withoutIban = change.edits.flatMap((edit) => (edit.after !== null && 'record' in edit.after && bankLinkWithoutIban(edit.after.record) ? [words.bankLinkWithoutIban(edit.after.label)] : []))
    return [...currencyChanged, ...withoutIban, ...dependentRefusals(['transactions', 'held', 'rules'], fresh, after)]
  },
}

/** An account as the file keeps it: its text trimmed, and cash by hand with no bank and no IBAN. */
export function keptAccount(account: Account): Account {
  const cash = account.kind === 'cash'
  return { ...account, name: account.name.trim(), bank: cash ? null : account.bank, iban: cash ? '' : account.iban.trim(), rowsFrom: cash ? 'by-hand' : account.rowsFrom }
}

/** A new account as the file keeps it, with an id of its own. */
export function newAccount(account: Omit<Account, 'id'>): Account {
  return keptAccount({ ...account, id: recordIdOf(ACCOUNT_RECORDS, newRecordId()) })
}

/**
 * The account as typed over the one on the file, in one write with one Undo. When its start day moved later, what came before
 * the new day goes in the same write, and each transfer's other leg stays with no pair.
 */
export function changeAccount(unit: UnitOfWork, before: Account, after: Account, move: StartDayMove | null): void {
  unit.of(ACCOUNT_WRITES).change(before, after)
  if (move === null) return
  move.parts.forEach((part) => unit.of(ITEM_WRITES).remove(part))
  move.receipts.forEach((receipt) => unit.of(RECEIPT_WRITES).remove(receipt))
  move.held.forEach((held) => unit.of(HELD_ROW_WRITES).remove(held))
  move.rows.forEach((row) => unit.of(TRANSACTION_WRITES).remove(row))
  move.loneLegs.forEach((leg) => unit.of(TRANSACTION_WRITES).change(leg, loneLeg(leg)))
}
