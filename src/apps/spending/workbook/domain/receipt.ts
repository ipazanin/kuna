import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { Money } from '../../../../shared/money/money'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** A fiscal receipt and the entry it split. A fiscal receipt's total is in euros. */
export interface Receipt {
  readonly id: RecordId
  readonly transaction: RecordId
  readonly merchant: string
  /** Blank until a read gives it. */
  readonly merchantOib: string
  /** Blank unless the receipt names a buyer, as an R1 receipt does. */
  readonly buyerOib: string
  readonly issuedOn: CivilDate
  /** `HH:mm`, or blank when the time was not read. */
  readonly issuedTime: string
  readonly total: Money
  readonly jir: string
  readonly zki: string
  /** The model that read it, or blank for a receipt no model read. */
  readonly readBy: string
  /** The photo's Drive file id, or blank when it was not kept. */
  readonly photo: string
}
