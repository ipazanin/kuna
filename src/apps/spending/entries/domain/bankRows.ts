import { isTranscribedKey } from '../../statements/domain/statementRows'
import { takesRowsByHand } from '../../workbook/domain/account'
import type { Account } from '../../workbook/domain/account'
import type { Transaction } from '../../workbook/domain/transaction'

/** Whether a person made the row: typed it, had a receipt make it, or had the chat copy it off a printed statement. A file's row and the bank sync's are the bank's. */
export function madeByHand(row: Pick<Transaction, 'importKey'>): boolean {
  return row.importKey === '' || isTranscribedKey(row.importKey)
}

/**
 * Whether a new row may not go on the account: a typed or copied one on an account the bank fills, which takes its rows from
 * the bank alone. A row a receipt made still goes there and waits for the bank's row to fill it.
 */
export function refusedOnAccount(row: Pick<Transaction, 'importKey' | 'source'>, account: Pick<Account, 'rowsFrom'>): boolean {
  return !takesRowsByHand(account) && madeByHand(row) && row.source !== 'receipt'
}

/** Whether the bank fixed the row's amount and day: a row it brought onto an account it fills, whose balance it checks against them. */
export function fixedByBank(row: Pick<Transaction, 'importKey'>, account: Pick<Account, 'rowsFrom'>): boolean {
  return !takesRowsByHand(account) && !madeByHand(row)
}
