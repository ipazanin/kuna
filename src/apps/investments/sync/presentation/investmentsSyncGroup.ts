import { BOOKS_STEP } from '../../../../shared/sync/application/syncRun'
import type { AppSyncGroup } from '../../../../shared/sync/presentation/pageSync'
import { useInvestmentsBooks } from '../../workbook/application/investmentsStore'
import LocalInvestmentsStatus from '../../workbook/presentation/LocalInvestmentsStatus.vue'
import { PRICES_STEP } from '../../prices/presentation/usePrices'

/** The Investments part of the page's sync: its file, then the prices file beside it. */
export function investmentsSyncGroup(): AppSyncGroup {
  const store = useInvestmentsBooks()
  return {
    store,
    steps: () => [PRICES_STEP],
    needs: () => BOOKS_STEP.scopes.map((scope) => ({ scope, label: BOOKS_STEP.label })),
    undo: (write) => store.undo(write),
    exportControl: LocalInvestmentsStatus,
  }
}
