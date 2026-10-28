import { useToast } from '@nuxt/ui/composables/useToast'

import type { DriveFileLookup } from '../../../../shared/storage/application/workbookPorts'
import { useLoansBooks } from '../application/loansStore'

/**
 * Opens the Loans file on Drive, found by the app's mark or picked, as `lookup` says, and says in a
 * toast which file is now open, or why none did. A cancelled Picker says nothing. Resolves to whether
 * the find put a Drive file on screen.
 */
export function useFindLoansFile(): (lookup: DriveFileLookup) => Promise<boolean> {
  const store = useLoansBooks()
  const toast = useToast()

  return async (lookup) => {
    const before = store.state.choice
    await store.chooseDriveFile(lookup)
    const chosen = store.state.choice
    if (store.state.status === 'error') {
      toast.add({ title: 'The Loans file was not opened', description: store.state.error ?? '', icon: 'i-lucide-triangle-alert', color: 'error', duration: 10_000 })
      return false
    }
    if (chosen?.source !== 'drive' || chosen === before) {
      return false
    }
    const already = before?.source === 'drive' && before.id === chosen.id
    toast.add({
      title: already ? 'Your Loans file is already open' : `Opened ${chosen.name}`,
      description: already ? `${chosen.name} on Google Drive is the file on screen, read again just now.` : `${chosen.name} on Google Drive is on screen now, and the app keeps a copy in this browser.`,
      icon: 'i-lucide-check',
      color: 'success',
    })
    return true
  }
}
