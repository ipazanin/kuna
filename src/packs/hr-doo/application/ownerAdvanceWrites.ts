import type { CivilDate } from '../../../shared/calendar/civilDate'
import type { Money } from '../../../shared/money/money'
import { newRecordId, recordIdOf } from '../../../features/workbook/domain/recordId'
import { OWNER_ADVANCE_RECORDS } from '../domain/hrDooKinds'
import type { OwnerAdvanceEntry } from '../domain/ownerAdvancesReading'

/** A cost the owner paid privately, as the Add advance form gives it. */
export interface OwnerAdvanceDraft {
  readonly date: CivilDate
  /** Above zero. */
  readonly amount: Money
  readonly description: string
  readonly category: string
}

/** A new advance, its description trimmed and its category in lower case, with an id of its own. */
export function newOwnerAdvance(draft: OwnerAdvanceDraft): OwnerAdvanceEntry {
  return {
    date: draft.date,
    amount: draft.amount,
    description: draft.description.trim(),
    category: draft.category.trim().toLowerCase(),
    id: recordIdOf(OWNER_ADVANCE_RECORDS, newRecordId()),
  }
}
