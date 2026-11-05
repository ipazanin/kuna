/** One secret as last saved, or null once removed, with when that happened, so the newest change wins in every browser. */
export interface SecretChange {
  readonly key: string | null
  /** ISO timestamp in UTC, as `Date.toISOString` writes it. */
  readonly changedAt: string
}

/** Each secret's last change, by its id, such as `twelvedata` or `anthropic`. An id no browser saved a key for has none. */
export type SecretChanges = Readonly<Record<string, SecretChange>>

/** The time of a key this browser kept before keys carried a time, which any change with a time outdates. */
export const BEFORE_ANY_CHANGE = '1970-01-01T00:00:00.000Z'

/** The one secrets file of a Google account, in the app's hidden folder on Drive. */
export const SECRETS_FILE_NAME = 'kuna-secrets.json'

const FORMAT = 'kuna-secrets'
const VERSION = 1
/** The keys file of one Investments file, which held the price vendor keys before one file held every secret. */
const OLD_FORMAT = 'kuna-vendor-keys'
const OLD_VERSION = 1
const OLD_FILE_NAME = /^kuna-investments-keys-.+\.json$/
const UTC_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

/** Whether the text is a time the secrets file takes, so a browser writes only times every browser reads back. */
export function isChangeTime(text: string): boolean {
  return UTC_TIME.test(text)
}

/** Whether the name is that of an old keys file, named after the Investments file it belonged to. */
export function isOldKeysFileName(name: string): boolean {
  return OLD_FILE_NAME.test(name)
}

/** Why Kuna leaves a secrets file as it is: it is not one Kuna writes, or a newer Kuna wrote it. */
export type SecretsFileRefusal = 'not-keys' | 'newer'

export type SecretsFileRead = { readonly kind: 'read'; readonly changes: SecretChanges } | { readonly kind: 'refused'; readonly reason: SecretsFileRefusal }

export function encodeSecretsFile(changes: SecretChanges): string {
  const secrets = Object.fromEntries(
    Object.keys(changes)
      .sort()
      .map((id) => [id, { key: changes[id]!.key, changed_at: changes[id]!.changedAt }]),
  )
  return `${JSON.stringify({ format: FORMAT, version: VERSION, secrets }, null, 2)}\n`
}

/** Reads the secrets file, or an old keys file, whose entries have the same shape under `keys`. */
export function decodeSecretsFile(text: string): SecretsFileRead {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { kind: 'refused', reason: 'not-keys' }
  }
  const file = parsed as { format?: unknown; version?: unknown; secrets?: unknown; keys?: unknown } | null
  if (file === null || typeof file !== 'object' || typeof file.version !== 'number') {
    return { kind: 'refused', reason: 'not-keys' }
  }
  const [entries, version] = file.format === FORMAT ? [file.secrets, VERSION] : file.format === OLD_FORMAT ? [file.keys, OLD_VERSION] : [undefined, null]
  if (version === null) {
    return { kind: 'refused', reason: 'not-keys' }
  }
  if (file.version > version) {
    return { kind: 'refused', reason: 'newer' }
  }
  if (file.version !== version || entries === null || typeof entries !== 'object' || Array.isArray(entries)) {
    return { kind: 'refused', reason: 'not-keys' }
  }
  const changes: [string, SecretChange][] = []
  for (const [id, entry] of Object.entries(entries)) {
    const { key, changed_at: changedAt } = (entry ?? {}) as { key?: unknown; changed_at?: unknown }
    const keyRead = key === null || (typeof key === 'string' && key.trim() !== '' && key.trim() === key)
    if (!keyRead || typeof changedAt !== 'string' || !isChangeTime(changedAt)) {
      return { kind: 'refused', reason: 'not-keys' }
    }
    changes.push([id, { key: key as string | null, changedAt }])
  }
  return { kind: 'read', changes: Object.fromEntries(changes) }
}

/** For each id, the newer of the two changes. On the same time the file's wins, so two browsers end on the same key. */
export function newestSecrets(here: SecretChanges, inFile: SecretChanges): SecretChanges {
  const ids = [...new Set([...Object.keys(here), ...Object.keys(inFile)])].sort()
  return Object.fromEntries(
    ids.map((id) => {
      const local = changeOf(here, id)
      const remote = changeOf(inFile, id)
      return [id, remote === undefined || (local !== undefined && local.changedAt > remote.changedAt) ? local! : remote]
    }),
  )
}

/** Whether both hold the same key and time for every id. */
export function sameSecrets(left: SecretChanges, right: SecretChanges): boolean {
  const ids = new Set([...Object.keys(left), ...Object.keys(right)])
  return [...ids].every((id) => changeOf(left, id)?.key === changeOf(right, id)?.key && changeOf(left, id)?.changedAt === changeOf(right, id)?.changedAt)
}

/** The change of the id, read as an own entry, since a file may name an id such as `__proto__`. */
function changeOf(changes: SecretChanges, id: string): SecretChange | undefined {
  return Object.hasOwn(changes, id) ? changes[id] : undefined
}
