import { goingRows } from './goingRows'
import type { GoingRows } from './goingRows'
import { originOf } from '../../entries/domain/bankRows'
import type { Account, SpendingPeriod, SpendingSource } from '../../workbook/domain/account'
import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import { rowItemsOf } from '../../workbook/domain/rowItems'
import { handedDays, inHandedDays, sourceOn, takesRowOn } from '../../../../shared/app/accountSource'
import type { HandedDays } from '../../../../shared/app/accountSource'

/**
 * What giving an account's days to another source does. The rows on those days the new source does not take go with their
 * parts, and so do the bank rows on hold there when the new source is not the bank link. A receipt on a row that goes waits
 * again for the new source's row, since the same purchase comes again. A transfer's other leg stays as a lone leg. The new
 * source then brings its own rows.
 */
export interface SourceHandover extends GoingRows {
  readonly account: Account
  readonly sources: readonly SpendingPeriod[]
  readonly runs: readonly HandedDays<SpendingSource>[]
  /** How many of the rows that go are linked to a record of another app, which shows it unpaid until the new row is linked. */
  readonly linked: number
}

/** What giving the account the periods does, or null when no day changes source. */
export function sourceHandover(book: Pick<SpendingBook, 'transactions' | 'receipts' | 'items' | 'held'>, account: Account, sources: readonly SpendingPeriod[]): SourceHandover | null {
  const runs = handedDays(account.sources, sources)
  if (runs.length === 0) return null
  const going = goingRows(
    book,
    (row) => row.account === account.id && inHandedDays(runs, row.date) && !takesRowOn(sources, row.date, originOf(row)),
    (held) => held.account === account.id && inHandedDays(runs, held.date) && sourceOn(sources, held.date) !== 'bank-link',
  )
  const itemsOf = rowItemsOf(book)
  return { ...going, account, sources, runs, linked: going.rows.filter((row) => itemsOf(row).some((item) => item.link !== null)).length }
}
