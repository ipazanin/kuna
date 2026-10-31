import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { EURO } from '../../../../shared/money/currencyCode'
import type { CurrencyCode } from '../../../../shared/money/currencyCode'
import { inEuros } from '../../../../shared/money/decimal'
import type { Decimal } from '../../../../shared/money/decimal'
import type { Money } from '../../../../shared/money/money'

/** The ECB's daily euro reference rates, in units of a currency per euro. */
export interface RateBook {
  /** The rate of the day, or of the latest earlier day the ECB published one. Null before the series starts. */
  unitsPerEuroOnOrBefore(currency: CurrencyCode, day: CivilDate): Decimal | null
}

/** Rates before this browser has read the prices file, which convert nothing. */
export const NO_RATES: RateBook = { unitsPerEuroOnOrBefore: () => null }

/** The amount in euros at the ECB rate on or before the day. Null for a foreign amount the series has no rate for yet. */
export function eurosAtEcbRate(amount: Decimal, currency: CurrencyCode, day: CivilDate, rates: RateBook): Money | null {
  if (currency === EURO) {
    return inEuros(amount, null)
  }
  const rate = rates.unitsPerEuroOnOrBefore(currency, day)
  return rate === null ? null : inEuros(amount, rate)
}
