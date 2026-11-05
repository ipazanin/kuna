import { SECRETS_FILE_NAME, encodeSecretsFile } from '../../domain/secretsFile'
import type { SecretChanges } from '../../domain/secretsFile'
import { APP_DATA_FOLDER } from '../../../google/driveClient'
import { fakeDriveSession } from '../../../storage/infrastructure/fake/fakeDriveSession'
import { fakeSecrets, isFakeSecretsVariant } from './fakeSecrets'

/** The old keys file's format, which Kuna wrote for one Investments file before the secrets file. */
function encodeOldKeysFile(changes: SecretChanges): string {
  const keys = Object.fromEntries(Object.entries(changes).map(([id, change]) => [id, { key: change.key, changed_at: change.changedAt }]))
  return `${JSON.stringify({ format: 'kuna-vendor-keys', version: 1, keys }, null, 2)}\n`
}

/**
 * Puts what another browser left in the app's hidden folder on the fake Drive, as `?keys=` names it, the old keys file
 * named after the Investments file `investmentsFileId`. Says whether it put anything there. Also lets a check list the
 * hidden folder's file names through `window.kunaFakeHiddenFiles()`, since the fake Drive lives only in the page.
 */
export async function seedFakeSecrets(variant: string | null, investmentsFileId: string): Promise<boolean> {
  const drive = fakeDriveSession()
  ;(window as unknown as { kunaFakeHiddenFiles: () => Promise<string[]> }).kunaFakeHiddenFiles = async () => (await drive.children(APP_DATA_FOLDER)).map((entry) => entry.name).sort()
  if (!isFakeSecretsVariant(variant)) {
    return false
  }
  const { secrets, old } = fakeSecrets(variant)
  if (secrets !== null) {
    await drive.createFile(APP_DATA_FOLDER, SECRETS_FILE_NAME, encodeSecretsFile(secrets))
  }
  if (old !== null) {
    await drive.createFile(APP_DATA_FOLDER, `kuna-investments-keys-${investmentsFileId}.json`, encodeOldKeysFile(old))
  }
  return true
}
