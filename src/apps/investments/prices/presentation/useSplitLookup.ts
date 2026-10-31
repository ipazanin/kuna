import { createSplitLookup } from '../application/splitLookup'
import type { SplitLookup } from '../application/splitLookup'
import { browserPause } from '../infrastructure/browserPricePorts'
import { storedVendorKey } from '../infrastructure/vendorKeys'
import { alphaVantage } from '../infrastructure/vendors/alphaVantage'
import { pageVendorFetch } from './usePrices'

const lookup = createSplitLookup(alphaVantage, { fetch: pageVendorFetch, pause: browserPause, key: storedVendorKey })

/** The page's one lookup of splits, which the fake build answers with its made-up vendor. */
export function useSplitLookup(): SplitLookup {
  return lookup
}
