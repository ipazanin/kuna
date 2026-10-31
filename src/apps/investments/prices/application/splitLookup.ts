import { pacedFetch } from './priceFetch'
import type { PriceFetchPorts } from './pricesPorts'
import type { Fetched, PriceVendor, VendorSplits } from './priceVendor'

/** What the vendor said of a symbol's splits, or why it said nothing. */
export type SplitsLookedUp = Fetched<VendorSplits>

export interface SplitLookup {
  /** The vendor's name, for the words that say why a split was not looked up. */
  readonly vendorName: string
  hasKey(): boolean
  /** Asks the vendor for each symbol in turn, counting each as it asks. Without a key it asks nothing. */
  lookUp(symbols: readonly string[], progress: (asked: number, of: number) => void): Promise<ReadonlyMap<string, SplitsLookedUp>>
}

/**
 * The splits of symbols from the vendor that lists them. Its requests go through one paced fetch for the page's life,
 * so they count against the vendor's limits a minute and a day, as a prices fetch counts its own.
 */
export function createSplitLookup(vendor: PriceVendor & Required<Pick<PriceVendor, 'splits'>>, ports: Pick<PriceFetchPorts, 'fetch' | 'pause' | 'key'>): SplitLookup {
  const fetch = pacedFetch(ports, vendor.limits, { elapsed: 0 })
  return {
    vendorName: vendor.name,
    hasKey: () => ports.key(vendor.id) !== null,
    async lookUp(symbols, progress) {
      const key = ports.key(vendor.id)
      const found = new Map<string, SplitsLookedUp>()
      if (key === null) {
        return found
      }
      progress(0, symbols.length)
      for (const [index, symbol] of symbols.entries()) {
        found.set(symbol, await vendor.splits(fetch, key, symbol))
        progress(index + 1, symbols.length)
      }
      return found
    },
  }
}
