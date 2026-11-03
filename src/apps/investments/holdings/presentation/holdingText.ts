import type { HoldingFigures } from '../domain/holding'
import type { HoldingsGroup } from '../domain/holdingsList'
import type { Instrument } from '../../workbook/domain/instrument'
import { words } from './words'
import { usePrices } from '../../prices/presentation/usePrices'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { formatCurrencyAmount } from '../../../../shared/money/moneyFormat'
import { listInWords } from '../../../../shared/text/listInWords'
import { plural } from '../../../../shared/text/translation'

/** As many places as a broker books a fractional unit with. */
export const QUANTITY_PLACES = 6

/** The average cost to the cent, as every cost on a holding shows. */
export function averageCostText(holding: Pick<HoldingFigures, 'instrument' | 'averageCost'>): string | null {
  return holding.averageCost === null ? null : formatCurrencyAmount(holding.averageCost, holding.instrument.currency)
}

/** The symbol, the exchange and the quote currency, such as "ABC · XNAS · USD". */
export function listingLine(instrument: Instrument): string {
  return [instrument.symbol, instrument.exchange, instrument.currency].filter((part) => part !== null && part !== '').join(' · ')
}

/** How many holdings and cash balances a group lists, such as "2 holdings and 1 cash balance". */
export function groupCount(group: Pick<HoldingsGroup, 'holdings' | 'lines'>): string {
  const balances = group.lines.length - group.holdings
  return listInWords([...(group.holdings > 0 ? [plural(words.holdingCount(group.holdings), group.holdings)] : []), ...(balances > 0 ? [plural(words.balanceCount(balances), balances)] : [])])
}

/** What a holding with no price says: Fetching while a fetch runs that may bring its close, else that it has none yet. */
export function useNoPriceWord(): (instrument: Instrument) => string {
  const prices = usePrices()
  return (instrument) => (prices.state.fetching !== null && instrument.prices !== 'manual' ? words.fetching : words.noPrice)
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
