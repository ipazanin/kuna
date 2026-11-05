import { words } from './words'
import { SPENDING_KINDS, bookWith, dependentRefusals } from '../../workbook/application/spendingWriteGuards'
import type { Account } from '../../workbook/domain/account'
import { ACCOUNT_RECORDS, TRANSACTION_RECORDS } from '../../workbook/domain/spendingKinds'
import { newRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import { recordsOf } from '../../../../shared/storage/domain/recordsRead'
import type { WriteRules } from '../../../../shared/storage/domain/writeRules'

/** An account keeps the entries that name it, so one with entries is closed rather than deleted, and keeps the currency their amounts are in. */
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
    return [...currencyChanged, ...dependentRefusals(['transactions'], fresh, after)]
  },
}

/** A new account, its text trimmed, with an id of its own. */
export function newAccount(account: Omit<Account, 'id'>): Account {
  return { ...account, name: account.name.trim(), iban: account.iban.trim(), id: recordIdOf(ACCOUNT_RECORDS, newRecordId()) }
}
