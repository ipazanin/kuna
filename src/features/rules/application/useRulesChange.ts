import { computed, ref } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import { useToast } from '@nuxt/ui/composables/useToast'

import { useWorkbook } from '../../workbook/application/workbookStore'
import type { Transaction } from '../../workbook/domain/workbook'
import { previewRulesChange } from '../domain/rulesChangePreview'
import type { RulesChangePreview } from '../domain/rulesChangePreview'
import type { RulesTabChange } from '../domain/rulesTabChange'
import { categorisationContextOf } from '../domain/transactionFacts'

/** The back-test and the checks of a rules change, kept current as the change is edited. Null without a workbook or a change. */
export function useRulesChangePreview(change: () => RulesTabChange | null): ComputedRef<RulesChangePreview<Transaction> | null> {
  const { state } = useWorkbook()
  return computed(() => {
    const workbook = state.workbook
    const rows = state.snapshot?.rules
    const pending = change()
    if (workbook === null || rows === undefined || pending === null) {
      return null
    }
    const definedCategories = new Set(workbook.categories.map((category) => category.slug))
    return previewRulesChange(rows, pending, definedCategories, workbook.hasClientsTab, workbook.rules, workbook.transactions, categorisationContextOf(workbook))
  })
}

export interface RulesWrites {
  readonly saving: Readonly<Ref<boolean>>
  /** Saves the change, says so in a toast when given what to say, and resolves to whether it was written. */
  save(change: RulesTabChange, saved: string | null): Promise<boolean>
}

export function useRulesWrites(): RulesWrites {
  const store = useWorkbook()
  const toast = useToast()
  const saving = ref(false)
  return {
    saving,
    async save(change, saved) {
      saving.value = true
      try {
        await store.changeRules(change)
        if (saved !== null) {
          toast.add({ title: saved, icon: 'i-lucide-check', color: 'success' })
        }
        return true
      } catch (failure) {
        toast.add({ title: 'Not saved', description: failure instanceof Error ? failure.message : String(failure), icon: 'i-lucide-triangle-alert', color: 'error', duration: 10_000 })
        return false
      } finally {
        saving.value = false
      }
    },
  }
}
