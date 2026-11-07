import type { BankBalance } from './bankAnswer'
import { words } from './words'
import { accountBalance } from '../../accounts/domain/accountBalance'
import type { Account } from '../../workbook/domain/account'
import type { Transaction } from '../../workbook/domain/transaction'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { accountMoneyFromAmount } from '../../../../shared/money/accountMoney'
import type { AccountMoney } from '../../../../shared/money/accountMoney'
import { formatAccountMoney } from '../../../../shared/money/moneyFormat'
import { decimalOf } from '../../../../shared/storage/domain/storedFields'

/** The booked balances, newest kind first. Kuna leaves pending rows out, so these are the ones it should agree with. */
const BOOKED_TYPES: readonly string[] = ['ITBD', 'CLBD']

/** What a bank says one Spending account holds. */
export interface StatedBalance {
  readonly account: Account
  readonly balance: AccountMoney
}

/** The bank's balance in the currency, a booked one if it gives one, else the first it lists. Null when it gives none that can be read. */
export function statedBalance(balances: readonly BankBalance[], currency: string): AccountMoney | null {
  const inCurrency = balances.filter((balance) => balance.currency === currency)
  const stated = BOOKED_TYPES.map((type) => inCurrency.find((balance) => balance.type === type)).find((balance) => balance !== undefined) ?? inCurrency[0]
  const amount = stated === undefined ? null : decimalOf(stated.amount)
  return amount === null ? null : accountMoneyFromAmount(amount)
}

/** A note for each account whose balance on the day differs from what the bank says. It never refuses, as with a file's balance, since the rows are what count. */
export function balanceNotes(stated: readonly StatedBalance[], rows: readonly Transaction[], day: CivilDate): readonly string[] {
  return stated.flatMap(({ account, balance }) => {
    const worked = accountBalance(account, rows, day)
    return worked === balance ? [] : [words.balanceDiffers(account.name, formatAccountMoney(balance, account.currency), formatAccountMoney(worked, account.currency))]
  })
}
