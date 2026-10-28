import type { RedirectReturn } from '../../shared/google/googleRedirect'
import { startAutoSync } from '../../shared/sync/application/autoSync'
import { autoSyncOn } from '../../shared/sync/infrastructure/autoSyncSwitch'
import type { PageSync } from '../../shared/sync/presentation/pageSync'

/**
 * Runs the sync a tap's trip to Google left the page for, then syncs by itself as the page opens
 * and on each return to it, when due. Call it after the apps start, so a Picker an app's return
 * opens goes first. Returns the function that stops it.
 */
export function keepPageSynced(sync: PageSync, googleReturn: RedirectReturn | null): () => void {
  const stores = sync.groups.map((group) => group.store)
  if (googleReturn?.kind === 'granted' && googleReturn.ask === 'tap' && googleReturn.resume === 'sync') {
    void Promise.all(stores.map((store) => store.open())).then(sync.sync)
  }
  return startAutoSync({
    stores,
    sync: sync.sync,
    switchedOn: () => autoSyncOn.value,
    now: () => Date.now(),
    online: () => navigator.onLine,
    onVisible(callback) {
      const onVisibilityChange = (): void => {
        if (document.visibilityState === 'visible') callback()
      }
      document.addEventListener('visibilitychange', onVisibilityChange)
      return () => document.removeEventListener('visibilitychange', onVisibilityChange)
    },
  })
}
