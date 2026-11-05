import { createSplitLookup } from '../application/splitLookup'
import type { SplitLookup } from '../application/splitLookup'
import { storedSecret } from '../../../../shared/secrets/infrastructure/browserSecrets'
import { alphaVantage } from '../infrastructure/vendors/alphaVantage'
import { pagePause, pageVendorFetch } from './usePrices'

const lookup = createSplitLookup(alphaVantage, { fetch: pageVendorFetch, pause: pagePause, key: storedSecret })

/** The page's one lookup of splits, which the fake build answers with its made-up vendor. */
export function useSplitLookup(): SplitLookup {
  return lookup
}
