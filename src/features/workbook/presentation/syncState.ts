import type { SyncState } from '../../../shared/ui/SyncStatus.vue'
import type { WorkbookState } from '../application/createWorkbookStore'
import type { WorkbookCopy } from '../application/workbookPorts'

/**
 * What the sync control shows. A browser with no copy and no chosen file sees the first-run
 * button, unless its last attempt failed, which it needs to read about. Opening the cache reads as
 * ready, because the copy appears within a moment and a spinner would only flicker.
 */
export function syncStateOf(state: Pick<WorkbookState<WorkbookCopy>, 'status' | 'workbook' | 'choice'>): SyncState {
  switch (state.status) {
    case 'syncing':
      return 'syncing'
    case 'error':
      return 'error'
    default:
      return state.workbook === null && state.choice === null ? 'first-run' : 'ready'
  }
}
