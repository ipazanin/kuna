import { useToast } from '@nuxt/ui/composables/useToast'

import { useWorkbook } from '../application/workbookStore'
import type { RedirectGrant, RedirectReturn } from '../../../shared/google/googleRedirect'

const REFUSED_TITLES: Readonly<Record<RedirectGrant, string>> = {
  'sign-in': 'Not signed in to Google',
  gmail: 'No Gmail access',
  'drive-read': 'No Drive read access',
}

/**
 * Picks up after a redirect sign-in: runs `sync` or opens the Picker when that is what the person
 * tapped, and otherwise says what happened, since anything else they started did not run while the
 * tab was at Google. The silent ask for the Drive read token as the app opened shows nothing either
 * way, and auto-sync carries on. Call it before auto-sync starts, so a Picker to open goes first.
 */
export function useGoogleReturn(answer: RedirectReturn | null, sync: () => Promise<void>): void {
  if (answer === null || answer.silent) {
    return
  }
  const toast = useToast()
  const store = useWorkbook()
  if (answer.kind === 'refused') {
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
