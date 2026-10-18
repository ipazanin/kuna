import type { Money } from '../../../shared/money/money'

/** The `item` keywords of the `plan` tab. Any other item is a category from the categories tab. */
export const PLAN_KEYWORDS = ['revenue', 'owner_pay_scenario', 'dividend', 'purchase'] as const

interface PlanLineTiming {
  readonly year: number
  /** 1 to 12, or null for a line that holds for every month of the year. */
  readonly month: number | null
  readonly note: string
  readonly sheetRow: number
}

/**
 * One row of the `plan` tab: what the owner expects for a future month. An `owner_pay_scenario`
 * row names a scenario from the scenarios tab in its `amount` cell, and every other row holds an amount.
 */
export type PlanLine = PlanLineTiming &
  (
    | {
        readonly kind: 'amount'
        /** `revenue`, `dividend`, `purchase` or a category slug. */
        readonly item: string
        readonly amount: Money
      }
    | { readonly kind: 'owner-pay-scenario'; readonly scenario: string }
  )
