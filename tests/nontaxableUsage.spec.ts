import { describe, expect, it } from 'vitest'

import { nontaxableUsage } from '../src/apps/company/packs/hr-doo/domain/payroll/nontaxableUsage'
import type { NontaxablePaymentMade, NontaxableUsage } from '../src/apps/company/packs/hr-doo/domain/payroll/nontaxableUsage'
import { civil, euros } from './fixtures/ledger'

function made(payment: string, paidOn: string, amount: number, units?: number): NontaxablePaymentMade {
  return { payment, paidOn: civil(paidOn), amount: euros(amount), ...(units === undefined ? {} : { units }) }
}

function usageIn(payments: readonly NontaxablePaymentMade[], year = 2026): readonly NontaxableUsage[] {
  return nontaxableUsage(payments, year, 'plan')
}

function summary(usage: NontaxableUsage) {
  return [usage.payment, usage.periodKey, usage.paid.amount, usage.cap?.amount ?? null, usage.remaining?.amount ?? null, usage.excess.amount]
}

describe('non-taxable payments against their caps', () => {
  it('adds yearly payments up and taxes the part over the cap as salary', () => {
    // Occasional gifts 400.00 + 300.00 use the 700.00 cap exactly. A results bonus of 1,500.00 is 300.00 over 1,200.00.
    // The 2025 gift belongs to another year.
    const usage = usageIn([
      made('occasional-gift', '2026-06-10', 400),
      made('occasional-gift', '2026-12-10', 300),
      made('occasional-gift', '2025-12-10', 700),
      made('results-bonus', '2026-12-10', 1500),
    ])

    expect(usage.map(summary)).toEqual([
      ['occasional-gift', '2026', euros(700), euros(700), euros(0), euros(0)],
      ['results-bonus', '2026', euros(1500), euros(1200), euros(0), euros(300)],
    ])
    expect(usage[1]?.items).toEqual([18])
    expect(usage.flatMap((use) => [use.paid, use.excess]).every((figure) => figure.rules[0]?.ruleId === 'hr.pit.nontaxable-caps')).toBe(true)
  })

  it('checks a monthly cap month by month', () => {
    // Living apart from the family: 300.00 a month. March 200.00 + 150.00 is 50.00 over. April 250.00 leaves 50.00.
    expect(
      usageIn([made('living-apart-from-family', '2026-03-05', 200), made('living-apart-from-family', '2026-03-20', 150), made('living-apart-from-family', '2026-04-05', 250)]).map(summary),
    ).toEqual([
      ['living-apart-from-family', '2026-03', euros(350), euros(300), euros(0), euros(50)],
      ['living-apart-from-family', '2026-04', euros(250), euros(300), euros(50), euros(0)],
    ])
  })

  it('multiplies a per-day or per-kilometre cap by the units, within any monthly cap', () => {
    // Domestic per diem over 12 hours, 3 days x 30.00 = 90.00 against 100.00 paid.
    // Work at a separate place, 20 days x 4.00 = 80.00, limited to 70.00 a month, against 75.00.
    // In June 10 days x 4.00 = 40.00 against 40.00. Private car 400 km x 0.50 = 200.00 against 200.00.
    const usage = usageIn([
      made('domestic-per-diem-over-12-hours', '2026-05-15', 100, 3),
      made('work-at-separate-place', '2026-05-31', 75, 20),
      made('work-at-separate-place', '2026-06-30', 40, 10),
      made('private-car-business-travel', '2026-05-15', 200, 400),
    ])

    expect(usage.map(summary)).toEqual([
      ['domestic-per-diem-over-12-hours', '2026-05', euros(100), euros(90), euros(0), euros(10)],
      ['private-car-business-travel', '2026-05', euros(200), euros(200), euros(0), euros(0)],
      ['work-at-separate-place', '2026-05', euros(75), euros(70), euros(0), euros(5)],
      ['work-at-separate-place', '2026-06', euros(40), euros(40), euros(0), euros(0)],
    ])
    expect(usage[2]?.cap?.label).toBe('Cap, limited to the monthly cap')
    expect(usage[2]?.cap?.steps[0]?.label).toBe('Cap for 20 days')
  })

  it('puts no cap on a payment that is tax-free at actual cost', () => {
    const [travel] = usageIn([made('business-travel-cost', '2026-02-10', 500), made('business-travel-cost', '2026-09-10', 181)])

    expect(travel === undefined ? null : summary(travel)).toEqual(['business-travel-cost', '2026', euros(681), null, null, euros(0)])
    expect(travel?.items).toEqual([27, 28])
  })

  it('refuses a payment the ruleset does not list and a per-day payment without its days', () => {
    expect(() => usageIn([made('gym', '2026-02-10', 30)])).toThrow('gym is not a non-taxable payment')
    expect(() => usageIn([made('domestic-per-diem-over-12-hours', '2026-02-10', 30)])).toThrow('needs a whole number of days')
  })
})
