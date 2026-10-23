import { ref } from 'vue'
import type { Ref } from 'vue'
import { useToast } from '@nuxt/ui/composables/useToast'

import { canUndo } from '../application/createWorkbookStore'
import type { SessionWrite } from '../application/createWorkbookStore'
import { useWorkbook } from '../application/workbookStore'
import type { UnitOfWork } from '../application/repository'
import { recordsChangeInWords } from './rowsInWords'

/** How long a toast with Undo stays, so there is time to reach the button. */
const UNDO_TOAST_DURATION = 10_000

export interface RecordWriteOptions {
  /** What the toast says under its title. Defaults to the records written, by their labels. */
  readonly description?: string
  /** A second action beside Undo, such as making a rule from the row just filed. */
  readonly follow?: { readonly label: string; readonly icon: string; readonly run: () => void }
  /** The toast's title when nothing was written. */
  readonly failedTitle?: string
  /** Gives a storage without a place for a kind one, once the person agreed. */
  readonly addMissingKinds?: boolean
}

export interface RecordWrites {
  /** True while a write of this composable is under way. */
  readonly busy: Readonly<Ref<boolean>>
  /**
   * Writes what the work does through its repositories and says so in a toast that names the
   * records, with Undo where the write keeps one, or says why nothing was written. Resolves to
   * whether it went through.
   */
  write(title: string, work: (unit: UnitOfWork) => void, options?: RecordWriteOptions): Promise<boolean>
}

/** Record writes with their toasts: what was written with Undo beside it, or why nothing was. */
export function useRecordWrites(): RecordWrites {
  const store = useWorkbook()
  const toast = useToast()
  const busy = ref(false)

  function refused(title: string, failure: unknown): void {
    toast.add({ title, description: failure instanceof Error ? failure.message : String(failure), icon: 'i-lucide-triangle-alert', color: 'error', duration: UNDO_TOAST_DURATION })
  }

  async function undo(write: SessionWrite): Promise<void> {
    busy.value = true
    try {
      await store.undo(write)
      const undone = store.state.writes[0]
      toast.add({ title: 'Undone', ...(undone === undefined ? {} : { description: recordsChangeInWords(undone.receipt, undone.undid) }), icon: 'i-lucide-undo-2', color: 'neutral' })
    } catch (failure) {
      refused('Not undone', failure)
    } finally {
      busy.value = false
    }
  }

  async function write(title: string, work: (unit: UnitOfWork) => void, options: RecordWriteOptions = {}): Promise<boolean> {
    busy.value = true
    try {
      const receipt = await store.write(title, work, { addMissingKinds: options.addMissingKinds ?? false })
      const recorded = store.state.writes[0]
      if (receipt === null || recorded?.receipt !== receipt) {
        toast.add({ title: 'Nothing changed', description: 'The workbook already holds this.', icon: 'i-lucide-info', color: 'neutral' })
        return true
      }
      toast.add({
        title,
        description: options.description ?? recordsChangeInWords(receipt, null),
        icon: 'i-lucide-check',
        color: 'success',
        duration: UNDO_TOAST_DURATION,
        actions: [
          ...(canUndo(recorded, store.state.writes) ? [{ label: 'Undo', icon: 'i-lucide-undo-2', color: 'neutral' as const, variant: 'outline' as const, onClick: () => void undo(recorded) }] : []),
          ...(options.follow === undefined ? [] : [{ label: options.follow.label, icon: options.follow.icon, color: 'neutral' as const, variant: 'ghost' as const, onClick: options.follow.run }]),
        ],
      })
      return true
    } catch (failure) {
      refused(options.failedTitle ?? 'Nothing was written', failure)
      return false
    } finally {
      busy.value = false
    }
  }

  return { busy, write }
}
