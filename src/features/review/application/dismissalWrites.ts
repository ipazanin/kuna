import type { CivilDate } from '../../../shared/calendar/civilDate'
import type { CoverageGroup } from '../../rules/domain/ruleCoverage'
import type { Dismissal, SuggestionKind } from '../../workbook/domain/dismissals'
import { readDismissals } from '../../workbook/domain/dismissalsReading'
import { newRecordId, recordIdOf } from '../../workbook/domain/recordId'
import { DISMISSAL_RECORDS } from '../../workbook/domain/recordKind'
import type { WriteRules } from '../../workbook/domain/writeRules'

/** Dismissed suggestions, checked by their own reader. Nothing else reads them, so nothing else can refuse them. */
export const DISMISSAL_WRITES: WriteRules<Dismissal> = {
  kind: DISMISSAL_RECORDS,
  reads: [],
  undoable: true,
  read: (read) => readDismissals(read),
  refusals: () => [],
}

/** What dismisses a group: its kind, its key, the category most of its rows are in, and the day. */
export function dismissalOfGroup(kind: SuggestionKind, group: CoverageGroup<unknown>, on: CivilDate): Dismissal {
  return { kind, key: group.key, category: group.categories[0]?.category ?? '', dismissedOn: on, id: recordIdOf(DISMISSAL_RECORDS, newRecordId()) }
}
