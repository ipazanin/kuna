import { describe, expect, it } from 'vitest'

import { planItemsOf } from '../src/apps/company/billingPlan/domain/planItems'
import { planRow } from './fixtures/billingPlan'

describe('planItemsOf', () => {
  const plan = [planRow('Monthly Fee', '2026-01-31', 5000), planRow('Hotel', '2026-01-10', 420, 'south'), planRow('Monthly Fee', '2026-02-28', 5000), planRow('Bonus', '2026-02-01', 3000)]

  it('names each item of the plan once, in plan order', () => {
    expect(planItemsOf(plan)).toEqual(['Monthly Fee', 'Hotel', 'Bonus'])
  })

  it("names only one client's items when given the client", () => {
    expect(planItemsOf(plan, 'north')).toEqual(['Monthly Fee', 'Bonus'])
    expect(planItemsOf(plan, 'west')).toEqual([])
  })
})
