import { BEFORE_ANY_CHANGE, isChangeTime } from '../domain/secretsFile'
import type { SecretChange, SecretChanges } from '../domain/secretsFile'

/** Each secret is kept in this browser under a key of its own, and when it was last saved or removed under another. */
const KEY_PREFIX = 'kuna.secret.'
const CHANGED_PREFIX = 'kuna.secret-changed.'
/** Where this browser kept the price vendor keys before one store held every secret. */
const OLD_KEY_PREFIX = 'kuna.price-vendor-key.'
const OLD_CHANGED_PREFIX = 'kuna.price-vendor-key-changed.'

/** The secret on this device, or null when none is kept or storage is denied. */
export function storedSecret(id: string): string | null {
  return keyIn(read(`${KEY_PREFIX}${id}`))
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
      const change = changeIn(read(`${KEY_PREFIX}${id}`), read(`${CHANGED_PREFIX}${id}`))
      return change === null ? [] : [[id, change]]
    }),
  )
}

/** Whether a name in this browser's storage holds a secret or the time of its last change. */
export function namesSecret(name: string): boolean {
  return name.startsWith(KEY_PREFIX) || name.startsWith(CHANGED_PREFIX)
}

/** Keeps each change as it is, its time too. */
export function keepSecretChanges(changes: SecretChanges): void {
  try {
    for (const [id, change] of Object.entries(changes)) {
      write(id, change)
    }
  } catch {
    // Storage can be denied in a private window, and then no key is kept.
  }
}

/**
 * Moves each price vendor key this browser kept under its old name to the secrets' names, with its time, unless the new
 * name already holds a newer change. The old pair is removed only after the new one is written. Denied storage leaves
 * everything as it is.
 */
export function moveBrowserSecrets(): void {
  try {
    for (const id of idsUnder(OLD_KEY_PREFIX, OLD_CHANGED_PREFIX)) {
      const old = changeIn(localStorage.getItem(`${OLD_KEY_PREFIX}${id}`), localStorage.getItem(`${OLD_CHANGED_PREFIX}${id}`))
      const current = changeIn(localStorage.getItem(`${KEY_PREFIX}${id}`), localStorage.getItem(`${CHANGED_PREFIX}${id}`))
      if (old !== null && (current === null || current.changedAt <= old.changedAt)) {
        write(id, old)
      }
      localStorage.removeItem(`${OLD_KEY_PREFIX}${id}`)
      localStorage.removeItem(`${OLD_CHANGED_PREFIX}${id}`)
    }
  } catch {
    // Storage denied or full: what is not moved stays under its old name, and the next start moves it.
  }
}

/** Writes one change, and throws what storage throws. */
function write(id: string, change: SecretChange): void {
  if (change.key === null) {
    localStorage.removeItem(`${KEY_PREFIX}${id}`)
  } else {
    localStorage.setItem(`${KEY_PREFIX}${id}`, change.key)
  }
  localStorage.setItem(`${CHANGED_PREFIX}${id}`, change.changedAt)
}

/** A stored key and time as a change, or null when neither is kept. */
function changeIn(storedKey: string | null, storedTime: string | null): SecretChange | null {
  const key = keyIn(storedKey)
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
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const name = localStorage.key(index) ?? ''
      const prefix = [keyPrefix, changedPrefix].find((candidate) => name.startsWith(candidate))
      if (prefix !== undefined) ids.add(name.slice(prefix.length))
    }
  } catch {
    // Storage denied: this browser keeps no secret.
  }
  return [...ids].sort()
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
