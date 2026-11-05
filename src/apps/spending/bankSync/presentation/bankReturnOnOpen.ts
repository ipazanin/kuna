import type { Router } from 'vue-router'

import type { BankReturnNote } from '../domain/bankReturn'
import { takeBankReturn, takeReturnNote } from '../infrastructure/bankBrowserState'
import { SPENDING_BANK_SYNC_LINK } from '../../overview/presentation/spendingLinks'

let noted: BankReturnNote | null = null

/** Takes a bank's answer out of the address as the app installs, before the silent trip to Google can move the tab. */
export function noteBankReturn(): void {
  takeBankReturn()
}

/** What the return that opened this page came to, or null. */
export function notedBankReturn(): BankReturnNote | null {
  return noted
}

/** Opens Settings' Bank sync tab once for a return from a bank, and leaves every other open of Kuna where it was going. A code still waiting has Finish linking on that tab. */
export function openBankSyncAfterReturn(router: Pick<Router, 'replace'>): void {
  noted = takeReturnNote()
  if (noted !== null) void router.replace(SPENDING_BANK_SYNC_LINK)
}
