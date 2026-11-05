import type { SecretChanges } from '../../domain/secretsFile'

/**
 * What another browser left in the app's hidden folder. `other-browser` is a secrets file with a made-up Twelve Data key
 * saved at 10:00, and `removed` one with that key removed at 10:05, which outdates a key this browser saved at 10:00.
 * `legacy` is only the old keys file of the Investments file, with a made-up Twelve Data key saved at 10:00, and
 * `legacy-and-new` both files: the secrets file with that key at 10:00, and the old file with a newer one at 10:05 and a
 * made-up Finnhub key at 09:00.
 */
export type FakeSecretsVariant = 'other-browser' | 'removed' | 'legacy' | 'legacy-and-new'

export const FAKE_KEY_SAVED_AT = '2026-10-30T10:00:00.000Z'
const FAKE_LEGACY_KEY = 'made-up-twelve-data-key-5307'

const OTHER_BROWSER: SecretChanges = { twelvedata: { key: 'made-up-twelve-data-key-8642', changedAt: FAKE_KEY_SAVED_AT } }

/** The secrets file and the old keys file of each variant, null where the variant has none. */
const FAKE_SECRETS: Readonly<Record<FakeSecretsVariant, { readonly secrets: SecretChanges | null; readonly old: SecretChanges | null }>> = {
  'other-browser': { secrets: OTHER_BROWSER, old: null },
  removed: { secrets: { twelvedata: { key: null, changedAt: '2026-10-30T10:05:00.000Z' } }, old: null },
  legacy: { secrets: null, old: { twelvedata: { key: FAKE_LEGACY_KEY, changedAt: FAKE_KEY_SAVED_AT } } },
  'legacy-and-new': {
    secrets: OTHER_BROWSER,
    old: { twelvedata: { key: FAKE_LEGACY_KEY, changedAt: '2026-10-30T10:05:00.000Z' }, finnhub: { key: 'made-up-finnhub-key-7720', changedAt: '2026-10-30T09:00:00.000Z' } },
  },
}

export function isFakeSecretsVariant(variant: string | null): variant is FakeSecretsVariant {
  return variant !== null && Object.hasOwn(FAKE_SECRETS, variant)
}

export function fakeSecrets(variant: FakeSecretsVariant): { readonly secrets: SecretChanges | null; readonly old: SecretChanges | null } {
  return FAKE_SECRETS[variant]
}
