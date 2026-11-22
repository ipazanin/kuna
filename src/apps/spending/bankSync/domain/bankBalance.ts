import { accountBalance } from '../../accounts/domain/accountBalance'
import type { Account } from '../../workbook/domain/account'
import type { Transaction } from '../../workbook/domain/transaction'
import type { BankStated } from '../../../../shared/bank-sync/domain/statedBalance'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { addAccountMoney, subtractAccountMoney } from '../../../../shared/money/accountMoney'
import type { AccountMoney } from '../../../../shared/money/accountMoney'

/** What a bank says one Spending account holds, and what it holds as not booked yet without listing it as a row, null when nothing. */
export interface StatedBalance extends BankStated {
  readonly account: Account
  readonly unlisted: AccountMoney | null
}

/** An account whose balance on the day differs from what its bank says. */
export interface BalanceDifference {
  readonly account: Account
  readonly stated: AccountMoney
  readonly worked: AccountMoney
  /** The opening that would make the two agree. */
  readonly fixedOpening: AccountMoney
}

/** The rows a balance of the kind counts: a booked one leaves out rows the bank has not booked yet. */
export function rowsCountedBy<Row extends Pick<Transaction, 'pending'>>(kind: BankStated['kind'], rows: readonly Row[]): readonly Row[] {
  return kind === 'booked' ? rows.filter((row) => !row.pending) : rows
}

/** Each account whose balance on the day differs from what the bank says, a booked balance read against the booked rows. It never refuses, as with a file's balance, since the rows are what count. */
export function balanceDifferences(stated: readonly StatedBalance[], rows: readonly Transaction[], day: CivilDate): readonly BalanceDifference[] {
  return stated.flatMap(({ account, balance, kind }) => {
    const worked = accountBalance(account, rowsCountedBy(kind, rows), day)
    if (worked === balance) return []
    return [{ account, stated: balance, worked, fixedOpening: addAccountMoney(account.opening, subtractAccountMoney(balance, worked)) }]
  })
}

/** The differences whose account still opens as it did at the fetch, so one fixed or edited since drops out. */
export function currentDifferences(differences: readonly BalanceDifference[], accounts: readonly Pick<Account, 'id' | 'opening'>[]): readonly BalanceDifference[] {
  return differences.filter((difference) => accounts.find((account) => account.id === difference.account.id)?.opening === difference.account.opening)
}
