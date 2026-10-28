import { describe, expect, it } from 'vitest'

import { citLiability } from '../src/apps/company/packs/hr-doo/domain/cit/citLiability'
import type { TaxPeriod } from '../src/apps/company/packs/hr-doo/domain/cit/citLiability'
import { taxBase } from '../src/apps/company/packs/hr-doo/domain/cit/taxBase'
import { tracedFigure } from '../src/apps/company/packs/hr-doo/domain/payroll/payrollArithmetic'
import { civil, euros } from './fixtures/ledger'

function figure(amount: number) {
  return tracedFigure('Example', euros(amount), 'ledger', [])
}

function baseOf(revenue: number, expenses: number, year = 2026) {
  return taxBase({
    year,
    revenue: figure(revenue),
    expenses: figure(expenses),
    representation: figure(0),
    personalTransport: figure(0),
    nonDeductible: figure(0),
    depreciationAboveAllowed: figure(0),
    relatedPartyInterestShortfall: figure(0),
    lossesBroughtForward: [],
  })
}

const FULL_YEAR: TaxPeriod = { from: civil('2026-01-01'), to: civil('2026-12-31'), first: false }

describe('citLiability', () => {
  it('taxes revenue of exactly the threshold at the high rate', () => {
    expect(citLiability(baseOf(1000000, 900000), FULL_YEAR, null).rate.basisPoints).toBe(1800)
    expect(citLiability(baseOf(999999.99, 900000), FULL_YEAR, null).rate.basisPoints).toBe(1000)
  })

  it('rounds the tax to the cent', () => {
    // 10% of 12,345.67 is 1,234.567.
    expect(citLiability(baseOf(40000, 27654.33), FULL_YEAR, null).liability.amount).toBe(euros(1234.57))
  })

  it('has no advances in a first period, and divides the liability by the months it touched', () => {
    const first: TaxPeriod = { from: civil('2026-06-05'), to: civil('2026-12-31'), first: true }
    const liability = citLiability(baseOf(30000, 10000), first, figure(500))

    expect(liability.periodMonths).toBe(7)
    expect(liability.advancesPaid?.amount).toBe(euros(0))
    expect(liability.balanceDue?.amount).toBe(euros(2000))
    // 2,000.00 over 7 months is 285.714.
    expect(liability.monthlyAdvance.amount).toBe(euros(285.71))
  })

  it('refunds advances above the liability, and leaves the settlement out while the advances are unknown', () => {
    const overpaid = citLiability(baseOf(30000, 10000), FULL_YEAR, figure(2400))

    expect(overpaid.balanceDue?.amount).toBe(euros(0))
    expect(overpaid.refund?.amount).toBe(euros(400))
    expect(citLiability(baseOf(30000, 10000), FULL_YEAR, null).balanceDue).toBeNull()
  })

  it('owes nothing on a loss', () => {
    expect(citLiability(baseOf(1000, 3000), FULL_YEAR, null).liability.amount).toBe(euros(0))
  })
})
