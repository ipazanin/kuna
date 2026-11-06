import type { MonthKey } from '../../../../shared/calendar/monthKey'
import type { Money } from '../../../../shared/money/money'

/** What a loan owes at the end of a month. */
export interface MonthBalance {
  readonly month: MonthKey
  readonly owed: Money
}
