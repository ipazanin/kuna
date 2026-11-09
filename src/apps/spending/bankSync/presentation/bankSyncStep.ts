import { hasDueLink, hasLiveLink } from '../domain/bankLinks'
import { loadLastFetch } from '../infrastructure/bankBrowserState'
import { bankHeldResult, bankStepResult } from './bankStepResult'
import { BANK_SYNC_SCOPE } from './bankSyncPort'
import { fetchAndImport } from './useBankSync'
import { words } from './words'
import { reviewCount } from '../../statements/domain/reviewQueue'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import { today } from '../../../../shared/calendar/civilDate'
import type { SyncStep } from '../../../../shared/sync/application/sync'

const store = useSpendingBooks()

/**
 * The Spending sync's bank step while a link is live. It imports what is new, and leaves each bank alone for six hours
 * after it answered any device sharing the file, as many banks allow four background fetches a day.
 */
export const BANK_SYNC_STEP: SyncStep = {
  id: 'bank-sync',
  label: words.step.label,
  scopes: () => [BANK_SYNC_SCOPE],
  startLine: words.step.start,
  leftOutWhenOff: true,
  on: () => store.state.workbook !== null && hasLiveLink(store.state.workbook.settings, today()),
  async run() {
    const book = store.state.workbook
    if (book !== null && !hasDueLink(book.settings, today(), Date.now())) {
      const last = loadLastFetch()
      return bankHeldResult(last?.problems ?? [], last?.linked ?? [], book)
    }
    const outcome = await fetchAndImport(false)
    const writeId = store.state.writes.find((written) => written.receipt === outcome.receipt)?.id ?? null
    return bankStepResult(outcome, store.state.workbook, writeId, store.state.workbook === null ? 0 : reviewCount(store.state.workbook))
  },
}
