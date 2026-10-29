import { describe, expect, it } from 'vitest'

import type { EmployeeFacts } from '../src/apps/company/packs/hr-doo/domain/payroll/incomeTax'
import { payrollMonth } from '../src/apps/company/packs/hr-doo/domain/payroll/payrollMonth'
import type { PayrollMonth, PayrollMonthInput } from '../src/apps/company/packs/hr-doo/domain/payroll/payrollMonth'
import { parseMonthKey } from '../src/shared/calendar/monthKey'
import { civil, euros } from './fixtures/ledger'
import { ZAGREB_RESIDENT } from './fixtures/zagrebResident'

// Bakar has no local decision, so it pays the no-decision rates of 20% and 30%.
const ORDINARY: EmployeeFacts = { ...ZAGREB_RESIDENT, residenceCity: 'Bakar', director: false }

function pay(agreed: number, changes: Partial<PayrollMonthInput> = {}, facts: EmployeeFacts = ORDINARY): PayrollMonth {
  const worked = parseMonthKey('2026-03')
  if (worked === null) throw new Error('not a month')
  return payrollMonth(
    { workedMonth: worked, paidOn: civil('2026-04-10'), agreedMonthlyGross: euros(agreed), daysWorked: 22, workingDaysInMonth: 22, nontaxablePayments: [], basis: 'plan', ...changes },
    facts,
  )
}

function ruleIds(figure: { readonly rules: readonly { readonly ruleId: string }[] }): readonly string[] {
  return figure.rules.map((citation) => citation.ruleId)
}

describe('the pay of an employee who is not the director', () => {
  it('works out 1,200.00 with pillar II without the director floor', () => {
    // Relief 0.5 x (1,300.00 - 1,200.00) = 50.00. Pillar I 15% x 1,150.00 = 172.50. Pillar II 5% x 1,200.00 = 60.00.
    // Income 1,200.00 - 172.50 - 60.00 = 967.50. Taxable 967.50 - 600.00 = 367.50. Tax 20% = 73.50.
    // Net 967.50 - 73.50 = 894.00. Health 16.5% x 1,200.00 = 198.00. Gross II 1,398.00.
    const payroll = pay(1200)

    expect(
      [
        payroll.gross,
        payroll.pensionRelief,
        payroll.pensionPillarOne,
        payroll.pensionPillarTwo,
        payroll.income,
        payroll.taxableIncome,
        payroll.incomeTax,
        payroll.net,
        payroll.health,
        payroll.employerCost,
      ].map((figure) => figure.amount),
    ).toEqual([1200, 50, 172.5, 60, 967.5, 367.5, 73.5, 894, 198, 1398].map(euros))
    expect(payroll.warnings).toEqual([])
    expect(ruleIds(payroll.gross)).toEqual([])
    expect(payroll.gross.steps.map((step) => step.label)).toEqual(['Agreed monthly gross'])
  })

  it('pays a part month as the agreed gross for the days worked', () => {
    expect(pay(1400, { daysWorked: 11, workingDaysInMonth: 22 }).gross.amount).toBe(euros(700))
  })

  it('still raises a director to the floor', () => {
    expect(pay(1000, {}, { ...ORDINARY, director: true }).gross.amount).toBe(euros(1295.45))
  })

  it('warns below the 1,050.00 minimum wage and cites the rule', () => {
    const [warning] = pay(1000).warnings
    expect(warning?.kind).toBe('below-minimum-wage')
    expect([warning?.agreed.amount, warning?.minimum.amount]).toEqual([euros(1000), euros(1050)])
    expect(warning === undefined ? [] : ruleIds(warning.minimum)).toEqual(['hr.minwage'])
    expect(pay(1050).warnings).toEqual([])
  })

  it('compares a full-time contract with the minimum wage, however many days of the month were worked', () => {
    expect(pay(1400, { daysWorked: 11, workingDaysInMonth: 22 }).warnings).toEqual([])
  })

  it('does not warn a director, whose floor is the lowest pay', () => {
    expect(pay(1000, {}, { ...ORDINARY, director: true }).warnings).toEqual([])
  })
})

describe('the annual maximum pension base', () => {
  it('caps a gross of 13,000.00 at the monthly maximum of 11,958.00 for both pillars, and health is not capped', () => {
    const payroll = pay(13_000)
    expect([payroll.pensionPillarOne.amount, payroll.pensionPillarTwo.amount, payroll.health.amount]).toEqual([1793.7, 597.9, 2145].map(euros))
  })

  it('stops pillar I in the month the annual maximum of 143,496.00 is reached, and leaves pillar II to the monthly maximum', () => {
    // 140,000.00 is behind, so 3,496.00 is left. Pillar I 15% x 3,496.00 = 524.40.
    const reaching = pay(13_000, { pensionBaseEarlierInYear: euros(140_000) })
    expect([reaching.pensionPillarOne.amount, reaching.pensionPillarTwo.amount]).toEqual([524.4, 597.9].map(euros))
    expect(ruleIds(reaching.pensionPillarOne.steps[0]!)).toEqual(['hr.contrib.max-base', 'hr.contrib.low-pay-relief'])

    const reached = pay(13_000, { pensionBaseEarlierInYear: euros(143_496) })
    expect([reached.pensionPillarOne.amount, reached.pensionPillarTwo.amount]).toEqual([0, 597.9].map(euros))
    expect(pay(13_000, { pensionBaseEarlierInYear: euros(150_000) }).pensionPillarOne.amount).toBe(euros(0))
  })

  it('leaves a salary alone while the year is below the maximum', () => {
    expect(pay(1200, { pensionBaseEarlierInYear: euros(100_000) }).pensionPillarOne.amount).toBe(euros(172.5))
  })

  it('refuses a negative earlier base', () => {
    expect(() => pay(1200, { pensionBaseEarlierInYear: euros(-1) })).toThrow(RangeError)
  })
})

describe('taxable extras', () => {
  it('taxes overtime with the salary, as part of the gross', () => {
    // 1,200.00 and 100.00 overtime is 1,300.00, so no relief. Pillar I 15% = 195.00, pillar II 5% = 65.00.
    // Income 1,040.00, taxable 440.00, tax 20% = 88.00, net 952.00, health 16.5% = 214.50.
    const payroll = pay(1200, { taxableExtras: [{ label: 'Overtime', amount: euros(100) }] })

    expect([payroll.gross, payroll.pensionRelief, payroll.pensionPillarOne, payroll.pensionPillarTwo, payroll.incomeTax, payroll.net, payroll.health].map((figure) => figure.amount)).toEqual(
      [1300, 0, 195, 65, 88, 952, 214.5].map(euros),
    )
    expect(payroll.gross.steps.map((step) => [step.label, step.amount])).toEqual([
      ['Gross salary', euros(1200)],
      ['Overtime', euros(100)],
    ])
  })

  it('adds the extras to the payments over their caps', () => {
    const payroll = pay(1200, { overCaps: { ...pay(1200).gross, label: 'Over caps', amount: euros(50) }, taxableExtras: [{ label: 'Night supplement', amount: euros(30) }] })
    expect(payroll.gross.amount).toBe(euros(1280))
  })

  it('ignores an extra of nothing and refuses a negative one', () => {
    expect(pay(1200, { taxableExtras: [{ label: 'Overtime', amount: euros(0) }] }).gross.steps.map((step) => step.label)).toEqual(['Agreed monthly gross'])
    expect(() => pay(1200, { taxableExtras: [{ label: 'Overtime', amount: euros(-1) }] })).toThrow(RangeError)
  })
})
