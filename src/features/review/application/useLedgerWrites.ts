import { ref } from 'vue'
import type { Ref } from 'vue'
import { useToast } from '@nuxt/ui/composables/useToast'

import { useWorkbook } from '../../workbook/application/workbookStore'
import type { LedgerVerdictChange, VerdictReceipt } from '../domain/verdictChanges'

/** How long a toast with Undo stays, so there is time to reach the button. */
const UNDO_TOAST_DURATION = 10_000

export interface LedgerWriteToast {
  readonly title: string
  readonly description?: string
  /** A second action beside Undo, such as making a rule from the row just filed. */
  readonly follow?: { readonly label: string; readonly icon: string; readonly run: () => void }
}

export interface LedgerWrites {
  /** True while a write of this screen is under way. */
  readonly busy: Readonly<Ref<boolean>>
  /** Writes the changes and offers Undo. Resolves to whether they were written. */
  write(changes: readonly LedgerVerdictChange[], done: LedgerWriteToast): Promise<boolean>
  /** Puts back what the receipt's write replaced, and says in a toast whether it could. */
  undo(receipt: VerdictReceipt): Promise<void>
}

/** Ledger writes with their toasts: what was written with Undo beside it, or why nothing was. */
export function useLedgerWrites(): LedgerWrites {
  const store = useWorkbook()
  const toast = useToast()
  const busy = ref(false)

  function refused(title: string, failure: unknown): void {
    toast.add({ title, description: failure instanceof Error ? failure.message : String(failure), icon: 'i-lucide-triangle-alert', color: 'error', duration: UNDO_TOAST_DURATION })
  }

  async function undo(receipt: VerdictReceipt): Promise<void> {
    busy.value = true
    try {
      await store.undoVerdicts(receipt)
      toast.add({ title: 'Undone', description: receipt.changes.length === 1 ? 'The row is back as it was.' : `${receipt.changes.length} rows are back as they were.`, icon: 'i-lucide-undo-2', color: 'neutral' })
    } catch (failure) {
      refused('Not undone', failure)
    } finally {
      busy.value = false
    }
  }

  return {
    busy,
    undo,
    async write(changes, done) {
      busy.value = true
      try {
        const receipt = await store.setVerdicts(changes)
        toast.add({
          title: done.title,
          ...(done.description === undefined ? {} : { description: done.description }),
          icon: 'i-lucide-check',
          color: 'success',
          duration: UNDO_TOAST_DURATION,
          actions: [
            { label: 'Undo', icon: 'i-lucide-undo-2', color: 'neutral', variant: 'outline', onClick: () => void undo(receipt) },
            ...(done.follow === undefined ? [] : [{ label: done.follow.label, icon: done.follow.icon, color: 'neutral' as const, variant: 'ghost' as const, onClick: done.follow.run }]),
          ],
        })
        return true
      } catch (failure) {
        refused('Not written', failure)
        return false
      } finally {
        busy.value = false
      }
    },
  }
}
