/**
 * What this browser keeps for the person using it, such as the sidebar's layout or the last account, each under a key of
 * its own in the site's local storage. Storage can be denied, as in some private windows, and then every read gives the
 * default and a write says it was not kept, so the choice holds only for the visit.
 */

/** How a choice reads from the text kept under its key and writes back to it. */
export interface ChoiceCodec<T> {
  /** The choice the kept text holds, or null when it holds none, which reads as the default. */
  readonly read: (kept: string) => T | null
  /** The text that keeps the choice, or null to forget it. */
  readonly write: (choice: T) => string | null
}

/** A choice kept on this device under one key. */
export interface DeviceChoice<T> {
  /** The kept choice, or the default when none is kept, it does not read, or storage is denied. */
  read(): T
  /** Keeps the choice, and the default forgets it. False when storage denied the write. */
  remember(choice: T): boolean
}

export function deviceChoice<T>(key: string, fallback: T, codec: ChoiceCodec<T>): DeviceChoice<T> {
  return {
    read: () => {
      try {
        const kept = localStorage.getItem(key)
        return kept === null ? fallback : (codec.read(kept) ?? fallback)
      } catch {
        return fallback
      }
    },
    remember: (choice) => {
      try {
        const text = choice === fallback ? null : codec.write(choice)
        if (text === null) localStorage.removeItem(key)
        else localStorage.setItem(key, text)
        return true
      } catch {
        return false
      }
    },
  }
}

const AS_TEXT: ChoiceCodec<string | null> = { read: (kept) => kept, write: (text) => text }

/** The text kept under the key, or null when none is kept. */
export function deviceText(key: string): DeviceChoice<string | null> {
  return deviceChoice(key, null, AS_TEXT)
}

/** A choice kept as JSON, which `shape` reads back from what parses, or gives null for what it does not take. */
export function jsonChoice<T>(key: string, shape: (parsed: unknown) => T | null): DeviceChoice<T | null> {
  return deviceChoice<T | null>(key, null, { read: (kept) => shape(JSON.parse(kept)), write: (choice) => JSON.stringify(choice) })
}

/** The keys this device keeps that start with the prefix, or none when storage is denied. */
export function keptKeys(prefix: string): readonly string[] {
  try {
    return Object.keys(localStorage).filter((key) => key.startsWith(prefix))
  } catch {
    return []
  }
}

/** Tells `changed` when another tab keeps or forgets a choice, with its key and its new text, or a null key when that tab cleared the site's storage. */
export function onChoiceKeptElsewhere(changed: (key: string | null, kept: string | null) => void): void {
  if (typeof window === 'undefined') return
  window.addEventListener('storage', (event) => {
    if (isDeviceStorage(event.storageArea)) changed(event.key, event.newValue)
  })
}

function isDeviceStorage(area: Storage | null): boolean {
  try {
    return area === localStorage
  } catch {
    return false
  }
}
