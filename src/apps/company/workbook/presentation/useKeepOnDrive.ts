import { ref } from 'vue'
import type { Ref } from 'vue'
import { useToast } from '@nuxt/ui/composables/useToast'

import { folderTrail } from '../../../../shared/text/folderPath'
import type { PickedFolder } from '../../../../shared/storage/application/workbookPorts'
import { useWorkbook } from '../application/workbookStore'
import type { WorkbookDocument } from '../../../../shared/storage/infrastructure/documentFormat'

/** How the toast words a file made on Drive: new books, or books brought from a file or from this browser, which names how many records moved. */
export type KeptOnDrive = 'created' | 'moved'

export interface KeepOnDrive {
  readonly keeping: Readonly<Ref<boolean>>
  /**
   * Keeps the books in a new file in the folder, from a click, with the folders named made beside it,
   * and says in a toast how it went: the file and where it is for new books, how many records moved
   * for books brought along. Resolves to whether the books are now on Drive. Throws
   * `BooksAlreadyOnDrive` as the store does, with no toast, so the step can offer those books.
   */
  keepOnDrive(folder: PickedFolder, document: WorkbookDocument, kept: KeptOnDrive, folders: readonly string[]): Promise<boolean>
}

export function useKeepOnDrive(): KeepOnDrive {
  const store = useWorkbook()
  const toast = useToast()
  const keeping = ref(false)

  async function keepOnDrive(folder: PickedFolder, document: WorkbookDocument, kept: KeptOnDrive, folders: readonly string[]): Promise<boolean> {
    const before = store.state.choice
    keeping.value = true
    try {
      await store.keepOnDrive(folder.id, document, folders)
    } finally {
      keeping.value = false
    }
    const chosen = store.state.choice
    if (chosen !== before && chosen?.source === 'drive') {
      const where = folder.path === null ? folder.name : folderTrail(folder.path)
      if (kept === 'created') {
        toast.add({ title: `Created ${chosen.name} in ${where}`, description: 'The app keeps a copy in this browser, and a backups folder beside the file.', icon: 'i-lucide-check', color: 'success' })
      } else {
        const records = Object.values(document.records).reduce((sum, kind) => sum + kind.length, 0)
        toast.add({
          title: `Moved ${records} ${records === 1 ? 'record' : 'records'}`,
          description: `${chosen.name} in ${where} holds them. The app read it back and found the same records.`,
          icon: 'i-lucide-check',
          color: 'success',
        })
      }
      return true
    }
    if (store.state.status === 'error') {
      toast.add({ title: 'Not kept on Google Drive', description: store.state.error ?? '', icon: 'i-lucide-triangle-alert', color: 'error', duration: 10_000 })
    }
    return false
  }

  return { keeping, keepOnDrive }
}
