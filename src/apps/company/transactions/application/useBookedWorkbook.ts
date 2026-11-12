import { computed } from 'vue'
import type { ComputedRef } from 'vue'

import { useWorkbook } from '../../workbook/application/workbookStore'
import type { Workbook } from '../../workbook/domain/workbook'
import { presentedWorkbook } from '../domain/presentedWorkbook'

/** The workbook on screen as booked, with each split row in its parts, for a screen that reads no filter. Null until a workbook is on screen. */
export function useBookedWorkbook(): ComputedRef<Workbook | null> {
  const { state } = useWorkbook()
  return computed(() => (state.workbook === null ? null : presentedWorkbook(state.workbook)))
}
