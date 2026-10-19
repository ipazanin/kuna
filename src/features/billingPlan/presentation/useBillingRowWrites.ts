import { ref } from 'vue'
import type { Ref } from 'vue'
import { useToast } from '@nuxt/ui/composables/useToast'

import { useWorkbook } from '../../workbook/application/workbookStore'
import type { SessionWrite } from '../../workbook/application/workbookStore'
import type { BillingCells, BillingRowCells, BillingRowChange } from '../infrastructure/billingPlanWrites'

/** How long a toast with Undo stays, so there is time to reach the button. */
const UNDO_TOAST_DURATION = 10_000

export interface BillingRowWrites {
  /** True while a write of this screen is under way. */
  readonly busy: Readonly<Ref<boolean>>
  /** Each resolves to whether the write went through, and says so in a toast with Undo. */
  add(rows: readonly BillingCells[]): Promise<boolean>
  change(change: BillingRowChange): Promise<boolean>
  remove(row: BillingRowCells): Promise<boolean>
}

/** Writes to the outgoing-plan tab with their toasts: what was written with Undo beside it, or why nothing was. */
export function useBillingRowWrites(): BillingRowWrites {
  const store = useWorkbook()
  const toast = useToast()
  const busy = ref(false)

  function where(): string {
    return store.state.choice?.source === 'google' ? 'the outgoing-plan tab of the Sheet' : 'the outgoing-plan tab'
  }

  function refused(title: string, failure: unknown): void {
    toast.add({ title, description: failure instanceof Error ? failure.message : String(failure), icon: 'i-lucide-triangle-alert', color: 'error', duration: UNDO_TOAST_DURATION })
  }

  async function undo(write: SessionWrite): Promise<void> {
    busy.value = true
    try {
      await store.undo(write)
      toast.add({ title: 'Undone', description: 'The outgoing-plan tab is back as it was.', icon: 'i-lucide-undo-2', color: 'neutral' })
    } catch (failure) {
      refused('Not undone', failure)
    } finally {
      busy.value = false
    }
  }

  /** Runs one write and offers Undo of the session write it recorded. */
  async function write(run: () => Promise<unknown>, done: { readonly title: string; readonly description: string }, failedTitle: string): Promise<boolean> {
    busy.value = true
    const before = store.state.writes[0]
    try {
      await run()
      const recorded = store.state.writes[0]
      if (recorded === undefined || recorded === before) {
        toast.add({ title: 'Nothing changed', description: 'The row already holds this.', icon: 'i-lucide-info', color: 'neutral' })
        return true
      }
      toast.add({
        ...done,
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

  return {
    busy,
    add: (rows) =>
      write(
        () => store.addBillingRows(rows),
        { title: rows.length === 1 ? 'Plan row added' : `${rows.length} plan rows added`, description: `Written to ${where()}.` },
        'Not added',
      ),
    change: (change) => write(() => store.changeBillingRow(change), { title: 'Plan row saved', description: `Written to row ${change.sheetRow} of ${where()}.` }, 'Not saved'),
    remove: (row) =>
      write(() => store.removeBillingRow(row), { title: 'Plan row deleted', description: `Row ${row.sheetRow} of ${where()} is cleared.` }, 'Not deleted'),
  }
}
