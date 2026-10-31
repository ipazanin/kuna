import type { HoldingFigures } from '../domain/holding'
import type { Instrument } from '../../workbook/domain/instrument'
import { words } from './words'
import { dayLabel } from '../../../../shared/calendar/dayLabel'

/** As many places as a broker books a fractional unit with. */
export const QUANTITY_PLACES = 6

/** Places of a price worked out by dividing, such as an average cost, where six would only show the division's tail. */
export const WORKED_OUT_PRICE_PLACES = 4

/** The symbol, the exchange and the quote currency, such as "ABC · XNAS · USD". */
export function listingLine(instrument: Instrument): string {
  return [instrument.symbol, instrument.exchange, instrument.currency].filter((part) => part !== null && part !== '').join(' · ')
}

/** Why a holding's price needs a look, with an icon so colour is never the only cue. Null for a fetched close that is not late. */
export interface PriceMark {
  readonly icon: string
  readonly text: string
  readonly late: boolean
}

export function priceMarkOf(holding: HoldingFigures): PriceMark | null {
  const close = holding.valuation?.close ?? null
  if (close === null) {
    return null
  }
  if (holding.late) {
    return { icon: 'i-lucide-clock-alert', text: words.late(dayLabel(close.date)), late: true }
  }
  return close.byHand ? { icon: 'i-lucide-hand', text: words.byHand(dayLabel(close.date)), late: false } : null
}
