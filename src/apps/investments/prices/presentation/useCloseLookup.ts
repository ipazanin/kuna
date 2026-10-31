import { createCloseLookup } from '../application/closeLookup'
import type { CloseLookup } from '../application/closeLookup'
import { storedVendorKey } from '../infrastructure/vendorKeys'
import { PRICE_VENDORS } from '../infrastructure/vendors/priceVendors'
import { pagePause, pageVendorFetch } from './usePrices'

const lookup = createCloseLookup(PRICE_VENDORS, { fetch: pageVendorFetch, pause: pagePause, key: storedVendorKey })

/** The page's one lookup of closes outside the prices fetch, which the fake build answers with its made-up vendors. */
export function useCloseLookup(): CloseLookup {
  return lookup
}
