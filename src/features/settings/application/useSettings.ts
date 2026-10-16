import { computed } from 'vue'
import type { ComputedRef } from 'vue'

import { useWorkbook } from '../../workbook/application/workbookStore'
import { DEFAULT_SETTINGS } from '../domain/settings'
import type { Settings } from '../domain/settings'

/** The settings of the workbook on screen, or the defaults before there is one. */
export function useSettings(): ComputedRef<Settings> {
  const { state } = useWorkbook()
  return computed(() => state.workbook?.settings ?? DEFAULT_SETTINGS)
}
