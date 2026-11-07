import type { Account } from '../../workbook/domain/account'
import type { Transaction } from '../../workbook/domain/transaction'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { addAccountMoney } from '../../../../shared/money/accountMoney'
import type { AccountMoney } from '../../../../shared/money/accountMoney'

/** What the account holds at the end of the day, in its currency: its opening and every row on it from the day it opened to that day. */
export function accountBalance(account: Account, rows: readonly Transaction[], day: CivilDate): AccountMoney {
  return rows.reduce((balance, row) => (row.account === account.id && row.date >= account.openedOn && row.date <= day ? addAccountMoney(balance, row.amount) : balance), account.opening)
}
