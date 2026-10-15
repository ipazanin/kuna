import { onMounted, ref, shallowRef } from 'vue'
import type { Ref, ShallowRef } from 'vue'

import { loadSelectedWorkbook } from '../infrastructure/selectedWorkbook'
import { openWorkbookCache } from '../infrastructure/workbookCache'
import type { WorkbookSnapshot } from '../infrastructure/workbookSnapshot'

export interface CachedWorkbook {
  readonly snapshot: Readonly<ShallowRef<WorkbookSnapshot | null>>
  readonly loaded: Readonly<Ref<boolean>>
}

/** The copy of the selected workbook this browser holds, read once when the screen mounts. */
export function useCachedWorkbook(): CachedWorkbook {
  const snapshot = shallowRef<WorkbookSnapshot | null>(null)
  const loaded = ref(false)

  onMounted(async () => {
    const selected = loadSelectedWorkbook()
    if (selected !== null) {
      const cache = openWorkbookCache(selected.id)
      try {
        snapshot.value = await cache.read()
      } finally {
        cache.close()
      }
    }
    loaded.value = true
  })

  return { snapshot, loaded }
}
