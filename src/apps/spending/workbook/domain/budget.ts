import type { MonthKey } from '../../../../shared/calendar/monthKey'
import type { Money } from '../../../../shared/money/money'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** A monthly limit on a spending category from a month on, in euros, until a later budget of the category. An amount of zero ends the limit. */
export interface Budget {
  readonly id: RecordId
  readonly category: RecordId
  readonly from: MonthKey
  readonly amount: Money
}
