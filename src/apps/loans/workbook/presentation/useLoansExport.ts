import { ref } from 'vue'
import type { Ref } from 'vue'
import { useToast } from '@nuxt/ui/composables/useToast'

import { useLoansBooks } from '../application/loansStore'
import { exportLoansFile } from './loansFile'

export interface LoansExport {
  readonly exporting: Readonly<Ref<boolean>>
  /** Downloads the Loans file and says so, or says why it could not. */
  exportNow(): Promise<void>
}

/** One export button's behaviour, shared by the top bar and the Loans Settings. */
export function useLoansExport(): LoansExport {
  const store = useLoansBooks()
  const toast = useToast()
  const exporting = ref(false)
  return {
    exporting,
    async exportNow() {
      if (exporting.value) return
      exporting.value = true
      try {
        const fileName = await exportLoansFile(store)
        toast.add({ title: 'Exported', description: fileName, icon: 'i-lucide-download', color: 'success' })
      } catch (failure) {
        toast.add({ title: 'Export failed', description: failure instanceof Error ? failure.message : String(failure), icon: 'i-lucide-triangle-alert', color: 'error' })
      } finally {
        exporting.value = false
      }
    },
  }
}
