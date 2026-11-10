import { beforeStartDay } from '../../workbook/domain/account'
import type { Account } from '../../workbook/domain/account'
import type { EntryPart } from '../../workbook/domain/entryPart'
import type { HeldBankRow } from '../../workbook/domain/heldBankRow'
import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import type { Receipt } from '../../workbook/domain/receipt'
import type { Transaction } from '../../workbook/domain/transaction'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { addAccountMoney, sumAccountMoney } from '../../../../shared/money/accountMoney'
import type { AccountMoney } from '../../../../shared/money/accountMoney'

/**
 * What moving an account's start day to another day does. Moving it later deletes what the account holds from before the
 * new day: its rows with their receipts and parts, and its bank rows on hold. A transfer's other leg is on an account that
 * keeps its history, so it stays as a lone leg. Moving it earlier deletes nothing.
 */
export interface StartDayMove {
  readonly account: Account
  readonly startsOn: CivilDate
  readonly direction: 'later' | 'earlier'
  readonly rows: readonly Transaction[]
  readonly receipts: readonly Receipt[]
  /** The parts of the rows that go, a receipt's lines and parts split by hand alike. */
  readonly parts: readonly EntryPart[]
  readonly held: readonly HeldBankRow[]
  /** The other legs of the transfers among the rows, as they are now, which stay with no pair. */
  readonly loneLegs: readonly Transaction[]
  /** What the account held at the start of the new day, so its balance from that day on stays. Moving earlier keeps the opening. */
  readonly opening: AccountMoney
}

/** What moving the account's start day to the day does, or null when the day is its start day already. */
export function startDayMove(book: Pick<SpendingBook, 'transactions' | 'receipts' | 'lines' | 'held'>, account: Account, startsOn: CivilDate): StartDayMove | null {
  if (startsOn === account.openedOn) return null
  const moved = { ...account, openedOn: startsOn }
  const goes = (row: Pick<Transaction, 'account' | 'date'>): boolean => row.account === account.id && beforeStartDay(moved, row.date)
  const rows = book.transactions.filter(goes)
  const ids = new Set(rows.map((row) => row.id))
  const pairs = new Set(rows.flatMap((row) => (row.pair === null ? [] : [row.pair])))
  return {
    account,
    startsOn,
    direction: beforeStartDay(account, startsOn) ? 'earlier' : 'later',
    rows,
    receipts: book.receipts.filter((receipt) => ids.has(receipt.transaction)),
    parts: book.lines.filter((part) => ids.has(part.transaction)),
    held: book.held.filter(goes),
    loneLegs: book.transactions.filter((row) => pairs.has(row.id) && !ids.has(row.id)),
    opening: addAccountMoney(account.opening, sumAccountMoney(rows.map((row) => row.amount))),
  }
}

/** Whether the move deletes anything, so the person sees what goes before it is written. */
export function deletesRecords(move: StartDayMove): boolean {
  return move.rows.length + move.held.length > 0
}

/** A transfer's other leg once its leg on the moved account is gone: the same row with no pair, still under its category. */
export function loneLeg(leg: Transaction): Transaction {
  return { ...leg, pair: null }
}
