import { computed, ref } from 'vue'
import type { Ref } from 'vue'
import { useToast } from '@nuxt/ui/composables/useToast'

import { withGoogleAccess } from '../../google/withGoogleAccess'
import { canUndo } from '../application/createWorkbookStore'
import type { BooksRead, SessionWrite, WorkbookStore } from '../application/createWorkbookStore'
import type { WriteReceipt } from '../application/recordWrites'
import type { UnitOfWork } from '../application/repository'
import { WorkbookWriteRefused } from '../application/workbookWriteRefused'
import { recordsChangeInWords } from './recordsChangeInWords'
import { words } from './words'
import { failedOnDrive, writeFailureInWords } from './writeFailureInWords'

/** How long a toast with Undo stays, so there is time to reach the button. */
const UNDO_TOAST_DURATION = 10_000

export interface RecordWriteOptions {
  /** What the toast says under its title. Defaults to the records written, by their labels. */
  readonly description?: string
  /** True when the title already counts what the write changed, so the toast adds no line naming the records. */
  readonly titleCounts?: boolean
  /** A second action beside Undo, such as making a rule from the row just filed. */
  readonly follow?: { readonly label: string; readonly icon: string; readonly run: () => void }
  /** The toast's title when the write was refused, so nothing was written. */
  readonly failedTitle?: string
  /** For a one-tap control whose value is on it: the screen shows the change from the tap, and a failure flips it back. A dialog or a form's Save leaves it out and changes the screen when it lands. */
  readonly shownAtOnce?: boolean
  /** Names the control that started the write, so `saving(key)` is true for that control alone while it waits or runs. Unique within the file. Defaults to `save`, which is this composable's own. */
  readonly key?: string
}

/** Whether the write that the key names is waiting or running. */
export type WriteSaving = (key: string) => boolean

/** The key a write without its own is under, so a dialog's Save binds `saving('save')`. */
const SAVE_KEY = 'save'

let composablesMade = 0

const DRIVE_FAILED_TOAST = 'drive-failed'
let titlesFailedOnDrive: readonly string[] = []

export interface RecordWrites {
  /** True while a write of this composable waits or runs. */
  readonly busy: Readonly<Ref<boolean>>
  /** True while the write that `key` names waits or runs, for the control that started it to spin, even on a screen left and reopened. An undo is under `undo-` and the write's id. */
  readonly saving: WriteSaving
  /**
   * Writes what the work does through its repositories and says so in a toast that names the
   * records, with Undo where the write keeps one, or says why nothing was written. Resolves to
   * whether it went through.
   */
  write(title: string, work: (unit: UnitOfWork) => void, options?: RecordWriteOptions): Promise<boolean>
  /** Says in a toast what a write of this session did, under its title, with Undo where it keeps one. */
  announce(receipt: WriteReceipt, options?: Pick<RecordWriteOptions, 'description' | 'follow' | 'titleCounts'>): void
  /** Puts back what a write of this session changed, and says so in a toast, or why it could not. */
  undo(write: SessionWrite): Promise<void>
}

/**
 * Record writes to the store's file with their toasts: what was written with Undo beside it, or why nothing was. A write or an undo
 * that finds the page's Google access lapsed, as on a phone, asks Google and goes again.
 */
export function useRecordWrites(store: Pick<WorkbookStore<BooksRead>, 'state' | 'write' | 'undo'>): RecordWrites {
  const toast = useToast()
  const running = ref(0)
  const busy = computed(() => running.value > 0)
  composablesMade += 1
  const ownSaveKey = `save-${composablesMade}`
  const queueKey = (key: string): string => (key === SAVE_KEY ? ownSaveKey : key)
  const saving: WriteSaving = (key) => store.state.waiting.some((waiting) => waiting.keys.includes(queueKey(key)))

  /**
   * Says why a write failed. Writes that fail on Drive share one toast that names each, since a queue offline would otherwise
   * say the same sentence once for each. A refused write gives its reason under the title alone, since its title says what it
   * would have done. A write that may not have finished and an undo name the write.
   */
  function refused(title: string, failure: unknown, writeTitle: string, naming: 'drive-only' | 'always'): void {
    const shared = { title, icon: 'i-lucide-triangle-alert', color: 'error' as const, duration: UNDO_TOAST_DURATION }
    if (failedOnDrive(failure)) {
      titlesFailedOnDrive = toast.toasts.value.some((shown) => shown.id === DRIVE_FAILED_TOAST) ? [...titlesFailedOnDrive, writeTitle] : [writeTitle]
      toast.add({ ...shared, id: DRIVE_FAILED_TOAST, description: `${titlesFailedOnDrive.join(', ')}: ${words.driveFailed}` })
      return
    }
    const reason = writeFailureInWords(failure)
    toast.add({ ...shared, description: naming === 'always' ? `${writeTitle}: ${reason}` : reason })
  }

  async function undo(write: SessionWrite): Promise<void> {
    running.value += 1
    try {
      await withGoogleAccess([], () => store.undo(write))
      const undone = store.state.writes.find((written) => written.undid === write.receipt)
      const description = write.shownAtOnce ? write.receipt.title : undone === undefined ? null : recordsChangeInWords(undone.receipt, undone.undid)
      toast.add({ title: words.undone, ...(description === null ? {} : { description }), icon: 'i-lucide-undo-2', color: 'neutral' })
    } catch (failure) {
      refused(words.notUndone, failure, write.receipt.title, 'always')
    } finally {
      running.value -= 1
    }
  }

  function announce(receipt: WriteReceipt, options: Pick<RecordWriteOptions, 'description' | 'follow' | 'titleCounts'> = {}): void {
    const recorded = store.state.writes.find((written) => written.receipt === receipt)
    if (recorded === undefined) return
    toast.add({
      title: receipt.title,
      // The control already shows what changed, so its toast keeps to one row and stacks low on a phone.
      ...(recorded.shownAtOnce ? { orientation: 'horizontal' as const } : options.titleCounts === true ? {} : { description: options.description ?? recordsChangeInWords(receipt, null) }),
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
    running.value += 1
    try {
      const receipt = await withGoogleAccess([], () => store.write(title, work, { key: queueKey(options.key ?? SAVE_KEY), shownAtOnce: options.shownAtOnce ?? false }))
      if (receipt === null) {
        toast.add({ title: words.nothingChanged, description: words.alreadyHeld, icon: 'i-lucide-info', color: 'neutral' })
        return true
      }
      announce(receipt, options)
      return true
    } catch (failure) {
      // Any other failure may come after the file took the save, such as an edit from outside the app during it.
      if (failure instanceof WorkbookWriteRefused) refused(options.failedTitle ?? words.nothingWritten, failure, title, 'drive-only')
      else refused(words.mayNotHaveFinished, failure, title, 'always')
      return false
    } finally {
      running.value -= 1
    }
  }

  return { busy, saving, write, announce, undo }
}
