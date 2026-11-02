import { pacedFetch } from './priceFetch'
import type { PriceFetchPorts } from './pricesPorts'
import type { FoundListing, PriceVendor, VendorFetch } from './priceVendor'
import type { FailureReason } from '../domain/pricesFile'
import { typeOfListing } from '../domain/vendorWords'
import type { InstrumentType } from '../../workbook/domain/instrument'

/** A vendor whose free key takes fewer requests a day than this is asked only when the others found nothing, so its day is kept for closes. */
const SCARCE_DAILY_LIMIT = 100

/** One listing found, with the vendors that found it and the type Kuna reads in their words. */
export interface SearchedListing extends Omit<FoundListing, 'freeCloses'> {
  /** The names of the vendors that found it, in the order they were asked. */
  readonly foundBy: readonly string[]
  /** The vendors that found it and whose free key gives its closes, in the order they were asked. */
  readonly sources: readonly string[]
  readonly proposedType: InstrumentType | null
}

/** Why a vendor that was asked found nothing, with the vendor's name. */
export interface SearchFailure {
  readonly vendor: string
  readonly reason: FailureReason
}

export interface SymbolSearchResult {
  readonly listings: readonly SearchedListing[]
  readonly failures: readonly SearchFailure[]
}

export interface SymbolSearch {
  /** Whether any vendor that searches can be asked, with a key in this browser where it needs one. */
  canSearch(): boolean
  search(text: string): Promise<SymbolSearchResult>
}

type Searching = PriceVendor & Required<Pick<PriceVendor, 'search'>>

/** A listing as one vendor found it. */
interface FoundBy extends FoundListing {
  readonly vendor: PriceVendor
}

/** The listings found, one per symbol and market, in the order the vendors found them, the first vendor's words kept. */
function merged(found: readonly FoundBy[]): SearchedListing[] {
  const byKey = new Map<string, SearchedListing>()
  for (const { vendor, freeCloses, ...listing } of found) {
    const key = `${listing.symbol.toUpperCase()} ${(listing.mic ?? listing.market ?? '').toUpperCase()}`
    const known = byKey.get(key)
    byKey.set(key, {
      ...(known ?? listing),
      foundBy: [...(known?.foundBy ?? []), vendor.name],
      sources: [...(known?.sources ?? []), ...(freeCloses && vendor.prices === 'listings' ? [vendor.id] : [])],
      proposedType: known?.proposedType ?? (listing.type === null ? null : typeOfListing(listing.type)),
    })
  }
  return [...byKey.values()]
}

/**
 * The search of the instrument dialog, which asks each vendor that searches and has a key in this browser, once per
 * Search, never per keystroke. A vendor with a small daily limit is asked only when the others found nothing. Each
 * vendor's requests go through one paced fetch for the page's life, as a prices fetch's do.
 */
export function createSymbolSearch(vendors: readonly PriceVendor[], ports: Pick<PriceFetchPorts, 'fetch' | 'pause' | 'key'>): SymbolSearch {
  const searching = vendors.filter((vendor): vendor is Searching => vendor.search !== undefined)
  const paced = new Map<string, VendorFetch>()
  const fetchOf = (vendor: PriceVendor): VendorFetch => {
    const fetch = paced.get(vendor.id) ?? pacedFetch(ports, vendor, { elapsed: 0 })
    paced.set(vendor.id, fetch)
    return fetch
  }
  const askable = (): { readonly vendor: Searching; readonly key: string | null }[] =>
    searching.map((vendor) => ({ vendor, key: vendor.needsKey ? ports.key(vendor.id) : null })).filter(({ vendor, key }) => !vendor.needsKey || key !== null)
  const scarce = (vendor: PriceVendor): boolean => vendor.limits.perDay !== null && vendor.limits.perDay < SCARCE_DAILY_LIMIT

  return {
    canSearch: () => askable().length > 0,
    async search(text) {
      const found: FoundBy[] = []
      const failures: SearchFailure[] = []
      const ask = async (asked: readonly { readonly vendor: Searching; readonly key: string | null }[]): Promise<void> => {
        const answers = await Promise.all(asked.map(({ vendor, key }) => vendor.search(fetchOf(vendor), key, text)))
        answers.forEach((answer, place) => {
          const { vendor } = asked[place]!
          if (answer.kind === 'failed') {
            failures.push({ vendor: vendor.name, reason: answer.reason })
          } else {
            found.push(...answer.listings.map((listing) => ({ ...listing, vendor })))
          }
        })
      }
      const vendorsNow = askable()
      await ask(vendorsNow.filter(({ vendor }) => !scarce(vendor)))
      if (found.length === 0) {
        await ask(vendorsNow.filter(({ vendor }) => scarce(vendor)))
      }
      return { listings: merged(found), failures }
    },
  }
}
