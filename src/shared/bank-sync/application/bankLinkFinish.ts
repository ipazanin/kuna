import { keepSession } from './bankSecrets'
import type { BankSecretStore } from './bankSecrets'
import { BankScriptFailure } from './bankSyncPort'
import type { BankLinkMade, BankSyncPort } from './bankSyncPort'
import type { LinkName } from '../domain/bankLink'
import type { PendingLink } from '../domain/bankReturn'

export interface PendingLinks {
  load(): PendingLink | null
  save(pending: PendingLink | null): void
}

export interface BankLinkPorts {
  readonly script: BankSyncPort
  readonly pending: PendingLinks
  readonly secrets: BankSecretStore
  /** Writes the link down in the app's own book, with the day Enable Banking says it ends. */
  saveLink(link: LinkName, validUntil: string): Promise<unknown>
}

/**
 * Trades the code a bank came back with, keeps the session as a secret and writes down the link with the bank and login
 * Enable Banking answered and the day it ends. The session it replaces is closed, since nothing could reach it afterwards.
 * A code works once, so the session is kept at once and the link until the write lands, and a retry only writes. A code the
 * script refuses is forgotten, since it will never work.
 */
export async function finishBankLink({ script, pending, secrets, saveLink }: BankLinkPorts): Promise<void> {
  let held = pending.load()
  if (held === null || held.code === null) return
  let validUntil = held.validUntil
  if (validUntil === null) {
    let made: BankLinkMade
    try {
      made = await script.finishLink(held.code)
    } catch (failure) {
      if (failure instanceof BankScriptFailure) pending.save(null)
      throw failure
    }
    const replaced = keepSession(secrets, made, made.sessionId)
    validUntil = made.validUntil
    held = { ...held, bank: made.bank, usage: made.usage, validUntil }
    pending.save(held)
    // The old session is no longer kept anywhere, so failing to close it leaves nothing to undo and the link stands.
    if (replaced !== null) await script.closeSession(replaced).catch(() => undefined)
  }
  await saveLink(held, validUntil)
  pending.save(null)
}
