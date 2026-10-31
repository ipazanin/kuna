import { computed, ref } from 'vue'
import type { Ref } from 'vue'
import { useToast } from '@nuxt/ui/composables/useToast'

import { canUndo } from '../application/createWorkbookStore'
import type { BooksRead, SessionWrite, WorkbookStore } from '../application/createWorkbookStore'
import type { WriteReceipt } from '../application/recordWrites'
import type { UnitOfWork } from '../application/repository'
import { WorkbookWriteRefused } from '../application/workbookWriteRefused'
import { recordsChangeInWords } from './recordsChangeInWords'
import { words } from './words'

/** How long a toast with Undo stays, so there is time to reach the button. */
const UNDO_TOAST_DURATION = 10_000

export interface RecordWriteOptions {
  /** What the toast says under its title. Defaults to the records written, by their labels. */
  readonly description?: string
  /** A second action beside Undo, such as making a rule from the row just filed. */
  readonly follow?: { readonly label: string; readonly icon: string; readonly run: () => void }
  /** The toast's title when the write was refused, so nothing was written. */
  readonly failedTitle?: string
  /** Names the control that started the write, so `saving(key)` is true for that control alone while it runs. Defaults to `save`. */
  readonly key?: string
}

/** Whether the write that the key names is under way. */
export type WriteSaving = (key: string) => boolean

/** The key a write without its own is under, so a dialog's Save binds `saving('save')`. */
const SAVE_KEY = 'save'

export interface RecordWrites {
  /** True while a write of this composable is under way. */
  readonly busy: Readonly<Ref<boolean>>
  /** True while the write that `key` names is under way, for the control that started it to spin. An undo is under `undo-` and the write's id. */
  readonly saving: WriteSaving
  /**
   * Writes what the work does through its repositories and says so in a toast that names the
   * records, with Undo where the write keeps one, or says why nothing was written. Resolves to
   * whether it went through.
   */
  write(title: string, work: (unit: UnitOfWork) => void, options?: RecordWriteOptions): Promise<boolean>
  /** Says in a toast what a write of this session did, under its title, with Undo where it keeps one. */
  announce(receipt: WriteReceipt, options?: Pick<RecordWriteOptions, 'description' | 'follow'>): void
  /** Puts back what a write of this session changed, and says so in a toast, or why it could not. */
  undo(write: SessionWrite): Promise<void>
}

/** Record writes to the store's file with their toasts: what was written with Undo beside it, or why nothing was. */
export function useRecordWrites(store: Pick<WorkbookStore<BooksRead>, 'state' | 'write' | 'undo'>): RecordWrites {
  const toast = useToast()
  const running = ref<string | null>(null)
  const busy = computed(() => running.value !== null)
  const saving: WriteSaving = (key) => running.value === key

  function refused(title: string, failure: unknown): void {
    toast.add({ title, description: failure instanceof Error ? failure.message : String(failure), icon: 'i-lucide-triangle-alert', color: 'error', duration: UNDO_TOAST_DURATION })
  }

  async function undo(write: SessionWrite): Promise<void> {
    running.value = `undo-${write.id}`
    try {
      await store.undo(write)
      const undone = store.state.writes[0]
      toast.add({ title: words.undone, ...(undone === undefined ? {} : { description: recordsChangeInWords(undone.receipt, undone.undid) }), icon: 'i-lucide-undo-2', color: 'neutral' })
    } catch (failure) {
      refused(words.notUndone, failure)
    } finally {
      running.value = null
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
        ...(canUndo(recorded, store.state.writes) ? [{ label: words.undo, icon: 'i-lucide-undo-2', color: 'neutral' as const, variant: 'outline' as const, onClick: () => void undo(recorded) }] : []),
        ...(options.follow === undefined ? [] : [{ label: options.follow.label, icon: options.follow.icon, color: 'neutral' as const, variant: 'ghost' as const, onClick: options.follow.run }]),
      ],
    })
  }

  async function write(title: string, work: (unit: UnitOfWork) => void, options: RecordWriteOptions = {}): Promise<boolean> {
    running.value = options.key ?? SAVE_KEY
    try {
      const receipt = await store.write(title, work)
      if (receipt === null || store.state.writes[0]?.receipt !== receipt) {
        toast.add({ title: words.nothingChanged, description: words.alreadyHeld, icon: 'i-lucide-info', color: 'neutral' })
        return true
      }
      announce(receipt, options)
      return true
    } catch (failure) {
      // Any other failure may come after the file took the save, such as an edit from outside the app during it.
      refused(failure instanceof WorkbookWriteRefused ? (options.failedTitle ?? words.nothingWritten) : words.mayNotHaveFinished, failure)
      return false
    } finally {
      running.value = null
    }
  }

  return { busy, saving, write, announce, undo }
}
