import { ref, shallowRef } from 'vue'

import type { BankRead } from '../application/bankRead'
import { forgetBankLink } from '../application/bankLinkWrites'
import { forgetSession } from '../application/bankSecrets'
import { bankImporter, finishBankLink } from '../application/bankSync'
import type { BankSetup, BankSyncOutcome } from '../application/bankSync'
import { withOlderHistory } from '../domain/bankAccountSetup'
import { banksFor } from '../domain/bankLink'
import type { LinkName, ListedBank } from '../domain/bankLink'
import { hasLiveLink } from '../domain/bankLinks'
import { bankRedirectUrl, loadLastFetch, loadPendingLink, saveLastFetch, savePendingLink } from '../infrastructure/bankBrowserState'
import { bankProblemLines } from './bankStepResult'
import { words } from './words'
import { BANK_SECRETS, BANK_SYNC_SCOPE, BANK_USAGE, bankSyncPort } from './bankSyncPort'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import { today } from '../../../../shared/calendar/civilDate'
import { isUnauthorized } from '../../../../shared/google/googleApi'
import { withGoogleAccess } from '../../../../shared/google/withGoogleAccess'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import { ruleLinks } from '../../links/presentation/ruleLinks'

const store = useSpendingBooks()
const lastOutcome = shallowRef<BankSyncOutcome | null>(null)
const failure = ref<string | null>(null)
const busy = ref(false)
/** The banks Enable Banking listed that take a personal login, once this page asked, or null before. */
const listed = shallowRef<readonly ListedBank[] | null>(null)
const listFailure = ref<string | null>(null)
const listing = ref(false)
/** The bank whose link Remove is taking away, or null. */
const removing = ref<string | null>(null)

const importer = bankImporter({
  script: bankSyncPort,
  store,
  asked: (read: BankRead) => saveLastFetch({ problems: bankProblemLines(read), linked: read.linked }),
  day: today,
  links: ruleLinks,
  now: Date.now,
})

function messageOf(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason)
}

/**
 * Asks the banks and imports what is new. Throws why not, Google's 401 as it came, which the page's sync turns into asking
 * for access. `personHere` is true when a tap started it, and `freshLink` is the link just made. The drafts keep the
 * older rows an earlier fetch held for them.
 */
export async function fetchAndImport(personHere: boolean, freshLink?: LinkName): Promise<BankSyncOutcome> {
  failure.value = null
  try {
    const outcome = await importer.run(personHere, freshLink)
    lastOutcome.value = { ...outcome, proposals: withOlderHistory(outcome.proposals, lastOutcome.value?.proposals ?? []) }
    return outcome
  } catch (reason) {
    if (!isUnauthorized(reason)) failure.value = messageOf(reason)
    throw reason
  }
}

/** What the set-up list works from: the last fetch of this page with the rows it holds, or after a reload the accounts this device's last fetch gave, with nothing held. */
export function heldBankSetup(): BankSetup | null {
  if (lastOutcome.value !== null) return lastOutcome.value
  const last = loadLastFetch()
  return last === null ? null : { linked: last.linked, proposals: [], differences: [], stated: [], olderRows: [] }
}

/** The bank sync as Settings shows and starts it, shared with the sync step through this module. */
export function useBankSync() {
  const writes = useRecordWrites(store)

  /** Asks Enable Banking once more for the banks that take a personal login, which is the only one Spending links. */
  async function listBanks(): Promise<void> {
    const book = store.state.workbook
    if (book === null || listing.value) return
    listing.value = true
    listFailure.value = null
    try {
      listed.value = await withGoogleAccess([BANK_SYNC_SCOPE], async () => banksFor(await (await bankSyncPort(book.settings.bankSyncApplication)).banks(), BANK_USAGE))
    } catch (reason) {
      listFailure.value = messageOf(reason)
    } finally {
      listing.value = false
    }
  }

  /** Sends the tab to the bank's approval for a personal login, asking Google first in this tap when the page lacks the access. */
  async function link(bank: string): Promise<void> {
    const book = store.state.workbook
    if (book === null || busy.value) return
    failure.value = null
    busy.value = true
    try {
      await withGoogleAccess([BANK_SYNC_SCOPE], async () => {
        const state = crypto.randomUUID()
        const port = await bankSyncPort(book.settings.bankSyncApplication)
        const url = await port.startLink({ bank, usage: BANK_USAGE }, bankRedirectUrl(), state)
        savePendingLink({ bank, usage: BANK_USAGE, state, code: null, validUntil: null })
        window.location.assign(url)
      })
    } catch (reason) {
      failure.value = messageOf(reason)
      busy.value = false
    }
  }

  /** Writes down the link a bank came back with and fetches at once, since a bank gives more than 90 days only just after an approval: Revolut for 5 minutes, and many others for an hour. */
  async function finishLink(): Promise<BankSyncOutcome | null> {
    const book = store.state.workbook
    const pending = loadPendingLink()
    if (book === null || pending?.code == null) return null
    failure.value = null
    busy.value = true
    try {
      return await withGoogleAccess([BANK_SYNC_SCOPE], async () => {
        await finishBankLink({
          script: await bankSyncPort(book.settings.bankSyncApplication),
          pending: { load: loadPendingLink, save: savePendingLink },
          store,
          secrets: BANK_SECRETS,
        })
        return await fetchAndImport(true, pending)
      })
    } catch (reason) {
      failure.value = messageOf(reason)
      return null
    } finally {
      busy.value = false
    }
  }

  /** The tap on Sync now, which asks whatever the time since the last ask. */
  async function syncNow(): Promise<BankSyncOutcome | null> {
    busy.value = true
    try {
      return await withGoogleAccess([BANK_SYNC_SCOPE], () => fetchAndImport(true))
    } catch (reason) {
      failure.value = messageOf(reason)
      return null
    } finally {
      busy.value = false
    }
  }

  /**
   * Forgets the bank's session here, ends it at Enable Banking where the script reaches it, and removes the bank's link from the
   * book in one write. The toast offers no Undo, since the ended session cannot come back. The rows already in the book stay.
   */
  async function removeLink(bank: string): Promise<boolean> {
    const book = store.state.workbook
    if (book === null || removing.value !== null) return false
    const name: LinkName = { bank, usage: BANK_USAGE }
    removing.value = bank
    try {
      const ended = forgetSession(BANK_SECRETS, name)
      if (ended.length > 0) {
        // A session the script cannot reach stays open at the bank until it runs out, and the link goes anyway.
        await withGoogleAccess([BANK_SYNC_SCOPE], async () => {
          const port = await bankSyncPort(book.settings.bankSyncApplication)
          for (const sessionId of ended) await port.closeSession(sessionId)
        }).catch(() => undefined)
      }
      return await writes.write(words.linkRemoved(bank), (unit) => forgetBankLink(unit, book, name), {
        failedTitle: words.application.notRemoved,
        undoable: false,
      })
    } finally {
      removing.value = null
    }
  }

  return {
    lastOutcome,
    failure,
    busy,
    listed,
    listFailure,
    listing,
    removing,
    listBanks,
    removeLink,
    link,
    finishLink,
    syncNow,
    canSync: () => (store.state.workbook === null ? false : hasLiveLink(store.state.workbook, today())),
  }
}
