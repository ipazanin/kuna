import { BEFORE_ANY_CHANGE, isChangeTime } from '../domain/keysFile'
import type { VendorKeyChange, VendorKeyChanges } from '../domain/keysFile'

/** Each vendor's key is kept in this browser under a key of its own, and when it was last saved or removed under another. */
const KEY_PREFIX = 'kuna.price-vendor-key.'
const CHANGED_PREFIX = 'kuna.price-vendor-key-changed.'

/** The vendor's key on this device, or null when none is kept or storage is denied. */
export function storedVendorKey(vendorId: string): string | null {
  const stored = read(`${KEY_PREFIX}${vendorId}`)?.trim() ?? ''
  return stored === '' ? null : stored
}

/** Keeps the key on this device, and an empty key or null forgets it. Either way it notes the time, so a removal outdates an older save in another browser. */
export function storeVendorKey(vendorId: string, key: string | null, at: string): void {
  const kept = key?.trim() ?? ''
  keepKeyChanges({ [vendorId]: { key: kept === '' ? null : kept, changedAt: at } })
}

/**
 * This browser's last change of each of these vendors' keys. A key kept before keys carried a time, or with a time the
 * keys file does not take, counts as older than any change.
 */
export function storedKeyChanges(vendorIds: readonly string[]): VendorKeyChanges {
  return Object.fromEntries(
    vendorIds.flatMap((vendorId): [string, VendorKeyChange][] => {
      const key = storedVendorKey(vendorId)
      const stored = read(`${CHANGED_PREFIX}${vendorId}`)
      const changedAt = stored !== null && isChangeTime(stored) ? stored : null
      if (key === null && changedAt === null) {
        return []
      }
      return [[vendorId, { key, changedAt: changedAt ?? BEFORE_ANY_CHANGE }]]
    }),
  )
}

/** Keeps each change as it is, its time too. */
export function keepKeyChanges(changes: VendorKeyChanges): void {
  try {
    for (const [vendorId, change] of Object.entries(changes)) {
      if (change.key === null) {
        localStorage.removeItem(`${KEY_PREFIX}${vendorId}`)
      } else {
        localStorage.setItem(`${KEY_PREFIX}${vendorId}`, change.key)
      }
      localStorage.setItem(`${CHANGED_PREFIX}${vendorId}`, change.changedAt)
    }
  } catch {
    // Storage can be denied in a private window, and then no key is kept.
  }
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
