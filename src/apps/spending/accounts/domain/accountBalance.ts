import type { Account } from '../../workbook/domain/account'
import type { Transaction } from '../../workbook/domain/transaction'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { addMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'

/** What the account holds at the end of the day, in its currency: its opening and every row on it from the day it opened to that day. */
export function accountBalance(account: Account, rows: readonly Transaction[], day: CivilDate): Money {
  return rows.reduce((balance, row) => (row.account === account.id && row.date >= account.openedOn && row.date <= day ? addMoney(balance, row.amount) : balance), account.opening)
}
