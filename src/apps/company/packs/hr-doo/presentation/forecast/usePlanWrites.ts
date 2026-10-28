import type { Repository } from '../../../../../../shared/storage/application/repository'
import { useWorkbook } from '../../../../workbook/application/workbookStore'
import { recordsOfKindIn } from '../../../../workbook/domain/readWorkbook'
import { NO_RECORDS, recordWithId } from '../../../../../../shared/storage/domain/recordsRead'
import { useRecordWrites } from '../../../../workbook/presentation/useRecordWrites'
import type { PlanLine } from '../../domain/forecast/plan'
import { PLAN_RECORDS } from '../../domain/hrDooKinds'
import { PLAN_WRITES } from '../../domain/hrDooWrites'

/** Writes plan lines as every plan dialog does, each line as the app read it. */
export function usePlanWrites() {
  const store = useWorkbook()
  const writes = useRecordWrites()

  /** The line as the app read it, or null when the copy on screen has moved on. */
  function stored(line: PlanLine): PlanLine | null {
    return recordWithId(store.state.records === null ? NO_RECORDS : recordsOfKindIn(store.state.records, PLAN_RECORDS), line.id)?.record ?? null
  }

  function write(title: string, work: (lines: Repository<PlanLine>) => void, options: { readonly description: string; readonly failedTitle: string }): Promise<boolean> {
    return writes.write(title, (unit) => work(unit.of(PLAN_WRITES)), options)
  }

  return { busy: writes.busy, stored, write }
}
