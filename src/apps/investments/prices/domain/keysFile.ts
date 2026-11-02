/** One vendor's key as last saved, or null once removed, with when that happened, so the newest change wins in every browser. */
export interface VendorKeyChange {
  readonly key: string | null
  /** ISO timestamp in UTC, as `Date.toISOString` writes it. */
  readonly changedAt: string
}

/** Each vendor's last change, by vendor id. A vendor no browser saved a key for has none. */
export type VendorKeyChanges = Readonly<Record<string, VendorKeyChange>>

/** The time of a key this browser kept before keys carried a time, which any change with a time outdates. */
export const BEFORE_ANY_CHANGE = '1970-01-01T00:00:00.000Z'

const FORMAT = 'kuna-vendor-keys'
const VERSION = 1
const UTC_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

/** Whether the text is a time the keys file takes, so a browser writes only times every browser reads back. */
export function isChangeTime(text: string): boolean {
  return UTC_TIME.test(text)
}

/** The keys file of one Investments file in the app's hidden folder on Drive, named by that file's id. */
export function keysFileName(investmentsFileId: string): string {
  return `kuna-investments-keys-${investmentsFileId}.json`
}

/** Why Kuna leaves a keys file as it is: it is not one Kuna writes, or a newer Kuna wrote it. */
export type KeysFileRefusal = 'not-keys' | 'newer'

export type KeysFileRead = { readonly kind: 'read'; readonly changes: VendorKeyChanges } | { readonly kind: 'refused'; readonly reason: KeysFileRefusal }

export function encodeKeysFile(changes: VendorKeyChanges): string {
  const keys = Object.fromEntries(
    Object.keys(changes)
      .sort()
      .map((vendorId) => [vendorId, { key: changes[vendorId]!.key, changed_at: changes[vendorId]!.changedAt }]),
  )
  return `${JSON.stringify({ format: FORMAT, version: VERSION, keys }, null, 2)}\n`
}

export function decodeKeysFile(text: string): KeysFileRead {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { kind: 'refused', reason: 'not-keys' }
  }
  const file = parsed as { format?: unknown; version?: unknown; keys?: unknown } | null
  if (file === null || typeof file !== 'object' || file.format !== FORMAT || typeof file.version !== 'number') {
    return { kind: 'refused', reason: 'not-keys' }
  }
  if (file.version > VERSION) {
    return { kind: 'refused', reason: 'newer' }
  }
  if (file.version !== VERSION || file.keys === null || typeof file.keys !== 'object' || Array.isArray(file.keys)) {
    return { kind: 'refused', reason: 'not-keys' }
  }
  const changes: [string, VendorKeyChange][] = []
  for (const [vendorId, entry] of Object.entries(file.keys)) {
    const { key, changed_at: changedAt } = (entry ?? {}) as { key?: unknown; changed_at?: unknown }
    const keyRead = key === null || (typeof key === 'string' && key.trim() !== '' && key.trim() === key)
    if (!keyRead || typeof changedAt !== 'string' || !isChangeTime(changedAt)) {
      return { kind: 'refused', reason: 'not-keys' }
    }
    changes.push([vendorId, { key: key as string | null, changedAt }])
  }
  return { kind: 'read', changes: Object.fromEntries(changes) }
}

/** For each vendor, the newer of the two changes. On the same time the file's wins, so two browsers end on the same key. */
export function newestKeys(here: VendorKeyChanges, inFile: VendorKeyChanges): VendorKeyChanges {
  const vendorIds = [...new Set([...Object.keys(here), ...Object.keys(inFile)])].sort()
  return Object.fromEntries(
    vendorIds.map((vendorId) => {
      const local = here[vendorId]
      const remote = inFile[vendorId]
      return [vendorId, remote === undefined || (local !== undefined && local.changedAt > remote.changedAt) ? local! : remote]
    }),
  )
}

/** Whether both hold the same key and time for every vendor. */
export function sameKeys(left: VendorKeyChanges, right: VendorKeyChanges): boolean {
  const vendorIds = new Set([...Object.keys(left), ...Object.keys(right)])
  return [...vendorIds].every((vendorId) => left[vendorId]?.key === right[vendorId]?.key && left[vendorId]?.changedAt === right[vendorId]?.changedAt)
}
