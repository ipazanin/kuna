import type { Close, PriceBook } from './priceBook'
import { rateSeriesKey, seriesKey } from './pricesFile'
import type { PriceSeries, PricesFile } from './pricesFile'
import type { RateBook } from './rateBook'
import type { HandPrice } from '../../workbook/domain/handPrice'
import type { Instrument } from '../../workbook/domain/instrument'
import { parseCivilDate } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { CurrencyCode } from '../../../../shared/money/currencyCode'
import { decimalOfText } from '../../../../shared/money/decimal'
import type { Decimal } from '../../../../shared/money/decimal'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

interface DatedDecimal {
  readonly date: CivilDate
  readonly value: Decimal
}

/** The series read into days and decimals once, the first time a figure asks for it. */
function seriesReader(file: PricesFile): (key: string) => readonly DatedDecimal[] {
  const read = new Map<string, readonly DatedDecimal[]>()
  return (key) => {
    let rows = read.get(key)
    if (rows === undefined) {
      rows = datedDecimals(file.series[key])
      read.set(key, rows)
    }
    return rows
  }
}

function datedDecimals(series: PriceSeries | undefined): readonly DatedDecimal[] {
  return (series?.closes ?? []).map(([day, close]) => ({ date: parseCivilDate(day)!, value: decimalOfText(close)! }))
}

/** The latest row on or before the day, in rows oldest first. */
function latestOnOrBefore(rows: readonly DatedDecimal[], day: CivilDate): DatedDecimal | null {
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

/**
 * The figures' closes: the fetched ones from the prices file, for an instrument priced by a vendor, and the prices
 * entered by hand. The latest on or before the day counts, and on a day with both the fetched close wins.
 */
export function pricesFileBook(file: PricesFile, handPrices: readonly HandPrice[]): PriceBook {
  const fetched = seriesReader(file)
  const byHand = new Map<RecordId, DatedDecimal[]>()
  for (const price of handPrices) {
    const prices = byHand.get(price.instrument)
    const dated = { date: price.date, value: price.price }
    if (prices === undefined) {
      byHand.set(price.instrument, [dated])
    } else {
      prices.push(dated)
    }
  }
  for (const prices of byHand.values()) {
    prices.sort((earlier, later) => earlier.date.localeCompare(later.date))
  }
  return {
    closeOnOrBefore(instrument: Instrument, day: CivilDate): Close | null {
      const listed = instrument.prices === 'manual' ? null : latestOnOrBefore(fetched(seriesKey(instrument.prices, instrument.sourceSymbol)), day)
      const hand = latestOnOrBefore(byHand.get(instrument.id) ?? [], day)
      if (hand !== null && (listed === null || hand.date > listed.date)) {
        return { date: hand.date, price: hand.value, byHand: true }
      }
      return listed === null ? null : { date: listed.date, price: listed.value, byHand: false }
    },
  }
}

/** The ECB rates kept in the prices file. */
export function pricesFileRateBook(file: PricesFile): RateBook {
  const rates = seriesReader(file)
  return {
    unitsPerEuroOnOrBefore(currency: CurrencyCode, day: CivilDate): Decimal | null {
      return latestOnOrBefore(rates(rateSeriesKey(currency)), day)?.value ?? null
    },
  }
}
