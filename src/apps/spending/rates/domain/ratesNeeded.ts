import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { EURO } from '../../../../shared/money/currencyCode'
import type { CurrencyCode } from '../../../../shared/money/currencyCode'

/** Each foreign currency the book's accounts keep, with the day its rates are needed from: the day its oldest account opened or its oldest row. */
export function ratesNeeded(book: Pick<SpendingBook, 'accounts' | 'transactions'>): ReadonlyMap<CurrencyCode, CivilDate> {
  const needed = new Map<CurrencyCode, CivilDate>()
  const currencies = new Map(book.accounts.map((account) => [account.id, account.currency]))
  const asked = (currency: CurrencyCode, day: CivilDate): void => {
    const known = needed.get(currency)
    if (currency !== EURO && (known === undefined || day < known)) needed.set(currency, day)
  }
  book.accounts.forEach((account) => asked(account.currency, account.openedOn))
  book.transactions.forEach((row) => asked(currencies.get(row.account) ?? EURO, row.date))
  return needed
}
