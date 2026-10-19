import { describe, expect, it } from 'vitest'

import { itemStatistics } from '../src/features/billingPlan/domain/itemStatistics'
import { euros } from './fixtures/ledger'
import { planRow } from './fixtures/billingPlan'

describe('itemStatistics', () => {
  const plan = [
    planRow('Monthly Fee', '2025-11-30', 5000),
    planRow('External Contractor', '2025-11-24', 1800),
    planRow('Monthly Fee', '2025-12-31', 5000),
    planRow('Hotel', '2025-12-10', 420),
    planRow('Bonus', '2026-01-01', 3000),
    planRow('Monthly Fee', '2026-01-31', 5000),
    planRow('Plane Tickets', '2026-01-09', 180, 'south'),
  ]

  it('totals each kind of item over the whole plan, the largest first', () => {
    expect(itemStatistics(plan).items).toEqual([
      { item: 'Monthly Fee', amount: euros(15000) },
      { item: 'Bonus', amount: euros(3000) },
      { item: 'External Contractor', amount: euros(1800) },
      { item: 'Hotel', amount: euros(420) },
      { item: 'Plane Tickets', amount: euros(180) },
    ])
  })

  it('splits each year by item, in the same order, leaving out items a year does not have', () => {
    const { years } = itemStatistics(plan)

    expect(years.map((year) => [year.year, year.total, year.items.map((total) => [total.item, total.amount])])).toEqual([
      [2025, euros(12220), [['Monthly Fee', euros(10000)], ['External Contractor', euros(1800)], ['Hotel', euros(420)]]],
      [2026, euros(8180), [['Monthly Fee', euros(5000)], ['Bonus', euros(3000)], ['Plane Tickets', euros(180)]]],
    ])
  })

  it('has nothing to show for an empty plan', () => {
    expect(itemStatistics([])).toEqual({ items: [], years: [] })
  })
})
