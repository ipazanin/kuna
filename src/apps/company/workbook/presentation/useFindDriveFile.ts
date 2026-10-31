import { useToast } from '@nuxt/ui/composables/useToast'

import { useWorkbook } from '../application/workbookStore'
import type { DriveFileLookup } from '../../../../shared/storage/application/workbookPorts'
import { words } from './words'

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
      toast.add({ title: words.find.notOpened, description: store.state.error ?? '', icon: 'i-lucide-triangle-alert', color: 'error', duration: 10_000 })
      return false
    }
    if (chosen?.source !== 'drive' || chosen === before) {
      return false
    }
    const place = await store.driveFilePlace().catch(() => null)
    const where = place === null ? words.find.onDrive : words.find.inFolder(place.folderName)
    const already = before?.source === 'drive' && before.id === chosen.id
    toast.add({
      title: already ? words.find.alreadyOpen : words.find.opened(chosen.name),
      description: already ? words.find.readAgain(chosen.name, where) : words.find.onScreen(chosen.name, where),
      icon: 'i-lucide-check',
      color: 'success',
    })
    return true
  }

  return { findDriveFile }
}
