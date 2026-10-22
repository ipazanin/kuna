import { computed } from 'vue'

import { storedCellsOf } from '../../../../features/workbook/application/tabRowWrites'
import { useWorkbook } from '../../../../features/workbook/application/workbookStore'
import type { PlanLine } from '../../../../features/workbook/domain/plan'
import type { RowCells, TabRowsChange } from '../../../../features/workbook/domain/rowChanges'
import { TEMPLATE_COLUMNS } from '../../../../features/workbook/infrastructure/workbookTemplate'
import { useRowWrites } from '../../../../features/workbook/presentation/useRowWrites'
import type { RowWriteToast } from '../../../../features/workbook/presentation/useRowWrites'
import { PLAN_ROWS } from '../../application/planRows'

/**
 * Writes to the plan tab as every plan dialog does: the rows as the app read them, and a Google
 * Sheet without the tab gets it with the template's header on the first write, which each dialog
 * says before the person saves.
 */
export function usePlanWrites() {
  const store = useWorkbook()
  const writes = useRowWrites(PLAN_ROWS)
  const tabMissing = computed(() => store.state.choice?.source === 'google' && (store.state.snapshot?.meta.missingTabs.includes('plan') ?? false))
  const headers = TEMPLATE_COLUMNS.plan.map((column) => column.name).join(', ')

  /** The cells a plan line was read from, as the tab holds them, or null when the copy on screen has moved on. */
  function rowOf(line: PlanLine): RowCells | null {
    return storedCellsOf(store.state.snapshot?.plan ?? [], PLAN_ROWS, line.id)
  }

  function write(change: TabRowsChange, done: RowWriteToast, failedTitle: string): Promise<boolean> {
    return writes.write(change, tabMissing.value ? { ...done, title: 'Plan tab added', description: `${done.title}. ${done.description ?? `Written to ${writes.where()}.`}` } : done, failedTitle, tabMissing.value)
  }

  return { busy: writes.busy, where: writes.where, tabMissing, headers, rowOf, write }
}
