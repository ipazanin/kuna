import type { WorkbookRow, WorkbookType } from './portfolioWorkbook'
import type { RatesWanted } from '../../prices/domain/priceDemand'
import type { RateBook } from '../../prices/domain/rateBook'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { EURO } from '../../../../shared/money/currencyCode'

/** The rows whose records carry the ECB rate of their day. An exchange, a transfer, a split and a spin-off carry none. */
const RATED: ReadonlySet<WorkbookType> = new Set(['BUY', 'SELL', 'DIVIDEND', 'INTEREST', 'STOCK YIELD INCOME', 'REFERRAL CREDIT', 'DEPOSIT', 'WITHDRAWAL', 'FEE', 'FEE REFUND'])

/**
 * The ECB rates the rows need that the rate book lacks: each foreign currency with a row dated before its first rate,
 * from the earliest such row. A deposit or withdrawal that gives Revolut's own rate needs none. Null when none is lacking.
 */
export function ratesWanted(rows: readonly WorkbookRow[], rates: RateBook): (RatesWanted & { readonly from: CivilDate }) | null {
  const lacking = rows.filter(
    (row) =>
      RATED.has(row.type) &&
      row.currency !== null &&
      row.currency !== EURO &&
      !((row.type === 'DEPOSIT' || row.type === 'WITHDRAWAL') && row.revolutRate !== null) &&
      rates.unitsPerEuroOnOrBefore(row.currency, row.date) === null,
  )
  if (lacking.length === 0) {
    return null
  }
  return { currencies: [...new Set(lacking.map((row) => row.currency!))], from: lacking.map((row) => row.date).sort()[0]! }
}
