import { ref, watch } from 'vue'

import { createPricesUpdate } from '../application/pricesUpdate'
import type { PricesUpdate } from '../application/pricesUpdate'
import type { PricesCache, PricesDrive } from '../application/pricesPorts'
import type { VendorFetch } from '../application/priceVendor'
import { exclusivelyInBrowser } from '../infrastructure/browserLock'
import { browserFetch, browserPause } from '../infrastructure/browserPricePorts'
import { googlePricesDrive } from '../infrastructure/googlePricesDrive'
import { openPricesCache } from '../infrastructure/pricesCache'
import { storedVendorKey } from '../infrastructure/vendorKeys'
import { countRequest, requestsToday } from '../infrastructure/vendorUsage'
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

/** The page's Drive for the prices file, the fake one in the fake build. */
export async function pagePricesDrive(): Promise<PricesDrive> {
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

/** Bumped with each request, so the Prices settings read this browser's counts again. */
const counted = ref(0)

/** Every vendor request of the page, which the fake build answers itself, counted against its vendor's day. */
export const pageVendorFetch: VendorFetch = async (url) => {
  const vendor = PRICE_VENDORS.find((candidate) => url.startsWith(candidate.origin))
  if (vendor !== undefined) {
    countRequest(vendor.id, new Date())
    counted.value += 1
  }
  return (await vendorFetch())(url)
}

/** This browser's requests to the vendor today, which updates as the page sends more. */
export function useRequestsToday(): (vendorId: string) => number {
  return (vendorId) => {
    void counted.value
    return requestsToday(vendorId, new Date())
  }
}

/** The fake build waits a tenth of each pause, so its fetch shows a vendor's pause without holding a check for a minute. */
export async function pagePause(milliseconds: number): Promise<void> {
  // Inline, not hoisted into a constant, so a production build folds it away with the fixture.
  if (import.meta.env.VITE_FAKE_WORKBOOK === 'true') {
    return browserPause(milliseconds / 10)
  }
  return browserPause(milliseconds)
}

const prices: PricesUpdate = createPricesUpdate({
  async place() {
    const choice = store.state.choice
    // A file in the bin or gone has no prices to read or fetch, which would otherwise make a new prices file beside it.
    if (choice === null || store.state.missing) {
      return null
    }
    return { investmentsFileId: choice.id, cache: cacheOf(choice.id), drive: choice.source === 'drive' ? await pagePricesDrive() : null }
  },
  investments: () => store.state.workbook?.book ?? null,
  vendors: PRICE_VENDORS,
  fetch: pageVendorFetch,
  pause: pagePause,
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
export const PRICES_STEP = pricesStep(prices, () => store.state.workbook?.book ?? null)

/** Forgets the copy of the prices of an Investments file this browser no longer shows, which would otherwise keep the list of its holdings. */
export async function forgetPricesCopy(investmentsFileId: string): Promise<void> {
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
      // None follows only a removal, which deletes the copy itself and reports how that went.
      if (left !== undefined && left !== null && shown !== null && left !== shown) {
        forgetPricesCopy(left).catch(() => {
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
