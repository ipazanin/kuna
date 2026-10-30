import type { PriceVendor, VendorFetch } from './priceVendor'
import type { FailureReason } from '../domain/pricesFile'
import { addDays } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'

export type VendorTest = { readonly kind: 'works' } | { readonly kind: 'failed'; readonly reason: FailureReason }

/** Asks the vendor once for the last week of its test symbol, with the key, to say whether the key works. */
export async function testVendor(vendor: PriceVendor, fetch: VendorFetch, key: string | null, today: CivilDate): Promise<VendorTest> {
  if (vendor.needsKey && key === null) {
    return { kind: 'failed', reason: 'no-key' }
  }
  const fetched = await vendor.closes(fetch, key, vendor.testSymbol, addDays(today, -7))
  return fetched.kind === 'failed' ? fetched : { kind: 'works' }
}
