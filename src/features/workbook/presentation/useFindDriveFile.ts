import { useToast } from '@nuxt/ui/composables/useToast'

import { useWorkbook } from '../application/workbookStore'

export interface FindDriveFile {
  /**
   * Finds the books on Drive, by the app's mark or else in the Picker, and says in a toast which
   * file is now open and in which folder, or that it was open already. Resolves to whether the
   * books on screen are a Drive file. A cancelled Picker says nothing.
   */
  findDriveFile(): Promise<boolean>
}

export function useFindDriveFile(): FindDriveFile {
  const store = useWorkbook()
  const toast = useToast()

  async function findDriveFile(): Promise<boolean> {
    const before = store.state.choice
    await store.chooseDriveFile()
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
        ? `${chosen.name} ${where} is the file on screen, read again just now. To open another file, use Open a file.`
        : `The app found ${chosen.name} ${where} and keeps a copy in this browser.`,
      icon: 'i-lucide-check',
      color: 'success',
    })
    return true
  }

  return { findDriveFile }
}
