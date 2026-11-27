/** A market outside the US with the suffix each source writes after a symbol listed there, such as `VWCE.DE` on Yahoo and `VWCE.DEX` on Alpha Vantage. */
export interface MarketSuffixes {
  /** The market identifier code an instrument's exchange holds. */
  readonly mic: string
  /** The suffix of the Yahoo symbols the investments workbook names its instruments by. */
  readonly yahoo: string
  readonly alphaVantage: string
}

/** The markets whose listings the import proposes Alpha Vantage prices for, and whose code an Alpha Vantage search gives by suffix. */
export const MARKET_SUFFIXES: readonly MarketSuffixes[] = [
  { mic: 'XETR', yahoo: 'DE', alphaVantage: 'DEX' },
  { mic: 'XAMS', yahoo: 'AS', alphaVantage: 'AMS' },
]

/** A symbol split at its first dot into the symbol and its suffix, both upper case, the suffix empty where there is none. */
export function symbolParts(symbol: string): { readonly base: string; readonly suffix: string } {
  const [base = '', suffix = ''] = symbol.toUpperCase().split('.')
  return { base, suffix }
}

/** The market a source's suffix names, or null where the table has none. */
export function marketOfSuffix(source: 'yahoo' | 'alphaVantage', suffix: string): MarketSuffixes | null {
  return MARKET_SUFFIXES.find((market) => market[source] === suffix.toUpperCase()) ?? null
}

/** The symbol Alpha Vantage writes for a listing on the market. */
export function alphaVantageSymbol(base: string, market: MarketSuffixes): string {
  return `${base}.${market.alphaVantage}`
}
