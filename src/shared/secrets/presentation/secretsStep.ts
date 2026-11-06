import { deleteSecretsFiles, syncSecrets } from '../application/secretsSync'
import type { SecretsSyncResult } from '../application/secretsSync'
import type { SecretsDrive } from '../application/secretsDrive'
import { allowHiddenFolder, googleSecretsDrive } from '../infrastructure/googleSecretsDrive'
import { storedSecretChanges } from '../infrastructure/browserSecrets'
import type { SyncStep } from '../../sync/application/sync'
import type { AccessNeed } from '../../sync/application/syncRun'
import { KUNA_SETTINGS_ROUTE, keepSyncedSecrets, useSecretsChanged } from './pageSecrets'
import { SECRETS_STEP } from '../../sync/application/syncSteps'
import { words } from './words'

/** Whether this browser saved or removed some secret, reactively, which the sync then carries. */
function secretsHeldHere(): boolean {
  void useSecretsChanged().value
  return Object.keys(storedSecretChanges()).length > 0
}

/** The page's Drive for the secrets file in the app's hidden folder, the fake one in the fake build. */
async function pageSecretsDrive(): Promise<SecretsDrive> {
  // Inline, not hoisted into a constant, so a production build folds it away with the fixture.
  if (import.meta.env.VITE_FAKE_WORKBOOK === 'true') {
    const { fakeSecretsDrive } = await import('../infrastructure/fake/fakeSecretsDrive')
    return fakeSecretsDrive()
  }
  return googleSecretsDrive()
}

/** The run the secrets last synced in, by its start, so a later group of that run does not reach Drive again. A failed or refused sync marks no run. */
let servedRun: string | null = null

async function syncHere(): Promise<SecretsSyncResult> {
  return syncSecrets({
    drive: await pageSecretsDrive(),
    here: storedSecretChanges,
    keep: keepSyncedSecrets,
  })
}

/**
 * The Keys step an app's sync group lists after its books, on while `wanted` holds or this browser saved or removed a
 * secret. Every app that keeps a secret lists it, and in one run only the first group's step reaches Drive.
 */
export function secretsStep(wanted: () => boolean): SyncStep {
  return {
    id: SECRETS_STEP,
    label: words.step.label,
    scopes: () => ['drive.appdata'],
    startLine: words.step.reading,
    offLine: words.step.off,
    on: () => wanted() || secretsHeldHere(),
    async run(_report, startedAt) {
      if (servedRun === startedAt) {
        return { kind: 'done', line: words.step.unchanged, writeId: null, link: null }
      }
      const result = await syncHere()
      if (result.kind === 'refused') {
        return { kind: 'failed', line: words.refused[result.reason], link: { label: words.step.settings, to: KUNA_SETTINGS_ROUTE } }
      }
      servedRun = startedAt
      return { kind: 'done', line: words.step[result.kind], writeId: null, link: null }
    },
  }
}

/**
 * Deletes every file that holds keys in the Google account, asking Google for the hidden folder in this tap when the page
 * lacks it. This browser's keys stay, and a later sync saves them again. Call it first in a click handler.
 */
export async function deleteKeysFromGoogle(): Promise<void> {
  await allowHiddenFolder()
  await deleteSecretsFiles(await pageSecretsDrive())
}

/**
 * Runs one sync of the secrets for a browser that holds no key yet. It asks Google for the hidden folder before anything
 * else, as a browser opens Google's window only during the tap, then waits for `settled`, the sync under way. Returns why
 * the file was left as it is, or null. Call it first in a click handler.
 */
export async function fetchKeysFromGoogle(settled: () => Promise<void>): Promise<string | null> {
  await allowHiddenFolder()
  await settled()
  const result = await syncHere()
  return result.kind === 'refused' ? words.refused[result.reason] : null
}

/** What an app's file on Drive needs of Google for the secrets, by the step that needs it. */
export function secretsNeeds(wanted: () => boolean): AccessNeed[] {
  return wanted() || secretsHeldHere() ? [{ scope: 'drive.appdata', label: words.step.label }] : []
}
