import type { Instrument } from '../../workbook/domain/instrument'
import { words } from './words'
import { usePrices } from '../../prices/presentation/usePrices'

/** What a holding with no price says: Fetching while a fetch runs that may bring its close, else that it has none yet. */
export function useNoPriceWord(): (instrument: Instrument) => string {
  const prices = usePrices()
  return (instrument) => (prices.state.fetching !== null && instrument.prices !== 'manual' ? words.fetching : words.noPrice)
}
