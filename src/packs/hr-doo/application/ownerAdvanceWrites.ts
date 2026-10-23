import type { CivilDate } from '../../../shared/calendar/civilDate'
import type { Money } from '../../../shared/money/money'
import { newRecordId, recordIdOf } from '../../../features/workbook/domain/recordId'
import type { RecordId } from '../../../features/workbook/domain/recordId'
import { OWNER_ADVANCE_RECORDS } from '../domain/hrDooKinds'
import type { OwnerAdvanceEntry } from '../domain/ownerAdvancesReading'

/** A cost the owner paid privately, as the advance form gives it. */
export interface OwnerAdvanceDraft {
  readonly date: CivilDate
  /** Above zero. */
  readonly amount: Money
  readonly description: string
  readonly category: string
}

/** The advance the form gives, its description trimmed and its category in lower case, under the id it keeps, or a new one. */
export function ownerAdvanceOfDraft(draft: OwnerAdvanceDraft, id: RecordId = recordIdOf(OWNER_ADVANCE_RECORDS, newRecordId())): OwnerAdvanceEntry {
  return {
    date: draft.date,
    amount: draft.amount,
    description: draft.description.trim(),
    category: draft.category.trim().toLowerCase(),
    id,
  }
}
