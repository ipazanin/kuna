import { readonly, ref } from 'vue'
import type { Ref } from 'vue'

import { keepSecretChanges, storeSecret, storedSecret } from '../infrastructure/browserSecrets'
import type { SecretChanges } from '../domain/secretsFile'
import type { SecretStore } from './useSecretRows'

/** Bumped whenever this page changes a secret in this browser, by a card or by a sync, so what shows the keys reads them again. */
const changed = ref(0)

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

/** Counts each change of a secret on this page, for what shows the keys to read them again. */
export function useSecretsChanged(): Readonly<Ref<number>> {
  return readonly(changed)
}
