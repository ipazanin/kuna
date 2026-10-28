import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { Money } from '../../../../shared/money/money'
import { naturalOrder } from '../../../../shared/text/naturalOrder'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** One row of the `outgoing-plan` tab: something to invoice a client, billable from its date. */
export interface BillingItem {
  /** The kind of item, such as the monthly fee, a bonus or a re-billed hotel, as the tab writes it. */
  readonly item: string
  /** The day it becomes billable: the end of the worked month for a monthly fee, the purchase day for a re-billed cost. */
  readonly date: CivilDate
  /** Above zero. */
  readonly amount: Money
  /** The client slug, as the `clients` tab names it. */
  readonly client: string
  readonly description: string
  /** Held by no other row of its tab. */
  readonly id: RecordId
}

/** Items oldest first, and on one day by item, amount, description and client. */
export function billingItemOrder(earlier: Omit<BillingItem, 'id'>, later: Omit<BillingItem, 'id'>): number {
  return (
    earlier.date.localeCompare(later.date) ||
    naturalOrder(earlier.item, later.item) ||
    earlier.amount - later.amount ||
    naturalOrder(earlier.description, later.description) ||
    naturalOrder(earlier.client, later.client)
  )
}
