import type { CivilDate } from '../../../shared/calendar/civilDate'
import type { Money } from '../../../shared/money/money'

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
  readonly sheetRow: number
}
