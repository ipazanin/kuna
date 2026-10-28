import type { CivilDate } from '../../../../../../shared/calendar/civilDate'
import type { Money } from '../../../../../../shared/money/money'
import type { AssetGroup } from '../assets/assets'
import type { RecordId } from '../../../../../../shared/storage/domain/recordId'

/** The `item` keywords of the `plan` tab. Any other item is a category from the categories tab. */
export const PLAN_KEYWORDS = ['owner_pay_scenario', 'dividend', 'purchase'] as const

interface PlanLineTiming {
  readonly year: number
  /** 1 to 12, or null for a line that holds for every month of the year. A purchase takes the month of its date. */
  readonly month: number | null
  readonly note: string
  /** Held by no other row of its tab. */
  readonly id: RecordId
}

/**
 * One row of the `plan` tab: what the owner expects for a future month. A category or dividend row
 * holds an amount, a purchase its day, net cost and asset group, and an `owner_pay_scenario` row
 * names a scenario from the scenarios tab in its `amount` cell, from its `date` or from 1 January.
 */
export type PlanLine = PlanLineTiming &
  (
    | {
        readonly kind: 'amount'
        /** `dividend` or a category slug. */
        readonly item: string
        readonly amount: Money
      }
    | {
        readonly kind: 'purchase'
        readonly date: CivilDate
        /** The cost without the VAT that is reclaimed. */
        readonly amount: Money
        readonly group: AssetGroup
      }
    | {
        readonly kind: 'owner-pay-scenario'
        readonly scenario: string
        /** The day the scenario takes over, or null for 1 January. */
        readonly from: CivilDate | null
      }
  )
