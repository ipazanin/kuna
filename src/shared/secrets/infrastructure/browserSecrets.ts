import { BEFORE_ANY_CHANGE, isChangeTime } from '../domain/secretsFile'
import type { SecretChange, SecretChanges } from '../domain/secretsFile'
import { deviceText, keptKeys } from '../../device/deviceChoice'

/** Each secret is kept in this browser under a key of its own, and when it was last saved or removed under another. */
const KEY_PREFIX = 'kuna.secret.'
const CHANGED_PREFIX = 'kuna.secret-changed.'
/** Where this browser kept the price vendor keys before one store held every secret. */
const OLD_KEY_PREFIX = 'kuna.price-vendor-key.'
const OLD_CHANGED_PREFIX = 'kuna.price-vendor-key-changed.'

/** The secret on this device, or null when none is kept or storage is denied. */
export function storedSecret(id: string): string | null {
  return keyIn(deviceText(`${KEY_PREFIX}${id}`).read())
}

/** Keeps the key on this device, and an empty key or null forgets it. Either way it notes the time, so a removal outdates an older save in another browser. */
export function storeSecret(id: string, key: string | null, at: string): void {
  keepSecretChanges({ [id]: { key: keyIn(key), changedAt: at } })
}

/**
 * This browser's last change of every secret it holds. A key kept before keys carried a time, or with a time the
 * secrets file does not take, counts as older than any change.
 */
export function storedSecretChanges(): SecretChanges {
  return Object.fromEntries(
    idsUnder(KEY_PREFIX, CHANGED_PREFIX).flatMap((id): [string, SecretChange][] => {
      const change = keptChange(KEY_PREFIX, CHANGED_PREFIX, id)
      return change === null ? [] : [[id, change]]
    }),
  )
}

/** Whether a name in this browser's storage holds a secret or the time of its last change. */
export function namesSecret(name: string): boolean {
  return name.startsWith(KEY_PREFIX) || name.startsWith(CHANGED_PREFIX)
}

/** Forgets every secret here with its time, leaving no removal behind, so a newer or older key elsewhere can still come back by a sync. */
export function forgetBrowserSecrets(): void {
  keptKeys('')
    .filter(namesSecret)
    .forEach((name) => deviceText(name).remember(null))
}

/** Keeps each change as it is, its time too. Storage can be denied in a private window, and then no key is kept. */
export function keepSecretChanges(changes: SecretChanges): void {
  for (const [id, change] of Object.entries(changes)) {
    if (!write(id, change)) return
  }
}

/**
 * Moves each price vendor key this browser kept under its old name to the secrets' names, with its time, unless the new
 * name already holds a newer change. The old pair is removed only after the new one is written. Storage denied or full
 * leaves what is not moved under its old name, and the next start moves it.
 */
export function moveBrowserSecrets(): void {
  for (const id of idsUnder(OLD_KEY_PREFIX, OLD_CHANGED_PREFIX)) {
    const old = keptChange(OLD_KEY_PREFIX, OLD_CHANGED_PREFIX, id)
    const current = keptChange(KEY_PREFIX, CHANGED_PREFIX, id)
    if (old !== null && (current === null || current.changedAt <= old.changedAt) && !write(id, old)) return
    deviceText(`${OLD_KEY_PREFIX}${id}`).remember(null)
    deviceText(`${OLD_CHANGED_PREFIX}${id}`).remember(null)
  }
}

/** Writes one change, and says whether storage took it. */
function write(id: string, change: SecretChange): boolean {
  return deviceText(`${KEY_PREFIX}${id}`).remember(change.key) && deviceText(`${CHANGED_PREFIX}${id}`).remember(change.changedAt)
}

/** The key and time kept for the id under the two prefixes as a change, or null when neither is kept. */
function keptChange(keyPrefix: string, changedPrefix: string, id: string): SecretChange | null {
  const key = keyIn(deviceText(`${keyPrefix}${id}`).read())
  const storedTime = deviceText(`${changedPrefix}${id}`).read()
  const changedAt = storedTime !== null && isChangeTime(storedTime) ? storedTime : null
  return key === null && changedAt === null ? null : { key, changedAt: changedAt ?? BEFORE_ANY_CHANGE }
}

function keyIn(stored: string | null): string | null {
  const kept = stored?.trim() ?? ''
  return kept === '' ? null : kept
}

/** The ids this browser keeps a key or a time for under the two prefixes. */
function idsUnder(keyPrefix: string, changedPrefix: string): string[] {
  const ids = new Set<string>()
  for (const name of keptKeys('')) {
    const prefix = [keyPrefix, changedPrefix].find((candidate) => name.startsWith(candidate))
    if (prefix !== undefined) ids.add(name.slice(prefix.length))
  }
  return [...ids].sort()
}
