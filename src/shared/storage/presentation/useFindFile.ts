import { useToast } from '@nuxt/ui/composables/useToast'

import type { BooksRead, WorkbookStore } from '../application/createWorkbookStore'
import type { DriveFileLookup } from '../application/workbookPorts'
import type { WorkbookDocument } from '../infrastructure/documentFormat'
import type { DocumentCopy } from '../infrastructure/documentRecordStorage'

export interface FindFileWords {
  readonly notOpened: string
  readonly alreadyOpen: string
  readonly alreadyOpenNote: (name: string) => string
  readonly opened: (name: string) => string
  readonly openedNote: (name: string) => string
}

/**
 * Opens the app's file on Drive, found by the app's mark or picked, as `lookup` says, and says in a toast which
 * file is now open, or why none did. A cancelled Picker says nothing. Resolves to whether the find put a Drive file on screen.
 */
export function useFindFile(store: Pick<WorkbookStore<BooksRead, DocumentCopy, WorkbookDocument>, 'state' | 'chooseDriveFile'>, words: FindFileWords): (lookup: DriveFileLookup) => Promise<boolean> {
  const toast = useToast()

  return async (lookup) => {
    const before = store.state.choice
    await store.chooseDriveFile(lookup)
    const chosen = store.state.choice
    if (store.state.status === 'error') {
      toast.add({ title: words.notOpened, description: store.state.error ?? '', icon: 'i-lucide-triangle-alert', color: 'error', duration: 10_000 })
      return false
    }
    if (chosen?.source !== 'drive' || chosen === before) {
      return false
    }
    const already = before?.source === 'drive' && before.id === chosen.id
    toast.add({
      title: already ? words.alreadyOpen : words.opened(chosen.name),
      description: already ? words.alreadyOpenNote(chosen.name) : words.openedNote(chosen.name),
      icon: 'i-lucide-check',
      color: 'success',
    })
    return true
  }
}
