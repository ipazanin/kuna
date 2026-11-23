import { computed, ref } from 'vue'
import type { Ref } from 'vue'

import { rowPayeeKey } from '../domain/payeeDirectory'
import { usualCategories } from '../domain/usualCategory'
import type { EntrySide } from '../domain/usualCategory'
import { useSpendingBooks } from '../../workbook/application/spendingStore'

/**
 * Fills an entry's empty category from its payee's usual one as the payee is typed or the way the money goes changes, and only
 * a category it filled itself, so a category picked or cleared by hand stays. `filled` tells the dialog to say where the category came from.
 * Each side's usual categories are read once per book, so a keystroke only looks one up.
 */
export function usePayeeMemory(category: Ref<string>, pickable: () => ReadonlySet<string>) {
  const { state } = useSpendingBooks()
  const filled = ref(false)
  /** Whether the person picked or cleared the category since the dialog opened, after which nothing fills it. */
  const byHand = ref(false)
  const usualOut = computed(() => (state.workbook === null ? null : usualCategories(state.workbook, 'out')))
  const usualIn = computed(() => (state.workbook === null ? null : usualCategories(state.workbook, 'in')))

  function fill(payee: string, side: EntrySide | 'transfer'): void {
    if (side === 'transfer' || byHand.value || (category.value !== '' && !filled.value)) return
    const usual = (side === 'out' ? usualOut : usualIn).value?.get(rowPayeeKey(state.workbook ?? { payees: [] }, { payee, counterpartyIban: '' })) ?? null
    const shown = usual !== null && pickable().has(usual)
    if (!shown && !filled.value) return
    category.value = shown ? usual : ''
    filled.value = shown
  }

  /** Forgets what was filled or picked, as the dialog opens. */
  function start(): void {
    filled.value = false
    byHand.value = false
  }

  function pickedByHand(): void {
    filled.value = false
    byHand.value = true
  }

  return { filled, fill, start, pickedByHand }
}
