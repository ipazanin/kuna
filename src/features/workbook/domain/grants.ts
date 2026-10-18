import type { CivilDate } from '../../../shared/calendar/civilDate'
import type { DateRange } from '../../../shared/calendar/dateRange'
import type { Money } from '../../../shared/money/money'

/**
 * How a grant counts as income. `fixed-then-assets` releases the fixed part when it is received and
 * the variable part with the depreciation of the assets it paid for. `straight-line` spreads the
 * whole amount evenly over the grant period.
 */
export const GRANT_RELEASES = ['fixed-then-assets', 'straight-line'] as const

export type GrantRelease = (typeof GRANT_RELEASES)[number]

/** What the grantor can claim back: the whole grant, or an amount. */
export type GrantClawback = 'whole' | Money

export interface GrantParts {
  readonly fixed: Money
  readonly variable: Money
}

/** One row of the `grants` tab: the terms of a grant, which the single bank row of its receipt cannot hold. */
export interface Grant {
  /** A short name in lower case, which `funded_by` on the assets tab refers to. */
  readonly slug: string
  readonly received: CivilDate
  /** Always positive. */
  readonly amount: Money
  /** Null when the tab leaves both parts blank. Otherwise they add up to `amount`. */
  readonly parts: GrantParts | null
  /** The period the grant covers, or null when the tab leaves it blank. */
  readonly period: DateRange | null
  readonly release: GrantRelease
  /** What can be claimed back if the terms break in the first year, or null when the tab does not say. */
  readonly clawbackFirstYear: GrantClawback | null
  readonly clawbackSecondYear: GrantClawback | null
  /** The day until which the grant requires the owner's employment, or null. */
  readonly employmentRequiredUntil: CivilDate | null
  readonly note: string
  readonly sheetRow: number
}
