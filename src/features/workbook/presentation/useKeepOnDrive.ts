import { ref } from 'vue'
import type { Ref } from 'vue'
import { useToast } from '@nuxt/ui/composables/useToast'

import { useWorkbook } from '../application/workbookStore'
import type { WorkbookDocument } from '../infrastructure/documentFormat'

export interface KeepOnDrive {
  readonly keeping: Readonly<Ref<boolean>>
  /**
   * Keeps the books in a new file in a Drive folder the person picks, from a click, and says in a
   * toast how it went. The toast names how many records moved once the file read back the same.
   * Resolves to whether the books are now on Drive. A cancelled Picker says nothing.
   */
  keepOnDrive(document: WorkbookDocument): Promise<boolean>
}

export function useKeepOnDrive(): KeepOnDrive {
  const store = useWorkbook()
  const toast = useToast()
  const keeping = ref(false)

  async function keepOnDrive(document: WorkbookDocument): Promise<boolean> {
    const before = store.state.choice
    keeping.value = true
    try {
      await store.keepOnDrive(document)
    } finally {
      keeping.value = false
    }
    const chosen = store.state.choice
    if (chosen !== before && chosen?.source === 'drive') {
      const records = Object.values(document.records).reduce((sum, kind) => sum + kind.length, 0)
      toast.add({
        title: `Moved ${records} ${records === 1 ? 'record' : 'records'}`,
        description: `${chosen.name} on Google Drive holds them. The app read it back and found the same records.`,
        icon: 'i-lucide-check',
        color: 'success',
      })
      return true
    }
    if (store.state.status === 'error') {
      toast.add({ title: 'Not kept on Google Drive', description: store.state.error ?? '', icon: 'i-lucide-triangle-alert', color: 'error', duration: 10_000 })
    }
    return false
  }

  return { keeping, keepOnDrive }
}
