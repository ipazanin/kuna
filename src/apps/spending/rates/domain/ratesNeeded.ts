import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import { addDays } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { EURO } from '../../../../shared/money/currencyCode'
import type { CurrencyCode } from '../../../../shared/money/currencyCode'

/** A week before the first day, so a first day on a weekend or a holiday still has the rate of the day before. */
const LEAD_DAYS = 7

/** Each foreign currency the book's accounts keep, with the day its rates are needed from: a week before its oldest account opened or its oldest row. */
export function ratesNeeded(book: Pick<SpendingBook, 'accounts' | 'transactions'>): ReadonlyMap<CurrencyCode, CivilDate> {
  const needed = new Map<CurrencyCode, CivilDate>()
  const currencies = new Map(book.accounts.map((account) => [account.id, account.currency]))
  const asked = (currency: CurrencyCode, day: CivilDate): void => {
    const known = needed.get(currency)
    if (currency !== EURO && (known === undefined || day < known)) needed.set(currency, day)
  }
  book.accounts.forEach((account) => asked(account.currency, account.openedOn))
  book.transactions.forEach((row) => asked(currencies.get(row.account) ?? EURO, row.date))
  return new Map([...needed].map(([currency, day]) => [currency, addDays(day, -LEAD_DAYS)]))
}
