import { LINKABLE_BANKS } from '../../workbook/domain/spendingSettings'
import type { LinkableBank } from '../../workbook/domain/spendingSettings'

/** Where a bank key and its sessions are kept: this browser's secrets, which the Keys step carries to the secrets file in the person's Google account. */
export interface BankSecretStore {
  read(id: string): string | null
  /** Keeps the value, or forgets it on null, noting when. */
  write(id: string, value: string | null): void
}

/** Whose banks a session reads. Only a person's own banks link for now. */
export type BankUsage = 'personal'

/** One bank's session as the script reads it. */
export interface KeptSession {
  readonly bank: LinkableBank
  readonly sessionId: string
}

const KEY_PREFIX = 'enable-banking '
const SESSION_PREFIX = 'enable-banking-session '

/** The secret that holds an application's private key, named by the application. */
export function bankKeyId(applicationId: string): string {
  return `${KEY_PREFIX}${applicationId}`
}

/** The secret that holds one bank's session for a usage. */
export function bankSessionId(usage: BankUsage, bank: LinkableBank): string {
  return `${SESSION_PREFIX}${usage} ${bank}`
}

/** The application's private key kept here, or null when this browser holds none. */
export function keyOf(store: Pick<BankSecretStore, 'read'>, applicationId: string): string | null {
  return applicationId === '' ? null : store.read(bankKeyId(applicationId))
}

/**
 * Keeps the application's private key, trimmed, as the secrets file takes a key. A key of another application than the one
 * before forgets that one's key and every session, since a session belongs to the application that opened it.
 */
export function keepKey(store: BankSecretStore, before: string, applicationId: string, pem: string, usage: BankUsage): void {
  if (before !== applicationId) forgetBankSecrets(store, before, usage)
  store.write(bankKeyId(applicationId), pem.trim())
}

/** The sessions of a usage kept here, one per bank at most. */
export function sessionsOf(store: Pick<BankSecretStore, 'read'>, usage: BankUsage): readonly KeptSession[] {
  return LINKABLE_BANKS.flatMap((bank) => {
    const sessionId = store.read(bankSessionId(usage, bank))
    return sessionId === null ? [] : [{ bank, sessionId }]
  })
}

/** Keeps a bank's new session, and gives the one it replaces, or null when there was none or it is the same. */
export function keepSession(store: BankSecretStore, usage: BankUsage, bank: LinkableBank, sessionId: string): string | null {
  const replaced = store.read(bankSessionId(usage, bank))
  store.write(bankSessionId(usage, bank), sessionId)
  return replaced === sessionId ? null : replaced
}

function forgetSessions(store: BankSecretStore, usage: BankUsage): void {
  LINKABLE_BANKS.forEach((bank) => {
    if (store.read(bankSessionId(usage, bank)) !== null) store.write(bankSessionId(usage, bank), null)
  })
}

/** Forgets the application's key and every session, as Remove bank sync does. */
export function forgetBankSecrets(store: BankSecretStore, applicationId: string, usage: BankUsage): void {
  if (keyOf(store, applicationId) !== null) store.write(bankKeyId(applicationId), null)
  forgetSessions(store, usage)
}
