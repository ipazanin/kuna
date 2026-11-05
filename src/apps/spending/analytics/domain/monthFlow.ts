import type { MonthTotals } from './monthTotals'
import type { MonthKey } from '../../../../shared/calendar/monthKey'
import { subtractMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'

/** A month's income, spending and saving side by side, with the share of income not spent. */
export interface MonthFlow {
  readonly month: MonthKey
  readonly income: Money
  readonly spent: Money
  readonly saved: Money
  /** Income less spending, over income. Null for a month with no income. */
  readonly savingsRate: number | null
}

export function monthFlow(totals: readonly MonthTotals[]): MonthFlow[] {
  return totals.map((month) => ({
    month: month.month,
    income: month.income,
    spent: month.spent,
    saved: month.saved,
    savingsRate: month.income > 0 ? subtractMoney(month.income, month.spent) / month.income : null,
  }))
}
