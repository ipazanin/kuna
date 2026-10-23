import { computed } from 'vue'
import type { ComputedRef } from 'vue'

import { useWorkbook } from '../application/workbookStore'

/** A link that opens the Google Sheet on screen where it was last left, or null for a workbook kept in this browser. */
export function useSheetLink(): ComputedRef<string | null> {
  const { state } = useWorkbook()
  return computed(() => (state.workbook?.source === 'google' ? `https://docs.google.com/spreadsheets/d/${encodeURIComponent(state.workbook.id)}/edit` : null))
}
