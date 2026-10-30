import type { CurrencyCode } from '../../../../shared/money/currencyCode'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** What an instrument holds, so an equity ETF is stocks and a gold ETC is gold. */
export const INSTRUMENT_CLASSES = ['stocks', 'bonds', 'money-market', 'crypto', 'gold'] as const

export type InstrumentClass = (typeof INSTRUMENT_CLASSES)[number]

/** Where its daily closes come from. A manual instrument has only the prices entered by hand. */
export const PRICE_SOURCES = ['tiingo', 'alphavantage', 'manual'] as const

export type PriceSource = (typeof PRICE_SOURCES)[number]

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
  readonly prices: PriceSource
  /** Empty for a manual instrument. */
  readonly sourceSymbol: string
  readonly note: string
}
