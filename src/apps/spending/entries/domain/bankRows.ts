import { isBankSyncKey, isTranscribedKey } from '../../statements/domain/statementRows'
import { takesRowFrom } from '../../../../shared/app/accountSource'
import type { RowOrigin } from '../../../../shared/app/accountSource'
import { takesRowsByHand } from '../../workbook/domain/account'
import type { Account } from '../../workbook/domain/account'
import type { Transaction } from '../../workbook/domain/transaction'

/** Whether a person made the row: typed it, had a receipt make it, or had the chat copy it off a printed statement. A file's row and the bank sync's are the bank's. */
export function madeByHand(row: Pick<Transaction, 'importKey'>): boolean {
  return row.importKey === '' || isTranscribedKey(row.importKey)
}

/**
 * Where a row came from: the bank sync, the bank's statement file, or a person. Any other keyed row is read as the bank's
 * statement file, since a statement export is the only import that keys its rows.
 */
export function originOf(row: Pick<Transaction, 'importKey'>): RowOrigin {
  if (madeByHand(row)) return 'by-hand'
  return isBankSyncKey(row.importKey) ? 'automation' : 'provider-file'
}

/**
 * Whether a new row may not go on the account: one the bank link fills takes the sync's rows, the bank's statement file only
 * when the account allows it, and never a row a person typed, a receipt made or the chat copied. A receipt there waits for the
 * bank's row instead.
 */
export function refusedOnAccount(row: Pick<Transaction, 'importKey'>, account: Pick<Account, 'rowsFrom' | 'alsoFrom'>): boolean {
  return !takesRowFrom(account.rowsFrom, account.alsoFrom, originOf(row))
}

/** Whether the bank fixed the row's amount and day: a row it brought onto an account it fills, whose balance it checks against them. */
export function fixedByBank(row: Pick<Transaction, 'importKey'>, account: Pick<Account, 'rowsFrom'>): boolean {
  return !takesRowsByHand(account) && !madeByHand(row)
}
