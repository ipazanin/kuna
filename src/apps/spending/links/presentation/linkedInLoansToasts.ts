import type { useToast } from '@nuxt/ui/composables/useToast'

import type { RecordLinked, UndoneInLoans } from '../application/linkWithRecord'
import type { LinkTarget } from '../domain/linkTarget'
import { choiceText, words } from './words'
import { writeFailureInWords } from '../../../../shared/storage/presentation/writeFailureInWords'
import { UNDO_TOAST_DURATION } from '../../../../shared/storage/presentation/useRecordWrites'
import { words as storageWords } from '../../../../shared/storage/presentation/words'

/** What the toasts say of a record added in Loans and the row linked to it. */
export interface LinkedInLoansWords {
  readonly done: string
  readonly notAdded: string
  readonly notLinked: string
  staysInLoans(reason: string): string
  readonly undone: string
  keptInLoans(reason: string): string
}

type Toasts = ReturnType<typeof useToast>

async function undoing(toast: Toasts, undo: () => Promise<void>): Promise<void> {
  try {
    await undo()
    toast.add({ title: storageWords.undone, icon: 'i-lucide-undo-2', color: 'neutral' })
  } catch (failure) {
    toast.add({ title: words.notUndone, description: writeFailureInWords(failure), icon: 'i-lucide-triangle-alert', color: 'error' })
  }
}

async function undoBoth(toast: Toasts, texts: LinkedInLoansWords, undo: () => Promise<UndoneInLoans>): Promise<void> {
  try {
    const undone = await undo()
    if (undone.kept) toast.add({ title: storageWords.undone, description: texts.keptInLoans(writeFailureInWords(undone.failure)), icon: 'i-lucide-undo-2', color: 'warning' })
    else toast.add({ title: storageWords.undone, description: texts.undone, icon: 'i-lucide-undo-2', color: 'neutral' })
  } catch (failure) {
    toast.add({ title: words.notUndone, description: writeFailureInWords(failure), icon: 'i-lucide-triangle-alert', color: 'error' })
  }
}

/**
 * Says what adding a record in Loans and linking the row came to, with Undo for what was written. Gives whether anything was
 * written, which closes the form.
 */
export function toastLinkedInLoans(toast: Toasts, result: RecordLinked<LinkTarget>, texts: LinkedInLoansWords): boolean {
  if (result.outcome === 'not-added') {
    toast.add({ title: texts.notAdded, description: writeFailureInWords(result.failure), icon: 'i-lucide-triangle-alert', color: 'error' })
    return false
  }
  if (result.outcome === 'not-linked') {
    toast.add({
      title: texts.notLinked,
      description: texts.staysInLoans(writeFailureInWords(result.failure)),
      duration: UNDO_TOAST_DURATION,
      icon: 'i-lucide-triangle-alert',
      color: 'warning',
      actions: [{ label: storageWords.undo, icon: 'i-lucide-undo-2', color: 'neutral', variant: 'outline', onClick: () => void undoing(toast, result.undoInLoans) }],
    })
    return true
  }
  toast.add({
    title: texts.done,
    description: choiceText(result.record),
    duration: UNDO_TOAST_DURATION,
    icon: 'i-lucide-check',
    color: 'success',
    actions: [{ label: storageWords.undo, icon: 'i-lucide-undo-2', color: 'neutral', variant: 'outline', onClick: () => void undoBoth(toast, texts, result.undo) }],
  })
  return true
}
