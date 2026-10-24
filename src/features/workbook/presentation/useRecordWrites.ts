import { ref } from 'vue'
import type { Ref } from 'vue'
import { useToast } from '@nuxt/ui/composables/useToast'

import { canUndo } from '../application/createWorkbookStore'
import type { SessionWrite } from '../application/createWorkbookStore'
import type { WriteReceipt } from '../application/recordWrites'
import { useWorkbook } from '../application/workbookStore'
import type { UnitOfWork } from '../application/repository'
import { WorkbookWriteRefused } from '../application/workbookWriteRefused'
import { recordsChangeInWords } from './rowsInWords'

/** How long a toast with Undo stays, so there is time to reach the button. */
const UNDO_TOAST_DURATION = 10_000

export interface RecordWriteOptions {
  /** What the toast says under its title. Defaults to the records written, by their labels. */
  readonly description?: string
  /** A second action beside Undo, such as making a rule from the row just filed. */
  readonly follow?: { readonly label: string; readonly icon: string; readonly run: () => void }
  /** The toast's title when the write was refused, so nothing was written. */
  readonly failedTitle?: string
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
  /** Says in a toast what a write of this session did, under its title, with Undo where it keeps one. */
  announce(receipt: WriteReceipt, options?: Pick<RecordWriteOptions, 'description' | 'follow'>): void
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

  function announce(receipt: WriteReceipt, options: Pick<RecordWriteOptions, 'description' | 'follow'> = {}): void {
    const recorded = store.state.writes.find((written) => written.receipt === receipt)
    if (recorded === undefined) return
    toast.add({
      title: receipt.title,
      description: options.description ?? recordsChangeInWords(receipt, null),
      icon: 'i-lucide-check',
      color: 'success',
      duration: UNDO_TOAST_DURATION,
      actions: [
        ...(canUndo(recorded, store.state.writes) ? [{ label: 'Undo', icon: 'i-lucide-undo-2', color: 'neutral' as const, variant: 'outline' as const, onClick: () => void undo(recorded) }] : []),
        ...(options.follow === undefined ? [] : [{ label: options.follow.label, icon: options.follow.icon, color: 'neutral' as const, variant: 'ghost' as const, onClick: options.follow.run }]),
      ],
    })
  }

  async function write(title: string, work: (unit: UnitOfWork) => void, options: RecordWriteOptions = {}): Promise<boolean> {
    busy.value = true
    try {
      const receipt = await store.write(title, work)
      if (receipt === null || store.state.writes[0]?.receipt !== receipt) {
        toast.add({ title: 'Nothing changed', description: 'The workbook already holds this.', icon: 'i-lucide-info', color: 'neutral' })
        return true
      }
      announce(receipt, options)
      return true
    } catch (failure) {
      // Any other failure may come after the file took the save, such as an edit from outside the app during it.
      refused(failure instanceof WorkbookWriteRefused ? (options.failedTitle ?? 'Nothing was written') : 'The save may not have finished', failure)
      return false
    } finally {
      busy.value = false
    }
  }

  return { busy, write, announce }
}
