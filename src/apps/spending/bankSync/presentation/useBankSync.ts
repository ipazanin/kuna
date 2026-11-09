import { ref, shallowRef } from 'vue'

import type { BankRead } from '../application/bankRead'
import { bankImporter, finishBankLink } from '../application/bankSync'
import type { BankSetup, BankSyncOutcome } from '../application/bankSync'
import { withOlderHistory } from '../domain/bankAccountSetup'
import { ENABLE_BANKING_NAMES } from '../domain/bankAnswer'
import { hasLiveLink } from '../domain/bankLinks'
import { loadLastFetch, loadPendingLink, saveLastFetch, savePendingLink } from '../infrastructure/bankBrowserState'
import { bankProblemLines } from './bankStepResult'
import { BANK_SYNC_SCOPE, bankSyncPort } from './bankSyncPort'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import type { LinkableBank } from '../../workbook/domain/spendingSettings'
import { today } from '../../../../shared/calendar/civilDate'
import { isUnauthorized } from '../../../../shared/google/googleApi'
import { withGoogleAccess } from '../../../../shared/google/withGoogleAccess'

const store = useSpendingBooks()
const lastOutcome = shallowRef<BankSyncOutcome | null>(null)
const failure = ref<string | null>(null)
const busy = ref(false)

const importer = bankImporter({
  script: bankSyncPort,
  store,
  asked: (read: BankRead) => saveLastFetch({ problems: bankProblemLines(read), linked: read.linked }),
  day: today,
  now: Date.now,
})

function messageOf(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason)
}

/**
 * Asks the banks and imports what is new. Throws why not, Google's 401 as it came, which the page's sync turns into asking
 * for access. `personHere` is true when a tap started it, and `freshLink` is the bank just linked. The drafts keep the
 * older rows an earlier fetch held for them.
 */
export async function fetchAndImport(personHere: boolean, freshLink?: LinkableBank): Promise<BankSyncOutcome> {
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
  return last === null ? null : { linked: last.linked, proposals: [], differences: [], olderRows: [] }
}

/** The bank sync as Settings shows and starts it, shared with the sync step through this module. */
export function useBankSync() {
  /** Sends the tab to the bank's approval, asking Google first in this tap when the page lacks the access. */
  async function link(bank: LinkableBank): Promise<void> {
    const book = store.state.workbook
    if (book === null) return
    failure.value = null
    busy.value = true
    try {
      await withGoogleAccess([BANK_SYNC_SCOPE], async () => {
        const state = crypto.randomUUID()
        const port = await bankSyncPort(book.settings.bankSyncDeployment)
        const url = await port.startLink(ENABLE_BANKING_NAMES[bank], `${window.location.origin}${import.meta.env.BASE_URL}`, state)
        savePendingLink({ bank, state, code: null, validUntil: null })
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
        await finishBankLink({ script: await bankSyncPort(book.settings.bankSyncDeployment), pending: { load: loadPendingLink, save: savePendingLink }, store })
        return await fetchAndImport(true, pending.bank)
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

  return { lastOutcome, failure, busy, link, finishLink, syncNow, canSync: () => (store.state.workbook === null ? false : hasLiveLink(store.state.workbook.settings, today())) }
}
