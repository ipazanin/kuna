import { parseCivilDate } from '../calendar/civilDate'
import type { CivilDate } from '../calendar/civilDate'
import { EURO } from './currencyCode'
import type { CurrencyCode } from './currencyCode'
import { decimalOfText, inEuros } from './decimal'
import type { Decimal } from './decimal'
import type { Money } from './money'

/** The ECB's daily euro reference rates, in units of a currency per euro. */
export interface RateBook {
  /** The rate of the day, or of the latest earlier day the ECB published one. Null before the series starts. */
  unitsPerEuroOnOrBefore(currency: CurrencyCode, day: CivilDate): Decimal | null
  /** The day of the newest rate of the currency, null when there is none. */
  newestDay(currency: CurrencyCode): CivilDate | null
}

/** Rates before any have loaded, which convert nothing. */
export const NO_RATES: RateBook = { unitsPerEuroOnOrBefore: () => null, newestDay: () => null }

/** The amount in euros at the ECB rate on or before the day. Null for a foreign amount the series has no rate for yet. */
export function eurosAtEcbRate(amount: Decimal, currency: CurrencyCode, day: CivilDate, rates: RateBook): Money | null {
  if (currency === EURO) {
    return inEuros(amount, null)
  }
  const rate = rates.unitsPerEuroOnOrBefore(currency, day)
  return rate === null ? null : inEuros(amount, rate)
}

/** One day's rate as the ECB writes it, in units of the currency per euro. */
export type EcbRate = readonly [day: string, rate: string]

/** A value on a day, such as a rate or a close. */
export interface DatedDecimal {
  readonly date: CivilDate
  readonly value: Decimal
}

/** The latest of the rows, oldest first, on or before the day, or null before the first. */
export function latestOnOrBefore<Row extends { readonly date: CivilDate }>(rows: readonly Row[], day: CivilDate): Row | null {
  let low = 0
  let high = rows.length
  while (low < high) {
    const middle = (low + high) >>> 1
    if (rows[middle]!.date <= day) {
      low = middle + 1
    } else {
      high = middle
    }
  }
  return rows[low - 1] ?? null
}

/** The rates of each currency, oldest first, as `seriesOf` gives them, as a book that answers the rate on or before a day. */
export function rateBookOfSeries(seriesOf: (currency: CurrencyCode) => readonly DatedDecimal[]): RateBook {
  return {
    unitsPerEuroOnOrBefore: (currency, day) => latestOnOrBefore(seriesOf(currency), day)?.value ?? null,
    newestDay: (currency) => seriesOf(currency).at(-1)?.date ?? null,
  }
}

/** The ECB's rates of each currency as it wrote them, oldest first, as a book. A day or a rate that does not read is left out. */
export function rateBookOfEcbRates(series: ReadonlyMap<CurrencyCode, readonly EcbRate[]>): RateBook {
  const read = new Map(
    [...series].map(([currency, rates]) => [
      currency,
      rates.flatMap(([day, rate]): DatedDecimal[] => {
        const date = parseCivilDate(day)
        const value = decimalOfText(rate)
        return date === null || value === null ? [] : [{ date, value }]
      }),
    ]),
  )
  return rateBookOfSeries((currency) => read.get(currency) ?? [])
}
