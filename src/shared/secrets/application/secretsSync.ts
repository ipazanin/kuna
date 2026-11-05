import type { HiddenFile, SecretsDrive } from './secretsDrive'
import { SECRETS_FILE_NAME, decodeSecretsFile, encodeSecretsFile, isOldKeysFileName, newestSecrets, sameSecrets } from '../domain/secretsFile'
import type { SecretChanges, SecretsFileRefusal } from '../domain/secretsFile'

export interface SecretsSyncPorts {
  readonly drive: SecretsDrive
  /** This browser's secrets, each with when it was last saved or removed. */
  here(): SecretChanges
  /** Keeps these in this browser with their times, as the newer changes from the files. */
  keep(changes: SecretChanges): void
}

/**
 * What the sync of the secrets did: nothing to change, this browser's newer changes saved to the file, the file's newer
 * changes taken into this browser, whether or not some went the other way too, or a file Kuna leaves as it is.
 */
export type SecretsSyncResult = { readonly kind: 'unchanged' | 'sent' | 'received' } | { readonly kind: 'refused'; readonly reason: SecretsFileRefusal }

/**
 * Merges this browser's secrets with the secrets file, the newer change of each id winning, a removal as much as a save.
 * The file is made only once there is a key or a removal to keep in it. Every other file that holds secrets folds in by
 * the same rule: a second secrets file two browsers made at once, and each old keys file of an Investments file. Those
 * are deleted only once the secrets file holds what they held. A file Kuna cannot read stops the sync before anything is
 * written or deleted.
 */
export async function syncSecrets(ports: SecretsSyncPorts): Promise<SecretsSyncResult> {
  const held = [...(await ports.drive.files())].filter((file) => file.name === SECRETS_FILE_NAME || isOldKeysFileName(file.name)).sort(byId)
  const primary = held.find((file) => file.name === SECRETS_FILE_NAME)
  const others = held.filter((file) => file !== primary)
  const reads = await Promise.all([primary, ...others].map(async (file) => (file === undefined ? { kind: 'read' as const, changes: {} } : decodeSecretsFile(await ports.drive.download(file.id)))))
  const refused = reads.find((read) => read.kind === 'refused')
  if (refused !== undefined) {
    return refused
  }
  const [inPrimary, ...inOthers] = reads.map((read) => (read.kind === 'read' ? read.changes : {}))
  // The secrets file wins a tie with an old file, as a file wins a tie with this browser.
  const inFiles = inOthers.reduce((merged, changes) => newestSecrets(changes, merged), inPrimary!)
  const newest = newestSecrets(ports.here(), inFiles)
  const sent = !sameSecrets(newest, inPrimary!)
  if (sent) {
    const text = encodeSecretsFile(newest)
    await (primary === undefined ? ports.drive.createFile(SECRETS_FILE_NAME, text) : ports.drive.overwrite(primary.id, text))
  }
  for (const other of others) {
    try {
      await ports.drive.delete(other.id)
    } catch {
      // The secrets file already holds what this one held, so the next sync folds it in again and deletes it then.
    }
  }
  // Read again after the write, so a key saved or removed on a card meanwhile is newer and stays.
  const hereNow = ports.here()
  const kept = newestSecrets(hereNow, newest)
  if (!sameSecrets(kept, hereNow)) {
    ports.keep(kept)
    return { kind: 'received' }
  }
  return { kind: sent ? 'sent' : 'unchanged' }
}

/** Deletes the secrets file and every old keys file, read or not, so a file the sync refuses can be cleared. Other files in the hidden folder stay. */
export async function deleteSecretsFiles(drive: SecretsDrive): Promise<void> {
  for (const file of await drive.files()) {
    if (file.name === SECRETS_FILE_NAME || isOldKeysFileName(file.name)) {
      await drive.delete(file.id)
    }
  }
}

function byId(left: HiddenFile, right: HiddenFile): number {
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0
}
