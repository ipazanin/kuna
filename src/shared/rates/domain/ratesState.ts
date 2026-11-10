import { NO_RATES } from '../../money/rateBook'
import type { RateBook } from '../../money/rateBook'

/** The page's rates while this browser's copy is read and what is missing is fetched, or once in hand, with whether a fetch failed. */
export type RatesState = 'loading' | { readonly everyday: RateBook; readonly failed: boolean }

/** The rates in hand, which convert nothing while they load. */
export function everydayRates(state: RatesState): RateBook {
  return state === 'loading' ? NO_RATES : state.everyday
}
