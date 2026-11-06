import { computed } from 'vue'
import type { ComputedRef } from 'vue'

import { forgetSetUpAnswer, hasSetUpAnswer, keepSetUpAnswer } from '../../../../shared/app/setUpAnswer'
import { HISTORY_COMPLETE } from '../domain/historyAnswer'
import { useInvestmentsBooks } from '../../workbook/application/investmentsStore'

/** Whether tax figures show anywhere in the app. Kuna counts a gain from what was paid, so with buys missing it would show a wrong one. */
export function useTaxShown(): ComputedRef<boolean> {
  const { state } = useInvestmentsBooks()
  return computed(() => state.choice !== null && hasSetUpAnswer(state.choice.id, HISTORY_COMPLETE))
}

export function confirmHistoryComplete(): void {
  const { state } = useInvestmentsBooks()
  if (state.choice !== null) keepSetUpAnswer(state.choice.id, HISTORY_COMPLETE)
}

export function forgetHistoryComplete(): void {
  const { state } = useInvestmentsBooks()
  if (state.choice !== null) forgetSetUpAnswer(state.choice.id, HISTORY_COMPLETE)
}
