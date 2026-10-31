import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { CurrencyCode } from '../../../../shared/money/currencyCode'
import type { Decimal } from '../../../../shared/money/decimal'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** What an instrument holds, so an equity ETF is stocks and a gold ETC is gold. */
export const INSTRUMENT_CLASSES = ['stocks', 'bonds', 'money-market', 'crypto', 'gold'] as const

export type InstrumentClass = (typeof INSTRUMENT_CLASSES)[number]

/** The price vendor its daily closes come from, by its id in the vendor registry. A manual instrument has only the prices entered by hand. */
export const PRICE_SOURCES = ['twelvedata', 'alphavantage', 'manual'] as const

export type PriceSource = (typeof PRICE_SOURCES)[number]

/** Units at a price per unit, such as shares, funds and crypto. */
export interface UnitQuoting {
  readonly kind: 'unit'
}

/**
 * A bond held directly: its quantity is the nominal and its price is in percent of it. Its coupon is paid once a year,
 * on the day and month of its maturity. A treasury bill is a bond with a coupon of zero.
 */
export interface PercentQuoting {
  readonly kind: 'percent'
  /** In percent of the nominal a year, so 3 is 3%. */
  readonly coupon: Decimal
  readonly maturity: CivilDate
}

/** Physical gold held in grams. Its trades are per gram, and its closes, fetched or by hand, per troy ounce as gold is quoted. */
export interface GramQuoting {
  readonly kind: 'gram'
}

export type Quoting = UnitQuoting | PercentQuoting | GramQuoting

/** Something Ivan buys and sells, with the one listing that prices it. Its trades are in its quote currency. */
export interface Instrument {
  readonly id: RecordId
  readonly name: string
  readonly class: InstrumentClass
  /** Unique when given. */
  readonly isin: string | null
  readonly symbol: string
  /** A market identifier code such as XETR. */
  readonly exchange: string | null
  readonly currency: CurrencyCode
  readonly quoted: Quoting
  readonly prices: PriceSource
  /** Empty for a manual instrument. */
  readonly sourceSymbol: string
  /** Whether Performance compares the portfolio with it. It may be held or not. */
  readonly benchmark: boolean
  readonly note: string
}
