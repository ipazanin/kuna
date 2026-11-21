import { beforeStartDay } from '../../workbook/domain/account'
import type { Account } from '../../workbook/domain/account'
import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import type { Transaction } from '../../workbook/domain/transaction'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { addAccountMoney, sumAccountMoney } from '../../../../shared/money/accountMoney'
import type { AccountMoney } from '../../../../shared/money/accountMoney'
import { goingRows } from './goingRows'
import type { GoingRows } from './goingRows'

/**
 * What moving an account's start day to another day does. Moving it later deletes what the account holds from before the
 * new day: its rows with their receipts and parts, and its bank rows on hold. A transfer's other leg is on an account that
 * keeps its history, so it stays as a lone leg. Moving it earlier deletes nothing.
 */
export interface StartDayMove extends GoingRows {
  readonly account: Account
  readonly startsOn: CivilDate
  readonly direction: 'later' | 'earlier'
  /** What the account held at the start of the new day, so its balance from that day on stays. Moving earlier keeps the opening. */
  readonly opening: AccountMoney
}

/** What moving the account's start day to the day does, or null when the day is its start day already. */
export function startDayMove(book: Pick<SpendingBook, 'transactions' | 'receipts' | 'items' | 'held'>, account: Account, startsOn: CivilDate): StartDayMove | null {
  if (startsOn === account.openedOn) return null
  const moved = { ...account, openedOn: startsOn }
  const goes = (row: Pick<Transaction, 'account' | 'date'>): boolean => row.account === account.id && beforeStartDay(moved, row.date)
  const going = goingRows(book, goes, goes)
  return {
    ...going,
    account,
    startsOn,
    direction: beforeStartDay(account, startsOn) ? 'earlier' : 'later',
    opening: addAccountMoney(account.opening, sumAccountMoney(going.rows.map((row) => row.amount))),
  }
}

/** Whether the move deletes anything, so the person sees what goes before it is written. */
export function deletesRecords(move: GoingRows): boolean {
  return move.rows.length + move.held.length > 0
}
