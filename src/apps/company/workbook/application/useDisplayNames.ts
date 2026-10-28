import { computed } from 'vue'
import type { ComputedRef } from 'vue'

import { displayNamesOf } from '../domain/displayName'
import type { DisplayNames } from '../domain/displayName'
import { useWorkbook } from './workbookStore'

/** The screen names of the categories and accounts of the workbook on screen. */
export function useDisplayNames(): ComputedRef<DisplayNames> {
  const { state } = useWorkbook()
  return computed(() => displayNamesOf(state.workbook ?? { categories: [], accounts: [] }))
}
