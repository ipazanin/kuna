import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** A split of `newUnits` for every `oldUnits`, both whole numbers, so 10 and 1 is 10-for-1 and 1 and 3 is 1-for-3. */
export interface Split {
  readonly id: RecordId
  readonly instrument: RecordId
  readonly date: CivilDate
  readonly newUnits: number
  readonly oldUnits: number
  /** The key of the imported rows it came from, so importing them again adds nothing. Null for a record typed in. */
  readonly importKey: string | null
  readonly note: string
}
