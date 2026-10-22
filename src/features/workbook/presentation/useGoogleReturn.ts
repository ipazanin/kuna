import { useToast } from '@nuxt/ui/composables/useToast'

import { useWorkbook } from '../application/workbookStore'
import type { RedirectReturn } from '../../../shared/google/googleRedirect'

/**
 * Picks up after a redirect sign-in: reads the Sheet again or opens the Picker when that is what the
 * person tapped, and otherwise says what happened, since anything else they started did not run
 * while the tab was at Google. Call it before auto-sync starts, so a Picker to open goes first.
 */
export function useGoogleReturn(answer: RedirectReturn | null): void {
  if (answer === null) {
    return
  }
  const toast = useToast()
  const store = useWorkbook()
  if (answer.kind === 'refused') {
    toast.add({
      title: answer.grant === 'gmail' ? 'No Gmail access' : 'Not signed in to Google',
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
      void store.open().then(() => store.sync())
      return
    case 'pick':
      void store.open().then(() => store.chooseGoogleSheet())
      return
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
