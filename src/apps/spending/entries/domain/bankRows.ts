import { isTranscribedKey } from '../../statements/domain/statementRows'
import { takesRowsByHand } from '../../workbook/domain/account'
import type { Account } from '../../workbook/domain/account'
import type { Transaction } from '../../workbook/domain/transaction'

/** Whether a person made the row: typed it, had a receipt make it, or had the chat copy it off a printed statement. A file's row and the bank sync's are the bank's. */
export function madeByHand(row: Pick<Transaction, 'importKey'>): boolean {
  return row.importKey === '' || isTranscribedKey(row.importKey)
}

/**
 * Whether a new row may not go on the account: one a person typed, a receipt made or the chat copied, on an account the bank
 * fills, which takes its rows from the bank alone. A receipt there waits for the bank's row instead.
 */
export function refusedOnAccount(row: Pick<Transaction, 'importKey'>, account: Pick<Account, 'rowsFrom' | 'openedOn'>): boolean {
  return !takesRowsByHand(account) && madeByHand(row)
}

/** Whether the bank fixed the row's amount and day: a row it brought onto an account it fills, whose balance it checks against them. */
export function fixedByBank(row: Pick<Transaction, 'importKey'>, account: Pick<Account, 'rowsFrom' | 'openedOn'>): boolean {
  return !takesRowsByHand(account) && !madeByHand(row)
}
