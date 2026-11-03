import type { ComparedPick } from './comparedLine'

const SYMBOLS = ['SPY', 'DIA', 'QQQ', 'ONEQ', 'GLD'] as const

export type IndexFundSymbol = (typeof SYMBOLS)[number]

/** The vendor whose free key gives the closes of the named funds, since each is listed in the United States. */
export const INDEX_FUNDS_SOURCE = 'twelvedata'

/** The funds Compare with offers by name, each tracking an index or the price of gold, quoted in dollars without the dividends they pay out. */
export const INDEX_FUNDS: readonly (ComparedPick & { readonly symbol: IndexFundSymbol })[] = SYMBOLS.map((symbol) => ({ source: INDEX_FUNDS_SOURCE, symbol, currency: 'USD' }))
