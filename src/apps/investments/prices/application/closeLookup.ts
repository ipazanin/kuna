import { pacedFetch } from './priceFetch'
import type { PriceFetchPorts } from './pricesPorts'
import type { PriceVendor, VendorFetch } from './priceVendor'
import { seriesKey } from '../domain/pricesFile'
import type { CloseRow } from '../domain/pricesFile'

/** A listing whose closes are looked up from a day on. */
export interface CloseLookupAsk {
  readonly source: string
  readonly symbol: string
  readonly from: string
}

export interface CloseLookup {
  /** Asks each listing's vendor in turn, counting each as it asks, and gives the closes found by series key. A vendor without a key in this browser is not asked. */
  lookUp(asks: readonly CloseLookupAsk[], progress: (asked: number, of: number) => void): Promise<ReadonlyMap<string, readonly CloseRow[]>>
}

/**
 * The closes of a few listings looked up without writing the prices file, such as the parent and the new holding of a
 * spin-off the import asks about. Each vendor's requests go through one paced fetch for the page's life.
 */
export function createCloseLookup(vendors: readonly PriceVendor[], ports: Pick<PriceFetchPorts, 'fetch' | 'pause' | 'key'>): CloseLookup {
  const paced = new Map<string, VendorFetch>()
  const fetchOf = (vendor: PriceVendor): VendorFetch => {
    const fetch = paced.get(vendor.id) ?? pacedFetch(ports, vendor, { elapsed: 0 })
    paced.set(vendor.id, fetch)
    return fetch
  }
  return {
    async lookUp(asks, progress) {
      const found = new Map<string, readonly CloseRow[]>()
      progress(0, asks.length)
      for (const [index, ask] of asks.entries()) {
        const vendor = vendors.find((candidate) => candidate.id === ask.source)
        const key = vendor === undefined || !vendor.needsKey ? null : ports.key(vendor.id)
        if (vendor !== undefined && vendor.prices !== 'facts' && (!vendor.needsKey || key !== null)) {
          const fetched = await vendor.closes(fetchOf(vendor), key, ask.symbol, ask.from)
          if (fetched.kind === 'closes') {
            found.set(seriesKey(ask.source, ask.symbol), fetched.closes)
          }
        }
        progress(index + 1, asks.length)
      }
      return found
    },
  }
}
