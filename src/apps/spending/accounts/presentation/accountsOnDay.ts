import { accountOnDay } from '../../rates/domain/euroRows'
import type { AccountOnDay } from '../../rates/domain/euroRows'
import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { RateBook } from '../../../../shared/money/rateBook'

/** Each account's balance on the day in its currency and in euros, open accounts first, each in the order of the file. */
export function accountsOnDay(book: Pick<SpendingBook, 'accounts' | 'transactions'>, day: CivilDate, rates: RateBook): AccountOnDay[] {
  const ordered = [...book.accounts.filter((account) => !account.closed), ...book.accounts.filter((account) => account.closed)]
  return ordered.map((account) => accountOnDay(account, book.transactions, day, rates))
}
