import type { BankBalance } from './bankAnswer'
import { accountBalance } from '../../accounts/domain/accountBalance'
import type { Account } from '../../workbook/domain/account'
import type { Transaction } from '../../workbook/domain/transaction'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { accountMoneyFromAmount, addAccountMoney, subtractAccountMoney } from '../../../../shared/money/accountMoney'
import type { AccountMoney } from '../../../../shared/money/accountMoney'
import { decimalOf } from '../../../../shared/storage/domain/storedFields'

/** The booked balances, newest kind first. Kuna leaves pending rows out, so these are the ones it should agree with. */
const BOOKED_TYPES: readonly string[] = ['ITBD', 'CLBD']

/** What a bank says one Spending account holds, and whether the fetch held pending rows, which a balance of another kind may already count. */
export interface StatedBalance {
  readonly account: Account
  readonly balance: AccountMoney
  readonly pending: boolean
}

/** An account whose balance on the day differs from what its bank says. */
export interface BalanceDifference {
  readonly account: Account
  readonly stated: AccountMoney
  readonly worked: AccountMoney
  /** The opening that would make the two agree, or null when pending rows may explain the difference, so changing the opening could be wrong. */
  readonly fixedOpening: AccountMoney | null
}

/** The bank's balance in the currency, a booked one if it gives one, else the first it lists. Null when it gives none that can be read. */
export function statedBalance(balances: readonly BankBalance[], currency: string): AccountMoney | null {
  const inCurrency = balances.filter((balance) => balance.currency === currency)
  const stated = BOOKED_TYPES.map((type) => inCurrency.find((balance) => balance.type === type)).find((balance) => balance !== undefined) ?? inCurrency[0]
  const amount = stated === undefined ? null : decimalOf(stated.amount)
  return amount === null ? null : accountMoneyFromAmount(amount)
}

/** Each account whose balance on the day differs from what the bank says. It never refuses, as with a file's balance, since the rows are what count. */
export function balanceDifferences(stated: readonly StatedBalance[], rows: readonly Transaction[], day: CivilDate): readonly BalanceDifference[] {
  return stated.flatMap(({ account, balance, pending }) => {
    const worked = accountBalance(account, rows, day)
    if (worked === balance) return []
    return [{ account, stated: balance, worked, fixedOpening: pending ? null : addAccountMoney(account.opening, subtractAccountMoney(balance, worked)) }]
  })
}
