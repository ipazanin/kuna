import { computed } from 'vue'
import type { ComputedRef } from 'vue'

import { useWorkbook } from '../application/workbookStore'
import type { RecordKind } from '../domain/recordKind'
import { spreadsheetTabOfKind } from '../infrastructure/spreadsheetTab'

/** The columns the Google Sheet on screen lacks on the tab of a kind, which a save that fills them adds once the person was told. */
export function useMissingColumns(kind: RecordKind<unknown>): ComputedRef<readonly string[]> {
  const { state } = useWorkbook()
  return computed(() => ((state.choice?.source ?? state.workbook?.source) === 'google' ? (state.snapshot?.meta.missingColumns?.[spreadsheetTabOfKind(kind).tab] ?? []) : []))
}
