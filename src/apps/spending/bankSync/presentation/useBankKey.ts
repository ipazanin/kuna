import { ref, shallowRef } from 'vue'

import { forgetBankSecrets, keepKey, keyOf, sessionsOf } from '../application/bankSecrets'
import { forgetBankSync, saveApplicationId } from '../application/bankSync'
import { applicationProblems } from '../domain/bankAnswer'
import { BANK_USAGES } from '../domain/bankLink'
import type { ApplicationProblem, BankApplication } from '../domain/bankAnswer'
import { bankRedirectUrl } from '../infrastructure/bankBrowserState'
import { UnreadableBankKey } from '../infrastructure/enableBankingToken'
import { BANK_SECRETS, BANK_SYNC_SCOPE, bankSyncPort, bankSyncPortWithKey } from './bankSyncPort'
import { words } from './words'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import { withGoogleAccess } from '../../../../shared/google/withGoogleAccess'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'

/** What the last check of this page found: the application and what keeps it from linking, or why the key failed. */
export type KeyCheck = { readonly kind: 'answered'; readonly application: BankApplication; readonly problems: readonly ApplicationProblem[] } | { readonly kind: 'failed'; readonly line: string }

const lastCheck = shallowRef<KeyCheck | null>(null)

function failedLine(failure: unknown): string {
  if (failure instanceof UnreadableBankKey) return words.key.unreadable
  return words.key.refused(failure instanceof Error ? failure.message : String(failure))
}

/** Ends each session kept here at the bank with the application's key, of either login, since the key and every session go together. A session the script cannot reach stays open at the bank until it runs out. */
async function closeSessions(applicationId: string): Promise<void> {
  if (keyOf(BANK_SECRETS, applicationId) === null) return
  try {
    const port = await bankSyncPort(applicationId)
    for (const { sessionId } of BANK_USAGES.flatMap((usage) => sessionsOf(BANK_SECRETS, usage))) await port.closeSession(sessionId)
  } catch {
    // Remove and another key go ahead anyway, since the bank ends the session on its own day.
  }
}

/**
 * Bringing, checking and removing the person's own Enable Banking key. A key is kept, and its application id written to the
 * book, only once Enable Banking answers a call it signed. The key lives in this browser's secrets, which the Keys step
 * carries to the secrets file in the person's Google account, and never in a draft, the book or the chat. Undo puts back only
 * the book and leaves the key kept. A new key's first Check offers it, while another key's Check and Remove do not, since the
 * sessions they close at the bank cannot come back.
 */
export function useBankKey() {
  const store = useSpendingBooks()
  const writes = useRecordWrites(store)
  const busy = ref(false)
  const removing = ref(false)

  async function answered(check: () => Promise<BankApplication>): Promise<BankApplication | null> {
    try {
      const application = await check()
      lastCheck.value = { kind: 'answered', application, problems: applicationProblems(application, bankRedirectUrl()) }
      return application
    } catch (failure) {
      lastCheck.value = { kind: 'failed', line: failedLine(failure) }
      return null
    }
  }

  /** Signs one call with the typed key and keeps it only when Enable Banking answers. Another application's key ends the sessions of the one before and forgets them. Call it first in a click handler. */
  async function bring(applicationId: string, pem: string): Promise<boolean> {
    const book = store.state.workbook
    const id = applicationId.trim()
    if (book === null || id === '' || pem.trim() === '') return false
    busy.value = true
    try {
      return await withGoogleAccess([BANK_SYNC_SCOPE, 'drive.appdata'], async () => {
        const application = await answered(async () => (await bankSyncPortWithKey(id, pem)).application())
        if (application === null) return false
        const before = book.settings.bankSyncApplication
        if (before !== id) await closeSessions(before)
        keepKey(BANK_SECRETS, before, id, pem)
        return await writes.write(before === '' ? words.key.saved : words.key.replaced, (unit) => saveApplicationId(unit, book, id), {
          failedTitle: words.notSaved,
          undoable: before === '' || before === id,
        })
      })
    } finally {
      busy.value = false
    }
  }

  /** Asks Enable Banking again how the kept application stands, as after linking its accounts in the Control Panel. */
  async function recheck(): Promise<void> {
    const book = store.state.workbook
    if (book === null) return
    busy.value = true
    try {
      await withGoogleAccess([BANK_SYNC_SCOPE], () => answered(async () => (await bankSyncPort(book.settings.bankSyncApplication)).application()))
    } finally {
      busy.value = false
    }
  }

  /** Ends each kept session at the bank, forgets the key and the sessions, and clears the book's bank sync in one write. Resolves to whether the write went through. */
  async function remove(): Promise<boolean> {
    const book = store.state.workbook
    if (book === null) return false
    const applicationId = book.settings.bankSyncApplication
    removing.value = true
    try {
      await withGoogleAccess([BANK_SYNC_SCOPE], () => closeSessions(applicationId)).catch(() => undefined)
      forgetBankSecrets(BANK_SECRETS, applicationId)
      lastCheck.value = null
      return await writes.write(words.application.removed, (unit) => forgetBankSync(unit, book), { failedTitle: words.application.notRemoved, undoable: false })
    } finally {
      removing.value = false
    }
  }

  return { busy, removing, refused: writes.refused, lastCheck, bring, recheck, remove }
}
