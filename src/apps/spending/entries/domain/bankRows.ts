import { isBankSyncKey, isTranscribedKey } from '../../statements/domain/statementRows'
import { takesRowOn } from '../../../../shared/app/accountSource'
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
 * Whether a new row may not go on the account: a row is taken only when it comes from the source of the period its day falls
 * in. A day the bank link or the statement file fills takes no row a person typed, a receipt made or the chat copied, and a
 * receipt there waits for the bank's row instead.
 */
export function refusedOnAccount(row: Pick<Transaction, 'importKey' | 'date'>, account: Pick<Account, 'sources'>): boolean {
  return !takesRowOn(account.sources, row.date, originOf(row))
}

/** Whether the bank fixed the row's amount and day: a row it brought on a day the bank or its file fills, whose balance it checks against them. */
export function fixedByBank(row: Pick<Transaction, 'importKey' | 'date'>, account: Pick<Account, 'sources'>): boolean {
  return !takesRowsByHand(account, row.date) && !madeByHand(row)
}
