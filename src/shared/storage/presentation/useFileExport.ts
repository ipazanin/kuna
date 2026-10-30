import { ref } from 'vue'
import type { Ref } from 'vue'
import { useToast } from '@nuxt/ui/composables/useToast'

import { exportAppFile } from './exportAppFile'
import type { ExportableStore } from './exportAppFile'

export interface FileExport {
  readonly exporting: Readonly<Ref<boolean>>
  /** Downloads the app's file and says so, or says why it could not. */
  exportNow(): Promise<void>
}

/** One export button's behaviour for an app's file, shared by the top bar and the app's Settings. */
export function useFileExport(store: ExportableStore, app: string, words: { readonly nothingToExport: string; readonly exported: string; readonly exportFailed: string }): FileExport {
  const toast = useToast()
  const exporting = ref(false)
  return {
    exporting,
    async exportNow() {
      if (exporting.value) return
      exporting.value = true
      try {
        const fileName = await exportAppFile(store, app, words.nothingToExport)
        toast.add({ title: words.exported, description: fileName, icon: 'i-lucide-download', color: 'success' })
      } catch (failure) {
        toast.add({ title: words.exportFailed, description: failure instanceof Error ? failure.message : String(failure), icon: 'i-lucide-triangle-alert', color: 'error' })
      } finally {
        exporting.value = false
      }
    },
  }
}
