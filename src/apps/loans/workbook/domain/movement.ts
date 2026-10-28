import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { Money } from '../../../../shared/money/money'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** Borrowing raises what is owed, in money or by the lender paying for something of the borrower's. The other kinds lower it. */
export const MOVEMENT_KINDS = ['borrowed', 'borrowed-in-kind', 'repaid', 'repaid-in-kind', 'forgiven'] as const

export type MovementKind = (typeof MOVEMENT_KINDS)[number]

/** One dated change to what an informal loan owes. */
export interface Movement {
  readonly id: RecordId
  readonly loan: RecordId
  readonly date: CivilDate
  readonly kind: MovementKind
  /** Above zero. The kind gives its direction. */
  readonly amount: Money
  readonly note: string
}
