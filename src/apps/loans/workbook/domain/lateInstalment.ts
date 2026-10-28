import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** An instalment paid after its due date. Every other instalment counts as paid on its due date. */
export interface LateInstalment {
  readonly id: RecordId
  readonly loan: RecordId
  readonly due: CivilDate
  readonly paid: CivilDate
}
