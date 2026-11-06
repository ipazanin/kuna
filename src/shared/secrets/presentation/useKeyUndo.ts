import { useToast } from '@nuxt/ui/composables/useToast'

import { words } from './words'

/** How long the toast stays, so there is time to reach Undo. */
const UNDO_TOAST_DURATION = 10_000

/** Says a key was removed or replaced, with Undo beside it for the toast's whole life. */
export function useKeyUndo(): (title: string, undo: () => void) => void {
  const toast = useToast()
  return (title, undo) => {
    toast.add({
      title,
      icon: 'i-lucide-key-round',
      color: 'neutral',
      duration: UNDO_TOAST_DURATION,
      actions: [{ label: words.keyRow.undo, icon: 'i-lucide-undo-2', color: 'neutral', variant: 'outline', onClick: undo }],
    })
  }
}
