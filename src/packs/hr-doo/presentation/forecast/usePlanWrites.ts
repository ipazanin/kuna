import { computed } from 'vue'

import type { Repository } from '../../../../features/workbook/application/repository'
import { useWorkbook } from '../../../../features/workbook/application/workbookStore'
import { recordsOfKindIn } from '../../../../features/workbook/domain/readWorkbook'
import { NO_RECORDS, recordWithId } from '../../../../features/workbook/domain/recordsRead'
import { useRecordWrites } from '../../../../features/workbook/presentation/useRecordWrites'
import type { PlanLine } from '../../domain/forecast/plan'
import { PLAN_RECORDS } from '../../domain/hrDooKinds'
import { PLAN_WRITES } from '../../domain/hrDooWrites'

/**
 * Writes plan lines as every plan dialog does: each line as the app read it, and a Google Sheet
 * without the plan tab gets it with the template's header on the first write, which each dialog
 * says before the person saves.
 */
export function usePlanWrites() {
  const store = useWorkbook()
  const writes = useRecordWrites()
  const tabMissing = computed(() => store.state.choice?.source === 'google' && (store.state.snapshot?.meta.missingTabs.includes('plan') ?? false))

  /** The line as the app read it, or null when the copy on screen has moved on. */
  function stored(line: PlanLine): PlanLine | null {
    return recordWithId(store.state.records === null ? NO_RECORDS : recordsOfKindIn(store.state.records, PLAN_RECORDS), line.id)?.record ?? null
  }

  function write(title: string, work: (lines: Repository<PlanLine>) => void, options: { readonly description: string; readonly failedTitle: string }): Promise<boolean> {
    return writes.write(tabMissing.value ? 'Plan tab added' : title, (unit) => work(unit.of(PLAN_WRITES)), {
      description: tabMissing.value ? `${title}. ${options.description}` : options.description,
      failedTitle: options.failedTitle,
      addMissingKinds: tabMissing.value,
    })
  }

  return { busy: writes.busy, tabMissing, stored, write }
}
