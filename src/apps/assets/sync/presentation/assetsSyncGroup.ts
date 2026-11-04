import { BOOKS_STEP } from '../../../../shared/sync/application/syncRun'
import type { AppSyncGroup } from '../../../../shared/sync/presentation/pageSync'
import { ASSETS_SETTINGS_ROUTE } from '../../overview/presentation/assetLinks'
import { useAssetsBooks } from '../../workbook/application/assetsStore'
import LocalAssetsStatus from '../../workbook/presentation/LocalAssetsStatus.vue'

/** The Assets part of the page's sync: its file alone, with no steps of its own. */
export function assetsSyncGroup(): AppSyncGroup {
  const store = useAssetsBooks()
  return {
    store,
    steps: () => [],
    needs: () => BOOKS_STEP.scopes.map((scope) => ({ scope, label: BOOKS_STEP.label })),
    undo: (write) => store.undo(write),
    exportControl: LocalAssetsStatus,
    fileCard: ASSETS_SETTINGS_ROUTE,
  }
}
