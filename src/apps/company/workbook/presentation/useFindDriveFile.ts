import { useToast } from '@nuxt/ui/composables/useToast'

import { useWorkbook } from '../application/workbookStore'
import type { DriveFileLookup } from '../../../../shared/storage/application/workbookPorts'

export interface FindDriveFile {
  /**
   * Opens the books on Drive, found by the app's mark or picked, as `lookup` says, and says in a
   * toast which file is now open and in which folder, or that it was open already. Resolves to
   * whether the books on screen are a Drive file. A cancelled Picker says nothing.
   */
  findDriveFile(lookup: DriveFileLookup): Promise<boolean>
}

export function useFindDriveFile(): FindDriveFile {
  const store = useWorkbook()
  const toast = useToast()

  async function findDriveFile(lookup: DriveFileLookup): Promise<boolean> {
    const before = store.state.choice
    await store.chooseDriveFile(lookup)
    const chosen = store.state.choice
    if (store.state.status === 'error') {
      toast.add({ title: 'Your books were not opened', description: store.state.error ?? '', icon: 'i-lucide-triangle-alert', color: 'error', duration: 10_000 })
      return false
    }
    if (chosen?.source !== 'drive' || chosen === before) {
      return false
    }
    const place = await store.driveFilePlace().catch(() => null)
    const where = place === null ? 'on Google Drive' : `in ${place.folderName} on Google Drive`
    const already = before?.source === 'drive' && before.id === chosen.id
    toast.add({
      title: already ? 'Your books are already open' : `Opened ${chosen.name}`,
      description: already
        ? `${chosen.name} ${where} is the file on screen, read again just now. To open a different file, use Pick another file.`
        : `${chosen.name} ${where} is on screen now, and the app keeps a copy in this browser.`,
      icon: 'i-lucide-check',
      color: 'success',
    })
    return true
  }

  return { findDriveFile }
}
