import { describe, expect, it } from 'vitest'

import type { Booking } from '../src/apps/company/workbook/domain/workbook'
import { prepaymentSpread } from '../src/apps/company/packs/hr-doo/domain/accrual/prepaymentSpread'
import { yearOfMonth } from '../src/shared/calendar/monthKey'
import { sumMoney } from '../src/shared/money/money'
import { civil, euros } from './fixtures/ledger'

function booking(date: string, amount: number, categorySlug: string): Booking {
  return { date: civil(date), amount: euros(amount), category: categorySlug, family: 'operating', bucket: 'operating' }
}

describe('prepaymentSpread', () => {
  it('spreads a policy paid on 1 January over the days of each month', () => {
    const shares = prepaymentSpread(booking('2026-01-01', -365, 'insurance'), 12)

    expect(shares).toHaveLength(12)
    expect(shares[0].month).toBe('2026-01')
    expect(shares[0].cost.amount).toBe(euros(-31))
    expect(shares[1].cost.amount).toBe(euros(-28))
    expect(shares[11].month).toBe('2026-12')
    expect(shares[0].cost.rules.map((citation) => citation.ruleId)).toEqual(['hr.acc.accrual-basis'])
  })

  it('leaves the part after 31 December as the prepaid expense', () => {
    // Paid 10.10.2026, it covers 10.10.2026 to 9.10.2027, 365 days. 2026 holds 22 + 30 + 31 = 83 of
    // them, so 480.00 × 83 / 365 = 109.15 is this year's cost and 370.85 is prepaid.
    const shares = prepaymentSpread(booking('2026-10-10', -480, 'insurance'), 12)
    const thisYear = sumMoney(shares.filter((share) => yearOfMonth(share.month) === 2026).map((share) => share.cost.amount))
    const prepaid = sumMoney(shares.filter((share) => yearOfMonth(share.month) === 2027).map((share) => share.cost.amount))

    expect(shares.map((share) => share.month)).toEqual([
      '2026-10', '2026-11', '2026-12', '2027-01', '2027-02', '2027-03', '2027-04', '2027-05', '2027-06', '2027-07', '2027-08', '2027-09', '2027-10',
    ])
    expect(thisYear).toBe(euros(-109.15))
    expect(prepaid).toBe(euros(-370.85))
    expect([shares[0].cost.label, shares[0].cost.on]).toEqual(['22 of 365 days covered by the payment of', '2026-10-10'])
  })

  it('refuses a cover of no months', () => {
    expect(() => prepaymentSpread(booking('2026-10-10', -480, 'insurance'), 0)).toThrow(RangeError)
  })
})
