import { watch } from 'vue'

import { createPricesUpdate } from '../application/pricesUpdate'
import type { PricesUpdate } from '../application/pricesUpdate'
import type { PricesCache, PricesDrive } from '../application/pricesPorts'
import type { VendorFetch } from '../application/priceVendor'
import { exclusivelyInBrowser } from '../infrastructure/browserLock'
import { browserFetch, browserPause } from '../infrastructure/browserPricePorts'
import { googlePricesDrive } from '../infrastructure/googlePricesDrive'
import { openPricesCache } from '../infrastructure/pricesCache'
import { storedVendorKey } from '../infrastructure/vendorKeys'
import { PRICE_VENDORS } from '../infrastructure/vendors/priceVendors'
import { useInvestmentsBooks } from '../../workbook/application/investmentsStore'
import { fetchInBackground, pricesStep } from './pricesStep'

const store = useInvestmentsBooks()
const caches = new Map<string, PricesCache>()

function cacheOf(investmentsFileId: string): PricesCache {
  const cache = caches.get(investmentsFileId) ?? openPricesCache(investmentsFileId)
  caches.set(investmentsFileId, cache)
  return cache
}

async function pricesDrive(): Promise<PricesDrive> {
  // Inline, not hoisted into a constant, so a production build folds it away with the fixture.
  if (import.meta.env.VITE_FAKE_WORKBOOK === 'true') {
    const { fakePricesDrive } = await import('../infrastructure/fake/fakePricesDrive')
    return fakePricesDrive()
  }
  return googlePricesDrive()
}

async function vendorFetch(): Promise<VendorFetch> {
  // Inline, not hoisted into a constant, so a production build folds it away with the fixture.
  if (import.meta.env.VITE_FAKE_WORKBOOK === 'true') {
    const { fakeVendorFetch } = await import('../infrastructure/fake/fakeVendorAnswers')
    return fakeVendorFetch
  }
  return browserFetch
}

/** Every vendor request of the page, which the fake build answers itself. */
export const pageVendorFetch: VendorFetch = async (url) => (await vendorFetch())(url)

const prices: PricesUpdate = createPricesUpdate({
  async place() {
    const choice = store.state.choice
    if (choice === null) {
      return null
    }
    return { investmentsFileId: choice.id, cache: cacheOf(choice.id), drive: choice.source === 'drive' ? await pricesDrive() : null }
  },
  investments: () => store.state.workbook?.book ?? null,
  vendors: PRICE_VENDORS,
  fetch: pageVendorFetch,
  pause: browserPause,
  key: storedVendorKey,
  exclusively: exclusivelyInBrowser,
  now: () => new Date().toISOString(),
  newRevision: () => `browser-${crypto.randomUUID()}`,
})

/** The page's one prices update, over the Investments file on screen. */
export function usePrices(): PricesUpdate {
  return prices
}

/** The Prices step of the Investments sync. */
export const PRICES_STEP = pricesStep(prices)

/** Forgets the copy of the prices of an Investments file this browser no longer shows, which would otherwise keep the list of its holdings. */
async function forgetCopy(investmentsFileId: string): Promise<void> {
  const cache = cacheOf(investmentsFileId)
  caches.delete(investmentsFileId)
  await cache.delete()
}

/**
 * Shows the prices of each Investments file as it comes on screen and forgets the copy of one that leaves it. A file
 * kept in this browser has no sync, so the day's fetch starts once its records are read. Every return to the page
 * checks the day again, which a tab left open past midnight or a Drive file with auto sync off would otherwise miss.
 * Returns the function that stops it.
 */
export function startPrices(): () => void {
  const stopOpening = watch(
    () => store.state.choice?.id ?? null,
    (shown, left) => {
      prices.open().catch(() => {
        // Without the copy the screens show no prices until the next sync reads the file.
      })
      if (left !== undefined && left !== null && left !== shown) {
        forgetCopy(left).catch(() => {
          // A copy that stays is read again, or replaced, when its file comes back on screen.
        })
      }
    },
    { immediate: true },
  )
  const stopFetching = watch(
    () => store.state.choice?.source === 'browser' && store.state.workbook !== null,
    (ready) => {
      if (ready) fetchInBackground(prices)
    },
    { immediate: true },
  )
  const onReturn = (): void => {
    if (document.visibilityState === 'visible' && store.state.workbook !== null) fetchInBackground(prices)
  }
  document.addEventListener('visibilitychange', onReturn)
  return () => {
    stopOpening()
    stopFetching()
    document.removeEventListener('visibilitychange', onReturn)
  }
}
