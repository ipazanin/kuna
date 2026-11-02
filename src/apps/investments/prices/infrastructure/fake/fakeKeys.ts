import type { VendorKeyChanges } from '../../domain/keysFile'

/**
 * The keys file another browser left in the app's hidden folder: `other-browser` holds a made-up Twelve Data key it saved
 * at 10:00, and `removed` the Twelve Data key it removed at 10:05, which outdates a key this browser saved at 10:00.
 */
export type FakeKeysVariant = 'other-browser' | 'removed'

export const FAKE_KEY_SAVED_AT = '2026-10-30T10:00:00.000Z'

const FAKE_KEYS: Readonly<Record<FakeKeysVariant, VendorKeyChanges>> = {
  'other-browser': { twelvedata: { key: 'made-up-twelve-data-key-8642', changedAt: FAKE_KEY_SAVED_AT } },
  removed: { twelvedata: { key: null, changedAt: '2026-10-30T10:05:00.000Z' } },
}

export function isFakeKeysVariant(variant: string | null): variant is FakeKeysVariant {
  return variant === 'other-browser' || variant === 'removed'
}

export function fakeKeys(variant: FakeKeysVariant): VendorKeyChanges {
  return FAKE_KEYS[variant]
}
