import { BANK_SYNC_SCOPE } from '../../bankSync/presentation/bankSyncPort'
import { BANK_SYNC_STEP } from '../../bankSync/presentation/bankSyncStep'
import { SPENDING_SETTINGS_ROUTE } from '../../overview/presentation/spendingLinks'
import { RATES_STEP } from '../../rates/presentation/ratesStep'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import LocalSpendingStatus from '../../workbook/presentation/LocalSpendingStatus.vue'
import { BOOKS_STEP } from '../../../../shared/sync/application/syncRun'
import type { AppSyncGroup } from '../../../../shared/sync/presentation/pageSync'

/** The Spending part of the page's sync: its file, the ECB rates of its foreign accounts, and the banks once a bank sync script is saved. Without one it asks Google for nothing more and shows no such step. */
export function spendingSyncGroup(): AppSyncGroup {
  const store = useSpendingBooks()
  const savedScript = (): boolean => (store.state.workbook?.settings.bankSyncDeployment ?? '') !== ''
  return {
    store,
    steps: () => [RATES_STEP, ...(savedScript() ? [BANK_SYNC_STEP] : [])],
    needs: () => [...BOOKS_STEP.scopes.map((scope) => ({ scope, label: BOOKS_STEP.label })), ...(savedScript() ? [{ scope: BANK_SYNC_SCOPE, label: BANK_SYNC_STEP.label }] : [])],
    undo: (write) => store.undo(write),
    exportControl: LocalSpendingStatus,
    fileCard: SPENDING_SETTINGS_ROUTE,
  }
}
