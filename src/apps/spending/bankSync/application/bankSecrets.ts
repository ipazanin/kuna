import { OLD_BANK_KEYS, bankOfOldKey } from '../domain/bankLink'
import type { BankUsage, LinkName } from '../domain/bankLink'

/** Where a bank key and its sessions are kept: this browser's secrets, which the Keys step carries to the secrets file in the person's Google account. */
export interface BankSecretStore {
  read(id: string): string | null
  /** Keeps the value, or forgets it on null, noting when. */
  write(id: string, value: string | null): void
  /** The id of every secret kept here. */
  ids(): readonly string[]
}

/** One bank's session for a login as the script reads it. */
export interface KeptSession extends LinkName {
  readonly sessionId: string
}

const KEY_PREFIX = 'enable-banking '
const SESSION_PREFIX = 'enable-banking-session '

/** The secret that holds an application's private key, named by the application. */
export function bankKeyId(applicationId: string): string {
  return `${KEY_PREFIX}${applicationId}`
}

/** The secret that holds one bank's session for a login, the bank by its name at Enable Banking. */
export function bankSessionId(link: LinkName): string {
  return `${SESSION_PREFIX}${link.usage} ${link.bank}`
}

/** The secret a browser from before bank-link records kept the bank's session under, or null for a bank Kuna did not link then. */
function oldSessionId(link: LinkName): string | null {
  const oldKey = OLD_BANK_KEYS[link.bank]
  return oldKey === undefined ? null : `${SESSION_PREFIX}${link.usage} ${oldKey}`
}

/** The application's private key kept here, or null when this browser holds none. */
export function keyOf(store: Pick<BankSecretStore, 'read'>, applicationId: string): string | null {
  return applicationId === '' ? null : store.read(bankKeyId(applicationId))
}

/**
 * Keeps the application's private key, trimmed, as the secrets file takes a key. A key of another application than the one
 * before forgets that one's key and every session, since a session belongs to the application that opened it.
 */
export function keepKey(store: BankSecretStore, before: string, applicationId: string, pem: string): void {
  if (before !== applicationId) forgetBankSecrets(store, before)
  store.write(bankKeyId(applicationId), pem.trim())
}

/** The session ids kept here for a login, each bank's under its name, or under its old short name until a link of it moves it. */
export function sessionsOf(store: Pick<BankSecretStore, 'read' | 'ids'>, usage: BankUsage): readonly KeptSession[] {
  const prefix = `${SESSION_PREFIX}${usage} `
  const named = store.ids().flatMap((id) => {
    const sessionId = id.startsWith(prefix) ? store.read(id) : null
    return sessionId === null ? [] : [{ bank: id.slice(prefix.length), usage, sessionId }]
  })
  return named.flatMap((session) => {
    const bank = bankOfOldKey(session.bank)
    if (bank === null) return [session]
    return named.some((other) => other.bank === bank) ? [] : [{ ...session, bank }]
  })
}

/** Keeps a bank's new session, and gives the one it replaces, or null when there was none or it is the same. A session kept under the bank's old short name moves too. */
export function keepSession(store: BankSecretStore, link: LinkName, sessionId: string): string | null {
  const oldId = oldSessionId(link)
  const old = oldId === null ? null : store.read(oldId)
  const replaced = store.read(bankSessionId(link)) ?? old
  store.write(bankSessionId(link), sessionId)
  if (oldId !== null && old !== null) store.write(oldId, null)
  return replaced === sessionId ? null : replaced
}

/** Forgets one bank's session for a login, kept under its name or its old short name, and gives the session ids it held. */
export function forgetSession(store: BankSecretStore, link: LinkName): readonly string[] {
  const ids = [bankSessionId(link), oldSessionId(link)].filter((id) => id !== null)
  return ids.flatMap((id) => {
    const sessionId = store.read(id)
    if (sessionId === null) return []
    store.write(id, null)
    return [sessionId]
  })
}

/** Forgets the application's key and every session of any login, as Remove bank sync does. */
export function forgetBankSecrets(store: BankSecretStore, applicationId: string): void {
  if (keyOf(store, applicationId) !== null) store.write(bankKeyId(applicationId), null)
  store
    .ids()
    .filter((id) => id.startsWith(SESSION_PREFIX))
    .forEach((id) => store.write(id, null))
}
