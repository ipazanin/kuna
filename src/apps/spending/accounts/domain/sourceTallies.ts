import { originOf } from '../../entries/domain/bankRows'
import type { Account, SpendingSource } from '../../workbook/domain/account'
import type { Transaction } from '../../workbook/domain/transaction'
import { periodTallies } from '../../../../shared/app/accountSource'
import type { PeriodTally } from '../../../../shared/app/accountSource'

/** Each of the account's periods with how many of its rows each origin brought on its days. */
export function sourceTallies(account: Pick<Account, 'id' | 'sources'>, rows: readonly Pick<Transaction, 'account' | 'date' | 'importKey'>[]): readonly PeriodTally<SpendingSource>[] {
  return periodTallies(
    account.sources,
    rows.filter((row) => row.account === account.id).map((row) => ({ date: row.date, origin: originOf(row) })),
  )
}
