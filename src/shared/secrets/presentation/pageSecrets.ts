import { readonly, ref } from 'vue'
import type { Ref } from 'vue'

import { forgetBrowserSecrets, keepSecretChanges, namesSecret, storeSecret, storedSecret } from '../infrastructure/browserSecrets'
import type { SecretChanges } from '../domain/secretsFile'
import type { SecretStore } from './useSecretRows'

/** Kuna settings, where the assistant's key is kept and where the refusal of a secrets file leads. */
export const KUNA_SETTINGS_ROUTE = '/settings'

/** Bumped whenever a secret changes in this browser, by a card, by a sync or in another tab, so what shows the keys reads them again. */
const changed = ref(0)

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === null || namesSecret(event.key)) changed.value += 1
  })
}

/** The secrets every card saves and removes in this browser, each with the time of the change. */
export const PAGE_SECRET_STORE: SecretStore = {
  read: storedSecret,
  write(id, key) {
    storeSecret(id, key, new Date().toISOString())
    changed.value += 1
  },
}

/** Keeps what a sync brought in this browser. */
export function keepSyncedSecrets(changes: SecretChanges): void {
  keepSecretChanges(changes)
  changed.value += 1
}

/** Forgets every key kept in this browser. */
export function forgetKeysHere(): void {
  forgetBrowserSecrets()
  changed.value += 1
}

/** Counts each change of a secret on this page, for what shows the keys to read them again. */
export function useSecretsChanged(): Readonly<Ref<number>> {
  return readonly(changed)
}
