/** Each vendor's key is kept in this browser only, under a key of its own, and never in a Drive file. */
const KEY_PREFIX = 'kuna.price-vendor-key.'

/** The vendor's key on this device, or null when none is kept or storage is denied. */
export function storedVendorKey(vendorId: string): string | null {
  try {
    const stored = localStorage.getItem(`${KEY_PREFIX}${vendorId}`)?.trim() ?? ''
    return stored === '' ? null : stored
  } catch {
    return null
  }
}

/** Keeps the key on this device, and an empty key or null forgets it. */
export function storeVendorKey(vendorId: string, key: string | null): void {
  const kept = key?.trim() ?? ''
  try {
    if (kept === '') {
      localStorage.removeItem(`${KEY_PREFIX}${vendorId}`)
    } else {
      localStorage.setItem(`${KEY_PREFIX}${vendorId}`, kept)
    }
  } catch {
    // Storage can be denied in a private window, and then no key is kept.
  }
}
