import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { CoverageGroup } from '../domain/ruleCoverage'
import { DISMISSAL_RECORDS } from '../../workbook/domain/coreKinds'
import type { CoverageKind, Dismissal } from '../../workbook/domain/dismissals'
import { readDismissals } from '../../workbook/domain/dismissalsReading'
import { newRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import type { WriteRules } from '../../../../shared/storage/domain/writeRules'

/** Dismissed suggestions, checked by their own reader. Nothing else reads them, so nothing else can refuse them. */
export const DISMISSAL_WRITES: WriteRules<Dismissal> = {
  kind: DISMISSAL_RECORDS,
  reads: [],
  undoable: true,
  read: (read) => readDismissals(read),
  refusals: () => [],
}

/** What dismisses a group: its kind, its key, the category most of its rows are in, and the day. */
export function dismissalOfGroup(kind: CoverageKind, group: CoverageGroup<unknown>, on: CivilDate): Dismissal {
  return { kind, key: group.key, category: group.categories[0]?.category ?? '', dismissedOn: on, id: recordIdOf(DISMISSAL_RECORDS, newRecordId()) }
}

/** What dismisses the class the pack suggests for a category: the category's short name as its key, and the day. */
export function dismissalOfNewerClass(category: string, on: CivilDate): Dismissal {
  return { kind: 'newer-class', key: category, category, dismissedOn: on, id: recordIdOf(DISMISSAL_RECORDS, newRecordId()) }
}
