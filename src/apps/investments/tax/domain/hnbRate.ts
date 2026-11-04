import { targetDayOnOrBefore } from './workingDays'
import type { RateBook } from '../../prices/domain/rateBook'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { EURO } from '../../../../shared/money/currencyCode'
import type { CurrencyCode } from '../../../../shared/money/currencyCode'
import { inEuros } from '../../../../shared/money/decimal'
import type { Decimal } from '../../../../shared/money/decimal'
import type { Money } from '../../../../shared/money/money'

/** HNB's middle rate for a day, in units of the currency per euro. */
export interface HnbRate {
  readonly unitsPerEuro: Decimal
  /** The day of the newest ECB rate, taken in the day's place while the day's own rate is not out yet. Null once it is. */
  readonly estimatedFrom: CivilDate | null
}

/**
 * The list HNB publishes on the day, which carries the ECB rate of that day, so a Monday takes Monday's. A weekend or
 * TARGET holiday has no list and takes the last one before it. The prices file keeps ECB rates by the ECB's day. Null
 * before its first rate of the currency.
 */
export function hnbRate(rates: RateBook, currency: CurrencyCode, day: CivilDate): HnbRate | null {
  const unitsPerEuro = rates.unitsPerEuroOnOrBefore(currency, day)
  if (unitsPerEuro === null) {
    return null
  }
  const newest = rates.newestDay(currency)
  return { unitsPerEuro, estimatedFrom: newest === null || newest >= targetDayOnOrBefore(day) ? null : newest }
}

/** How an amount of a day reaches euros: it is in euros, at HNB's rate of the day, or there is no rate for the day. */
export type DayRate = { readonly kind: 'euro' } | { readonly kind: 'hnb'; readonly rate: HnbRate } | { readonly kind: 'missing' }

export function dayRate(rates: RateBook, currency: CurrencyCode, day: CivilDate): DayRate {
  if (currency === EURO) {
    return { kind: 'euro' }
  }
  const rate = hnbRate(rates, currency, day)
  return rate === null ? { kind: 'missing' } : { kind: 'hnb', rate }
}

/** The amount in euros at the day's rate, null without one. */
export function inEurosAt(amount: Decimal, rate: DayRate): Money | null {
  switch (rate.kind) {
    case 'euro':
      return inEuros(amount, null)
    case 'hnb':
      return inEuros(amount, rate.rate.unitsPerEuro)
    case 'missing':
      return null
  }
}

/** Whether the rate stands in for one not out yet. */
export function isEstimate(rate: DayRate): boolean {
  return rate.kind === 'hnb' && rate.rate.estimatedFrom !== null
}
