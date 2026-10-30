import { reactive } from 'vue'

import type { PriceVendor } from '../application/priceVendor'
import type { VendorTest } from '../application/vendorTest'

/** Where the keys are kept: this browser's storage, which keeps a trimmed key and forgets on null. */
export interface VendorKeyStore {
  read(vendorId: string): string | null
  write(vendorId: string, key: string | null): void
}

/** How a kept key shows: never whole, and only a long one with its last four characters, which a person can match against the vendor's page. */
export function keyEnding(key: string): string | null {
  return key.length >= 12 ? key.slice(-4) : null
}

/** What one vendor's row shows of its key: whether one is kept and how it ends, and the last Test. */
export interface VendorKeyRow {
  readonly kept: boolean
  readonly ending: string | null
  readonly test: VendorTest | 'testing' | null
}

export interface VendorKeys {
  readonly rows: Readonly<Record<string, VendorKeyRow>>
  /** Keeps the typed key, and says whether there was one to keep. */
  save(vendorId: string, typed: string): boolean
  forget(vendorId: string): void
  /** One cheap request with the key kept for the vendor, or with none for a vendor that needs none. */
  test(vendor: PriceVendor): Promise<void>
}

/** The key rows of the Prices card. A key goes into the store only through `save` and is never read back whole onto the screen. */
export function useVendorKeys(vendors: readonly PriceVendor[], store: VendorKeyStore, request: (vendor: PriceVendor, key: string | null) => Promise<VendorTest>): VendorKeys {
  const rowOf = (vendorId: string, test: VendorKeyRow['test'] = null): VendorKeyRow => {
    const key = store.read(vendorId)
    return { kept: key !== null, ending: key === null ? null : keyEnding(key), test }
  }
  const rows = reactive<Record<string, VendorKeyRow>>(Object.fromEntries(vendors.map((vendor) => [vendor.id, rowOf(vendor.id)])))

  return {
    rows,
    save(vendorId, typed) {
      if (typed.trim() === '') {
        return false
      }
      store.write(vendorId, typed)
      const row = rowOf(vendorId)
      rows[vendorId] = row
      return row.kept
    },
    forget(vendorId) {
      store.write(vendorId, null)
      rows[vendorId] = rowOf(vendorId)
    },
    async test(vendor) {
      rows[vendor.id] = { ...rows[vendor.id]!, test: 'testing' }
      const result = await request(vendor, vendor.needsKey ? store.read(vendor.id) : null)
      rows[vendor.id] = rowOf(vendor.id, result)
    },
  }
}
