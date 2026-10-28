import { yearOf } from '../../../../shared/calendar/civilDate'
import { ZERO, addMoney, sumMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import type { BillingItem } from '../../workbook/domain/billingPlan'

export interface ItemTotal {
  readonly item: string
  readonly amount: Money
}

export interface YearItems {
  readonly year: number
  readonly total: Money
  /** The items planned in the year, in the order of `ItemStatistics.items`. */
  readonly items: readonly ItemTotal[]
}

export interface ItemStatistics {
  /** Every item kind, the largest total first. */
  readonly items: readonly ItemTotal[]
  /** Oldest first. */
  readonly years: readonly YearItems[]
}

/** How much of the plan each kind of item makes up, such as the monthly fee, bonuses or re-billed travel, in all and by year. */
export function itemStatistics(plan: readonly BillingItem[]): ItemStatistics {
  const items = totalsByItem(plan).sort((larger, smaller) => smaller.amount - larger.amount || larger.item.localeCompare(smaller.item))
  const order = items.map((total) => total.item)
  return { items, years: yearsOf(plan, order).sort((earlier, later) => earlier.year - later.year) }
}

function yearsOf(plan: readonly BillingItem[], order: readonly string[]): YearItems[] {
  const byYear = new Map<number, BillingItem[]>()
  for (const row of plan) {
    const year = yearOf(row.date)
    byYear.set(year, [...(byYear.get(year) ?? []), row])
  }
  return [...byYear].map(([year, rows]) => ({
    year,
    total: sumMoney(rows.map((row) => row.amount)),
    items: totalsByItem(rows).sort((earlier, later) => order.indexOf(earlier.item) - order.indexOf(later.item)),
  }))
}

function totalsByItem(rows: readonly BillingItem[]): ItemTotal[] {
  const byItem = new Map<string, Money>()
  for (const row of rows) {
    byItem.set(row.item, addMoney(byItem.get(row.item) ?? ZERO, row.amount))
  }
  return [...byItem].map(([item, amount]) => ({ item, amount }))
}
