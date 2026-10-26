import { useToast } from '@nuxt/ui/composables/useToast'

import { useWorkbook } from '../application/workbookStore'
import { useFindDriveFile } from './useFindDriveFile'
import type { RedirectGrant, RedirectReturn } from '../../../shared/google/googleRedirect'

const REFUSED_TITLES: Readonly<Record<Exclude<RedirectGrant, 'drive-read'>, string>> = {
  'sign-in': 'Not signed in to Google',
  gmail: 'No Gmail access',
}

/**
 * Picks up after a redirect sign-in: runs `sync`, finds the books or opens the Picker when that is
 * what the person tapped, and otherwise says what happened, since anything else they started did
 * not run while the tab was at Google. The Drive read grant shows nothing either way: as the app
 * opened auto-sync carries on, and otherwise the sync it resumes runs now, whose control shows
 * Allow access when Google gave no token. Call it before auto-sync starts, so a Picker to open goes first.
 */
export function useGoogleReturn(answer: RedirectReturn | null, sync: () => Promise<void>): void {
  if (answer === null || answer.ask === 'silent-on-open') {
    return
  }
  const toast = useToast()
  const store = useWorkbook()
  const { findDriveFile } = useFindDriveFile()
  if (answer.kind === 'refused' && answer.ask === 'tap' && answer.grant !== 'drive-read') {
    toast.add({
      title: REFUSED_TITLES[answer.grant ?? 'sign-in'],
      description: answer.message,
      icon: 'i-lucide-triangle-alert',
      color: 'error',
      duration: 10_000,
    })
    return
  }
  if (answer.grant === 'gmail') {
    toast.add({
      title: 'Gmail drafts allowed',
      description: 'Make the invoice again to save its draft. Nothing was filed or written before Google asked.',
      icon: 'i-lucide-mail-check',
      color: 'success',
      duration: 10_000,
    })
    return
  }
  switch (answer.resume) {
    case 'sync':
      void store.open().then(sync)
      return
    case 'find':
    case 'pick': {
      const lookup = answer.resume
      void store.open().then(() => findDriveFile(lookup))
      return
    }
    case 'none':
      toast.add({
        title: 'Signed in to Google',
        description: 'What you tapped did not run while the app was at Google. Tap it again.',
        icon: 'i-lucide-log-in',
        color: 'success',
        duration: 10_000,
      })
  }
}
