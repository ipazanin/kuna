import { computed } from 'vue'

import { rowsTakingReceipt } from '../../statements/domain/reviewQueue'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import type { Transaction } from '../../workbook/domain/transaction'
import { today } from '../../../../shared/calendar/civilDate'

/** Whether an entry offers to take a receipt photo, as the books stand. */
export function useReceiptRows(): (entry: Transaction) => boolean {
  const { state } = useSpendingBooks()
  const rows = computed(() => (state.workbook === null ? new Set<Transaction['id']>() : rowsTakingReceipt(state.workbook, today())))
  return (entry) => rows.value.has(entry.id)
}
