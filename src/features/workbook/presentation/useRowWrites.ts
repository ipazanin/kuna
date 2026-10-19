import { ref } from 'vue'
import type { Ref } from 'vue'
import { useToast } from '@nuxt/ui/composables/useToast'

import { useWorkbook } from '../application/workbookStore'
import type { SessionWrite } from '../application/workbookStore'
import type { TabRowRules } from '../application/tabRowWrites'
import type { TabRowsChange } from '../domain/rowChanges'

/** How long a toast with Undo stays, so there is time to reach the button. */
const UNDO_TOAST_DURATION = 10_000

export interface RowWriteToast {
  readonly title: string
  /** Defaults to where the write went. */
  readonly description?: string
}

export interface RowWrites {
  /** True while a write of this tab is under way. */
  readonly busy: Readonly<Ref<boolean>>
  /** Where the writes go, such as "the invoices tab of the Sheet". */
  where(): string
  /** Writes the change and says so in a toast with Undo, or says why nothing was written. Resolves to whether it went through. */
  write(change: TabRowsChange, done: RowWriteToast, failedTitle: string): Promise<boolean>
}

/** Writes to one tab's rows with their toasts: what was written with Undo beside it, or why nothing was. */
export function useRowWrites(rules: TabRowRules): RowWrites {
  const store = useWorkbook()
  const toast = useToast()
  const busy = ref(false)

  function where(): string {
    return store.state.choice?.source === 'google' ? `the ${rules.tab} tab of the Sheet` : `the ${rules.tab} tab`
  }

  function refused(title: string, failure: unknown): void {
    toast.add({ title, description: failure instanceof Error ? failure.message : String(failure), icon: 'i-lucide-triangle-alert', color: 'error', duration: UNDO_TOAST_DURATION })
  }

  async function undo(write: SessionWrite): Promise<void> {
    busy.value = true
    try {
      await store.undo(write)
      toast.add({ title: 'Undone', description: `The ${rules.tab} tab is back as it was.`, icon: 'i-lucide-undo-2', color: 'neutral' })
    } catch (failure) {
      refused('Not undone', failure)
    } finally {
      busy.value = false
    }
  }

  async function write(change: TabRowsChange, done: RowWriteToast, failedTitle: string): Promise<boolean> {
    busy.value = true
    try {
      const receipt = await store.changeRows(rules, change)
      const recorded = store.state.writes[0]
      if (receipt === null || recorded?.kind !== 'rows' || recorded.receipt !== receipt) {
        toast.add({ title: 'Nothing changed', description: `The ${rules.tab} tab already holds this.`, icon: 'i-lucide-info', color: 'neutral' })
        return true
      }
      toast.add({
        title: done.title,
        description: done.description ?? `Written to ${where()}.`,
        icon: 'i-lucide-check',
        color: 'success',
        duration: UNDO_TOAST_DURATION,
        actions: [{ label: 'Undo', icon: 'i-lucide-undo-2', color: 'neutral', variant: 'outline', onClick: () => void undo(recorded) }],
      })
      return true
    } catch (failure) {
      refused(failedTitle, failure)
      return false
    } finally {
      busy.value = false
    }
  }

  return { busy, where, write }
}
