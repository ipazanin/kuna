import { describe, expect, it } from 'vitest'

import { annualSettlement } from '../src/apps/company/packs/hr-doo/domain/payroll/annualSettlement'
import type { AnnualSettlement } from '../src/apps/company/packs/hr-doo/domain/payroll/annualSettlement'
import type { EmployeeFacts } from '../src/apps/company/packs/hr-doo/domain/payroll/incomeTax'
import { payrollMonth } from '../src/apps/company/packs/hr-doo/domain/payroll/payrollMonth'
import type { PayrollMonth } from '../src/apps/company/packs/hr-doo/domain/payroll/payrollMonth'
import { lastDayOf, monthKey } from '../src/shared/calendar/monthKey'
import { civil, euros } from './fixtures/ledger'
import { ZAGREB_RESIDENT } from './fixtures/zagrebResident'

/** Twelve months of the year at an agreed gross, each paid on the last day of the month worked. */
function yearOfSalary(year: number, agreed: number): readonly PayrollMonth[] {
  return Array.from({ length: 12 }, (_, index) => {
    const workedMonth = monthKey(year, index + 1)
    return payrollMonth(
      {
        workedMonth,
        paidOn: lastDayOf(workedMonth),
        agreedMonthlyGross: euros(agreed),
        daysWorked: 21,
        workingDaysInMonth: 21,
        nontaxablePayments: [],
        basis: 'plan',
      },
      ZAGREB_RESIDENT,
    )
  })
}

function settle(taxYear: number, months: readonly PayrollMonth[], birthYear: number | null): AnnualSettlement {
  const facts: EmployeeFacts = { ...ZAGREB_RESIDENT, birthYear }
  return annualSettlement({ taxYear, months, basis: 'plan' }, facts)
}

function outcome(settlement: AnnualSettlement) {
  return [settlement.youthRelief.amount, settlement.annualTax.amount, settlement.refund.amount]
}

describe('annual settlement of salary', () => {
  // A year at the 2026 floor: each month has income 1,036.70 and 100.44 withheld (see payrollMonth.spec).
  // Income 12 x 1,036.70 = 12,440.40, allowance 12 x 600.00 = 7,200.00, taxable 5,240.40.
  // Lower rate 23% x 5,240.40 = 1,205.292, so 1,205.29. Withheld 12 x 100.44 = 1,205.28.
  const floorYear2026 = yearOfSalary(2026, 0)

  it('recomputes a year with twelve allowances and the annual threshold', () => {
    const settlement = settle(2026, floorYear2026, null)

    expect([
      settlement.income.amount,
      settlement.allowance.amount,
      settlement.taxableIncome.amount,
      settlement.lowerRateTax.amount,
      settlement.higherRateTax.amount,
      settlement.withheld.amount,
    ]).toEqual([euros(12440.4), euros(7200), euros(5240.4), euros(1205.29), euros(0), euros(1205.28)])
    // Rounding each month and then the year leaves 0.01 to pay.
    expect(outcome(settlement)).toEqual([euros(0), euros(1205.29), euros(-0.01)])
    expect(settlement.youthRelief.label).toBe('No youth relief, because the birth year is not set')
    expect(settlement.income.steps).toHaveLength(12)
    expect(settlement.refund.rules.map((citation) => citation.ruleId)).toEqual(['hr.pit.annual-settlement'])
    expect(settlement.youthRelief.rules.map((citation) => citation.ruleId)).toEqual(['hr.pit.youth-relief'])
    expect(settlement.lowerRateTax.rules.map((citation) => citation.ruleId)).toEqual([
      'hr.pit.annual-settlement',
      'hr.pit.brackets',
      'hr.pit.local-rates',
    ])
  })

  it('gives each 2026 youth relief band by birth year, and none in the monthly payroll', () => {
    // 50%: 0.5 x 1,205.29 = 602.645, so 602.65. Tax 602.64, refund 1,205.28 - 602.64 = 602.64.
    // 100%: the whole 1,205.29, so the tax is 0.00 and everything withheld comes back.
    expect(outcome(settle(2026, floorYear2026, 2010))).toEqual([euros(1205.29), euros(0), euros(1205.28)])
    expect(outcome(settle(2026, floorYear2026, 2001))).toEqual([euros(1205.29), euros(0), euros(1205.28)])
    expect(outcome(settle(2026, floorYear2026, 2000))).toEqual([euros(602.65), euros(602.64), euros(602.64)])
    expect(outcome(settle(2026, floorYear2026, 1996))).toEqual([euros(602.65), euros(602.64), euros(602.64)])
    expect(outcome(settle(2026, floorYear2026, 1995))).toEqual([euros(0), euros(1205.29), euros(-0.01)])
    expect(settle(2026, floorYear2026, 1996).youthRelief.label).toBe('Youth relief of 50% of the lower-rate tax')
    expect(floorYear2026.every((month) => month.incomeTax.amount === euros(100.44))).toBe(true)
  })

  it('moves the bands with the tax year', () => {
    const year2025 = yearOfSalary(2025, 0)
    const year2027 = yearOfSalary(2027, 0)
    const lower2025 = settle(2025, year2025, null).lowerRateTax.amount
    const lower2027 = settle(2027, year2027, null).lowerRateTax.amount

    // 2025: born 2000 or later 100%, 1995 to 1999 50%.
    expect(settle(2025, year2025, 2000).youthRelief.amount).toBe(lower2025)
    expect(settle(2025, year2025, 1995).youthRelief.label).toContain('50%')
    expect(settle(2025, year2025, 1994).youthRelief.amount).toBe(euros(0))
    // 2027: born 2002 or later 100%, 1997 to 2001 50%.
    expect(settle(2027, year2027, 2002).youthRelief.amount).toBe(lower2027)
    expect(settle(2027, year2027, 1997).youthRelief.label).toContain('50%')
    expect(settle(2027, year2027, 1996).youthRelief.amount).toBe(euros(0))
  })

  it('cuts only the lower-rate tax when the year reaches the higher rate', () => {
    // 12 x 8,000.00: income 12 x 6,400.00 = 76,800.00, taxable 69,600.00.
    // 23% x 60,000.00 = 13,800.00 and 33% x 9,600.00 = 3,168.00, so 16,968.00, which is 12 x 1,414.00 withheld.
    // Born 1998, 50% of 13,800.00 = 6,900.00 comes back.
    const highYear = yearOfSalary(2026, 8000)

    expect(outcome(settle(2026, highYear, null))).toEqual([euros(0), euros(16968), euros(0)])
    const relieved = settle(2026, highYear, 1998)
    expect([relieved.lowerRateTax.amount, relieved.higherRateTax.amount]).toEqual([euros(13800), euros(3168)])
    expect(outcome(relieved)).toEqual([euros(6900), euros(10068), euros(6900)])
  })

  it('refunds the tax of a part year, counting only the salaries paid in it', () => {
    // Employed from 10 June 2026, paid on the 10th of the next month. June is 15 of 22 working days:
    // income 737.87, 31.71 withheld. July to November: income 1,036.70 and 100.44 withheld each.
    // The December salary is paid on 11 January 2027, so it belongs to 2027.
    // Income 737.87 + 5 x 1,036.70 = 5,921.37 is below the 7,200.00 allowance, so the tax is 0.00.
    // Refund 31.71 + 5 x 100.44 = 533.91.
    const partYear = [6, 7, 8, 9, 10, 11, 12].map((workedNumber) => {
      const workedMonth = monthKey(2026, workedNumber)
      const partMonth = workedNumber === 6
      return payrollMonth(
        {
          workedMonth,
          paidOn: workedNumber === 12 ? civil('2027-01-11') : civil(`2026-${String(workedNumber + 1).padStart(2, '0')}-10`),
          agreedMonthlyGross: euros(0),
          daysWorked: partMonth ? 15 : 21,
          workingDaysInMonth: partMonth ? 22 : 21,
          nontaxablePayments: [],
          basis: 'plan',
        },
        ZAGREB_RESIDENT,
      )
    })
    const settlement = settle(2026, partYear, 1990)

    expect(settlement.income.steps.map((step) => [step.label, step.on])[0]).toEqual(['Income for 2026-06, paid on', '2026-07-10'])
    expect(settlement.income.steps).toHaveLength(6)
    expect([settlement.income.amount, settlement.taxableIncome.amount, settlement.withheld.amount]).toEqual([
      euros(5921.37),
      euros(0),
      euros(533.91),
    ])
    expect(outcome(settlement)).toEqual([euros(0), euros(0), euros(533.91)])
    expect(settle(2027, partYear, 1990).income.steps).toHaveLength(1)
  })
})
