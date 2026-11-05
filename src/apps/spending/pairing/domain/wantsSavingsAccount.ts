import type { Account } from '../../workbook/domain/account'
import type { Transaction } from '../../workbook/domain/transaction'

/** A pocket move whose other leg has nowhere to go, since no savings account of the row's bank keeps its currency. */
export function wantsSavingsAccount(row: Pick<Transaction, 'account' | 'pocket'>, accounts: readonly Account[]): boolean {
  const own = accounts.find((account) => account.id === row.account)
  return row.pocket && own !== undefined && !accounts.some((account) => account.kind === 'savings' && account.bank === own.bank && account.currency === own.currency)
}
