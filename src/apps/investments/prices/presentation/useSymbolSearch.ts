import { createSymbolSearch } from '../application/symbolSearch'
import type { SymbolSearch } from '../application/symbolSearch'
import { storedSecret } from '../../../../shared/secrets/infrastructure/browserSecrets'
import { PRICE_VENDORS } from '../infrastructure/vendors/priceVendors'
import { pagePause, pageVendorFetch } from './usePrices'

const search = createSymbolSearch(PRICE_VENDORS, { fetch: pageVendorFetch, pause: pagePause, key: storedSecret })

/** The page's one search of listings, which the fake build answers with its made-up vendors. */
export function useSymbolSearch(): SymbolSearch {
  return search
}
