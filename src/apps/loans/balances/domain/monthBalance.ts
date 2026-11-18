import type { MonthKey } from '../../../../shared/calendar/monthKey'
import type { Money } from '../../../../shared/money/money'

/** What a loan owes at the end of a month, and your part of it for a bank loan you took out with others. */
export interface MonthBalance {
  readonly month: MonthKey
  readonly owed: Money
  readonly yours?: Money
}
