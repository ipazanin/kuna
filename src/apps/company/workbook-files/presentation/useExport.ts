import { ref } from 'vue'
import type { Ref } from 'vue'
import { useToast } from '@nuxt/ui/composables/useToast'

import { useWorkbook } from '../../workbook/application/workbookStore'
import { exportWorkbook } from '../../workbook/presentation/workbookFiles'
import { words } from './words'

export interface ExportAction {
  readonly exporting: Readonly<Ref<boolean>>
  /** Writes the workbook to a file and says so, or says why it could not. */
  exportNow(): Promise<void>
}

/** One export button's behaviour, shared by the status bar, Settings and the switch dialog. */
export function useExport(): ExportAction {
  const store = useWorkbook()
  const toast = useToast()
  const exporting = ref(false)
  return {
    exporting,
    async exportNow() {
      if (exporting.value) return
      exporting.value = true
      try {
        const fileName = await exportWorkbook(store)
        toast.add({ title: words.exported, description: fileName, icon: 'i-lucide-download', color: 'success' })
      } catch (failure) {
        toast.add({ title: words.exportFailed, description: failure instanceof Error ? failure.message : String(failure), icon: 'i-lucide-triangle-alert', color: 'error' })
      } finally {
        exporting.value = false
      }
    },
  }
}
