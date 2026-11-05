import { SPENDING_SETTINGS_ROUTE } from '../../overview/presentation/spendingLinks'
import { RATES_STEP } from '../../rates/presentation/ratesStep'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import LocalSpendingStatus from '../../workbook/presentation/LocalSpendingStatus.vue'
import { BOOKS_STEP } from '../../../../shared/sync/application/syncRun'
import type { AppSyncGroup } from '../../../../shared/sync/presentation/pageSync'

/** The Spending part of the page's sync: its file, then the ECB rates of its foreign accounts. */
export function spendingSyncGroup(): AppSyncGroup {
  const store = useSpendingBooks()
  return {
    store,
    steps: () => [RATES_STEP],
    needs: () => BOOKS_STEP.scopes.map((scope) => ({ scope, label: BOOKS_STEP.label })),
    undo: (write) => store.undo(write),
    exportControl: LocalSpendingStatus,
    fileCard: SPENDING_SETTINGS_ROUTE,
  }
}
