import { ref, shallowRef } from 'vue'
import type { Ref } from 'vue'

import { banksFor } from '../domain/bankLink'
import type { BankUsage, ListedBank } from '../domain/bankLink'
import { BANK_SYNC_SCOPE, bankSyncPort, startBankLink } from '../application/pageBankSync'
import { withGoogleAccess } from '../../google/withGoogleAccess'

/** Linking a bank for one login: the banks Enable Banking lists for it, and the trip to a bank's approval. */
export interface BankLinking {
  readonly usage: BankUsage
  /** The banks Enable Banking listed that take the login, once this page asked, or null before. */
  readonly listed: Readonly<Ref<readonly ListedBank[] | null>>
  readonly listFailure: Ref<string | null>
  readonly listing: Ref<boolean>
  /** True while the trip to a bank starts. An app's own steps of the bank sync, such as a fetch, may hold it too. */
  readonly busy: Ref<boolean>
  /** Why the last step failed, which an app's own steps of the bank sync may set too. */
  readonly failure: Ref<string | null>
  /** Asks Enable Banking once more for the banks that take the login. */
  listBanks(): Promise<void>
  /** Sends the tab to the bank's approval for the login, asking Google first in this tap when the page lacks the access. */
  link(bank: string): Promise<void>
}

export function messageOf(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason)
}

/** Linking for the login, with the application the app's book keeps, or null while no file is open. */
export function bankLinking(usage: BankUsage, applicationId: () => string | null): BankLinking {
  const listed = shallowRef<readonly ListedBank[] | null>(null)
  const listFailure = ref<string | null>(null)
  const listing = ref(false)
  const busy = ref(false)
  const failure = ref<string | null>(null)

  async function listBanks(): Promise<void> {
    const application = applicationId()
    if (application === null || listing.value) return
    listing.value = true
    listFailure.value = null
    try {
      listed.value = await withGoogleAccess([BANK_SYNC_SCOPE], async () => banksFor(await (await bankSyncPort(application, usage)).banks(), usage))
    } catch (reason) {
      listFailure.value = messageOf(reason)
    } finally {
      listing.value = false
    }
  }

  async function link(bank: string): Promise<void> {
    const application = applicationId()
    if (application === null || busy.value) return
    failure.value = null
    busy.value = true
    try {
      await withGoogleAccess([BANK_SYNC_SCOPE], () => startBankLink(application, { bank, usage }))
    } catch (reason) {
      failure.value = messageOf(reason)
      busy.value = false
    }
  }

  return { usage, listed, listFailure, listing, busy, failure, listBanks, link }
}
