import type { CivilDate } from '../../../shared/calendar/civilDate'
import type { Money } from '../../../shared/money/money'
import { filedIn, movedTo } from '../../../features/owner-share/domain/ownerShare'
import type { ShareDefault } from '../../../features/owner-share/domain/ownerShare'
import { newRecordId, recordIdOf } from '../../../features/workbook/domain/recordId'
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

/**
 * The advance the form gives, its description trimmed and its category in lower case: a new one with
 * an id of its own, or the advance it changes under the id that one keeps. A new advance, or one put
 * in another category, takes its category's default share, and one that keeps its category keeps its share.
 */
export function ownerAdvanceOfDraft(draft: OwnerAdvanceDraft, categories: readonly ShareDefault[], before: OwnerAdvanceEntry | null = null): OwnerAdvanceEntry {
  const category = draft.category.trim().toLowerCase()
  const described = { date: draft.date, amount: draft.amount, description: draft.description.trim() }
  return before === null
    ? filedIn({ ...described, category: '', ownerShare: null, id: recordIdOf(OWNER_ADVANCE_RECORDS, newRecordId()) }, category, categories)
    : movedTo({ ...before, ...described }, category, categories)
}
