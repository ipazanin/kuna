import { BOOKS_STEP } from '../../../../shared/sync/application/syncRun'
import type { AppSyncGroup } from '../../../../shared/sync/presentation/pageSync'
import { INVESTMENTS_SETTINGS_ROUTE } from '../../overview/presentation/investmentLinks'
import { useInvestmentsBooks } from '../../workbook/application/investmentsStore'
import LocalInvestmentsStatus from '../../workbook/presentation/LocalInvestmentsStatus.vue'
import { KEYS_STEP, keysNeeds } from '../../prices/presentation/useKeysSync'
import { PRICES_STEP } from '../../prices/presentation/usePrices'

/** The Investments part of the page's sync: its file, then the price keys in the app's hidden folder, then the prices file beside it. */
export function investmentsSyncGroup(): AppSyncGroup {
  const store = useInvestmentsBooks()
  return {
    store,
    steps: () => [KEYS_STEP, PRICES_STEP],
    // A file in the bin or gone has no keys to carry, so it asks for no access the keys would need.
    needs: () => [...BOOKS_STEP.scopes.map((scope) => ({ scope, label: BOOKS_STEP.label })), ...(store.state.missing ? [] : keysNeeds(store.state.workbook?.book ?? null))],
    undo: (write) => store.undo(write),
    exportControl: LocalInvestmentsStatus,
    fileCard: INVESTMENTS_SETTINGS_ROUTE,
  }
}
