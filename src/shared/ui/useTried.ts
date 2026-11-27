import { readonly, ref, watch } from 'vue'
import type { Ref, WatchSource } from 'vue'

/**
 * Whether Save was pressed on a form, so its problems show only from then on. It clears each time `open` turns true, so a
 * dialog never opens on the red fields of its last opening. A form that lives only while its dialog is open passes no `open`.
 */
export function useTried(open?: WatchSource<boolean>): { tried: Readonly<Ref<boolean>>; markTried: () => void; clearTried: () => void } {
  const tried = ref(false)
  if (open !== undefined) {
    watch(open, (opened) => {
      if (opened) tried.value = false
    })
  }
  return {
    tried: readonly(tried),
    markTried: () => {
      tried.value = true
    },
    clearTried: () => {
      tried.value = false
    },
  }
}
