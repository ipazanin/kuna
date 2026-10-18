import { describe, expect, it } from 'vitest'

import { payrollMonth } from '../src/packs/hr-doo/domain/payroll/payrollMonth'
import type { NontaxablePayment, PayrollMonth, PayrollMonthInput } from '../src/packs/hr-doo/domain/payroll/payrollMonth'
import type { EmployeeFacts } from '../src/packs/hr-doo/domain/payroll/incomeTax'
import type { TracedFigure } from '../src/packs/hr-doo/ruleset/tracedFigure'
import { parseMonthKey } from '../src/shared/calendar/monthKey'
import type { MonthKey } from '../src/shared/calendar/monthKey'
import { sumMoney } from '../src/shared/money/money'
import { civil, euros } from './fixtures/ledger'
import { ZAGREB_RESIDENT } from './fixtures/zagrebResident'

function month(text: string): MonthKey {
  const key = parseMonthKey(text)
  if (key === null) {
    throw new Error(`${text} is not a month`)
  }
  return key
}

interface Salary {
  readonly worked: string
  readonly paid: string
  readonly agreed: number
  readonly days?: readonly [number, number]
  readonly nontaxable?: readonly NontaxablePayment[]
}

function salary(spec: Salary, facts: EmployeeFacts = ZAGREB_RESIDENT): PayrollMonth {
  const [daysWorked, workingDaysInMonth] = spec.days ?? [22, 22]
  const input: PayrollMonthInput = {
    workedMonth: month(spec.worked),
    paidOn: civil(spec.paid),
    agreedMonthlyGross: euros(spec.agreed),
    daysWorked,
    workingDaysInMonth,
    nontaxablePayments: spec.nontaxable ?? [],
    basis: 'plan',
  }
  return payrollMonth(input, facts)
}

function lines(payroll: PayrollMonth) {
  return {
    gross: payroll.gross.amount,
    relief: payroll.pensionRelief.amount,
    pillarOne: payroll.pensionPillarOne.amount,
    pillarTwo: payroll.pensionPillarTwo.amount,
    income: payroll.income.amount,
    allowance: payroll.personalAllowance.amount,
    taxable: payroll.taxableIncome.amount,
    tax: payroll.incomeTax.amount,
    net: payroll.net.amount,
    health: payroll.health.amount,
    employerCost: payroll.employerCost.amount,
    stateTake: payroll.stateTake.amount,
  }
}

function expected(figures: Record<keyof ReturnType<typeof lines>, number>) {
  return Object.fromEntries(Object.entries(figures).map(([line, amount]) => [line, euros(amount)]))
}

function ruleIds(figure: TracedFigure): readonly string[] {
  return figure.rules.map((citation) => citation.ruleId)
}

describe('payroll month of an employed director in Zagreb', () => {
  it('raises an agreed gross below the director floor to the floor, with the relief on pillar I only', () => {
    // 2026 floor 1,295.45. Relief 0.5 x (1,300.00 - 1,295.45) = 2.275, so 2.28.
    // Pillar I 15% x 1,293.17 = 193.9755, so 193.98. Pillar II 5% x 1,295.45 = 64.7725, so 64.77.
    // Income 1,295.45 - 193.98 - 64.77 = 1,036.70. Taxable 1,036.70 - 600.00 = 436.70.
    // Tax 23% x 436.70 = 100.441, so 100.44. Net 1,036.70 - 100.44 = 936.26.
    // Health 16.5% x 1,295.45 = 213.749, so 213.75. Gross II 1,509.20.
    // State 193.98 + 64.77 + 100.44 + 213.75 = 572.94.
    const payroll = salary({ worked: '2026-03', paid: '2026-04-10', agreed: 1000 })

    expect(lines(payroll)).toEqual(
      expected({
        gross: 1295.45,
        relief: 2.28,
        pillarOne: 193.98,
        pillarTwo: 64.77,
        income: 1036.7,
        allowance: 600,
        taxable: 436.7,
        tax: 100.44,
        net: 936.26,
        health: 213.75,
        employerCost: 1509.2,
        stateTake: 572.94,
      }),
    )
    expect(payroll.gross.steps.map((step) => [step.label, step.amount])).toEqual([
      ['Agreed monthly gross', euros(1000)],
      ['Director floor for a full month', euros(1295.45)],
    ])
    expect(payroll.pensionRelief.label).toContain('practice, not statute')
  })

  it('names the rules behind every line', () => {
    const payroll = salary({ worked: '2026-03', paid: '2026-04-10', agreed: 1000, nontaxable: [{ payment: 'meal-allowance-flat', amount: euros(100) }] })

    expect(ruleIds(payroll.gross)).toEqual(['hr.contrib.director-floor'])
    expect(ruleIds(payroll.pensionRelief)).toEqual(['hr.contrib.low-pay-relief'])
    expect(ruleIds(payroll.pensionPillarOne)).toEqual(['hr.contrib.rates'])
    expect(ruleIds(payroll.pensionPillarOne.steps[0] as TracedFigure)).toEqual(['hr.contrib.max-base', 'hr.contrib.low-pay-relief'])
    expect(ruleIds(payroll.personalAllowance)).toEqual(['hr.pit.allowance'])
    expect(ruleIds(payroll.incomeTax)).toEqual(['hr.pit.monthly-advance', 'hr.pit.brackets', 'hr.pit.local-rates'])
    expect(ruleIds(payroll.health)).toEqual(['hr.contrib.rates'])
    expect(ruleIds(payroll.nontaxablePayments)).toEqual(['hr.pit.nontaxable-caps'])
    expect(payroll.gross.rules[0]?.validFrom).toBe(civil('2026-01-01'))
    expect(ruleIds(payroll.stateTake)).toEqual(['hr.contrib.rates', 'hr.pit.monthly-advance', 'hr.pit.brackets', 'hr.pit.local-rates'])
    const { workedMonth, paidOn, ...figures } = payroll
    expect([workedMonth, paidOn]).toEqual(['2026-03', civil('2026-04-10')])
    expect(Object.values(figures).every((figure) => figure.rules.length > 0)).toBe(true)
    for (const figure of [payroll.income, payroll.taxableIncome, payroll.net, payroll.employerCost, payroll.paidToEmployee, payroll.stateTake]) {
      expect(sumMoney(figure.steps.map((step) => step.amount))).toBe(figure.amount)
      expect(figure.drill).toBeNull()
      expect(figure.basis).toBe('plan')
    }
  })

  it('gives the full 300.00 relief at a gross of 700.00 and half the gap above it', () => {
    // Agreed 1,400.00 for 11 of 22 working days is 700.00, which gets the full 300.00 off the pillar I base.
    // Pillar I 15% x 400.00 = 60.00. Pillar II 5% x 700.00 = 35.00. Income 605.00, taxable 5.00.
    // Tax 23% x 5.00 = 1.15. Net 603.85. Health 16.5% x 700.00 = 115.50. Gross II 815.50.
    // State 60.00 + 35.00 + 1.15 + 115.50 = 211.65.
    expect(lines(salary({ worked: '2026-03', paid: '2026-04-10', agreed: 1400, days: [11, 22] }))).toEqual(
      expected({
        gross: 700,
        relief: 300,
        pillarOne: 60,
        pillarTwo: 35,
        income: 605,
        allowance: 600,
        taxable: 5,
        tax: 1.15,
        net: 603.85,
        health: 115.5,
        employerCost: 815.5,
        stateTake: 211.65,
      }),
    )
    // 700.01: 0.5 x (1,300.00 - 700.01) = 299.995, which rounds back to 300.00.
    // Pillar I 15% x 400.01 = 60.0015, so 60.00. Pillar II 5% x 700.01 = 35.0005, so 35.00.
    // Income 605.01, taxable 5.01, tax 23% x 5.01 = 1.1523, so 1.15. Net 603.86.
    // Health 16.5% x 700.01 = 115.50165, so 115.50. Gross II 815.51.
    expect(lines(salary({ worked: '2026-03', paid: '2026-04-10', agreed: 1400.02, days: [11, 22] }))).toEqual(
      expected({
        gross: 700.01,
        relief: 300,
        pillarOne: 60,
        pillarTwo: 35,
        income: 605.01,
        allowance: 600,
        taxable: 5.01,
        tax: 1.15,
        net: 603.86,
        health: 115.5,
        employerCost: 815.51,
        stateTake: 211.65,
      }),
    )
    // 700.02: 0.5 x 599.98 = 299.99, where the partial reduction shows.
    expect(salary({ worked: '2026-03', paid: '2026-04-10', agreed: 1400.04, days: [11, 22] }).pensionRelief.amount).toBe(euros(299.99))
  })

  it('stops the relief at a gross of 1,300.00', () => {
    // 1,300.00: 0.5 x (1,300.00 - 1,300.00) = 0. Pillar I 195.00, pillar II 65.00, income 1,040.00, taxable 440.00.
    // Tax 23% x 440.00 = 101.20. Net 938.80. Health 214.50. Gross II 1,514.50. State 575.70.
    expect(lines(salary({ worked: '2026-03', paid: '2026-04-10', agreed: 1300 }))).toEqual(
      expected({
        gross: 1300,
        relief: 0,
        pillarOne: 195,
        pillarTwo: 65,
        income: 1040,
        allowance: 600,
        taxable: 440,
        tax: 101.2,
        net: 938.8,
        health: 214.5,
        employerCost: 1514.5,
        stateTake: 575.7,
      }),
    )
    // 1,300.01: no relief. Pillar I 195.0015, so 195.00. Pillar II 65.0005, so 65.00. Income 1,040.01.
    // Tax 23% x 440.01 = 101.2023, so 101.20. Net 938.81. Health 214.50165, so 214.50. Gross II 1,514.51.
    expect(lines(salary({ worked: '2026-03', paid: '2026-04-10', agreed: 1300.01 }))).toEqual(
      expected({
        gross: 1300.01,
        relief: 0,
        pillarOne: 195,
        pillarTwo: 65,
        income: 1040.01,
        allowance: 600,
        taxable: 440.01,
        tax: 101.2,
        net: 938.81,
        health: 214.5,
        employerCost: 1514.51,
        stateTake: 575.7,
      }),
    )
  })

  it('prorates a part month by working days and still gives the full allowance', () => {
    // 15 of June 2026's 22 working days: 1,295.45 x 15 / 22 = 883.2614, so 883.26.
    // Relief 0.5 x (1,300.00 - 883.26) = 208.37. Pillar I 15% x 674.89 = 101.2335, so 101.23.
    // Pillar II 5% x 883.26 = 44.163, so 44.16. Income 883.26 - 101.23 - 44.16 = 737.87.
    // The whole 600.00 allowance: taxable 137.87, tax 23% = 31.7101, so 31.71. Net 706.16.
    // Health 16.5% x 883.26 = 145.7379, so 145.74. Gross II 1,029.00. State 322.84.
    const payroll = salary({ worked: '2026-06', paid: '2026-07-10', agreed: 0, days: [15, 22] })

    expect(lines(payroll)).toEqual(
      expected({
        gross: 883.26,
        relief: 208.37,
        pillarOne: 101.23,
        pillarTwo: 44.16,
        income: 737.87,
        allowance: 600,
        taxable: 137.87,
        tax: 31.71,
        net: 706.16,
        health: 145.74,
        employerCost: 1029,
        stateTake: 322.84,
      }),
    )
    expect(payroll.gross.label).toBe('Gross salary for 15 of 22 working days')
  })

  it('puts the whole 20% into pillar I without pillar II', () => {
    // 2,000.00: pillar I 20% = 400.00, no pillar II. Income 1,600.00, taxable 1,000.00, tax 230.00.
    // Net 1,370.00. Health 330.00. Gross II 2,330.00. State 400.00 + 230.00 + 330.00 = 960.00.
    expect(lines(salary({ worked: '2026-03', paid: '2026-04-10', agreed: 2000 }, { ...ZAGREB_RESIDENT, pensionPillarTwo: false }))).toEqual(
      expected({
        gross: 2000,
        relief: 0,
        pillarOne: 400,
        pillarTwo: 0,
        income: 1600,
        allowance: 600,
        taxable: 1000,
        tax: 230,
        net: 1370,
        health: 330,
        employerCost: 2330,
        stateTake: 960,
      }),
    )
  })

  it('taxes a monthly base above 5,000.00 at the higher rate', () => {
    // 8,000.00: pillar I 1,200.00, pillar II 400.00, income 6,400.00, taxable 5,800.00.
    // Tax 23% x 5,000.00 = 1,150.00 plus 33% x 800.00 = 264.00, so 1,414.00. Net 4,986.00.
    // Health 1,320.00. Gross II 9,320.00. State 1,200.00 + 400.00 + 1,414.00 + 1,320.00 = 4,334.00.
    const payroll = salary({ worked: '2026-03', paid: '2026-04-10', agreed: 8000 })

    expect(lines(payroll)).toEqual(
      expected({
        gross: 8000,
        relief: 0,
        pillarOne: 1200,
        pillarTwo: 400,
        income: 6400,
        allowance: 600,
        taxable: 5800,
        tax: 1414,
        net: 4986,
        health: 1320,
        employerCost: 9320,
        stateTake: 4334,
      }),
    )
    expect(payroll.incomeTax.steps.map((step) => [step.label, step.amount])).toEqual([
      ['At the lower rate of 23%', euros(1150)],
      ['At the higher rate of 33%', euros(264)],
    ])
  })

  it('stops pension at the maximum base and keeps health on the whole gross', () => {
    // 14,000.00 against the 2026 maximum of 11,958.00: pillar I 15% x 11,958.00 = 1,793.70, pillar II 597.90.
    // Income 14,000.00 - 1,793.70 - 597.90 = 11,608.40. Taxable 11,008.40.
    // Tax 1,150.00 + 33% x 6,008.40 = 1,982.772, so 1,982.77, in all 3,132.77. Net 8,475.63.
    // Health 16.5% x 14,000.00 = 2,310.00. Gross II 16,310.00. State 1,793.70 + 597.90 + 3,132.77 + 2,310.00 = 7,834.37.
    const payroll = salary({ worked: '2026-03', paid: '2026-04-10', agreed: 14000 })

    expect(lines(payroll)).toEqual(
      expected({
        gross: 14000,
        relief: 0,
        pillarOne: 1793.7,
        pillarTwo: 597.9,
        income: 11608.4,
        allowance: 600,
        taxable: 11008.4,
        tax: 3132.77,
        net: 8475.63,
        health: 2310,
        employerCost: 16310,
        stateTake: 7834.37,
      }),
    )
    expect(payroll.pensionPillarTwo.steps[0]?.label).toBe('Gross, capped at the maximum pension base')
  })

  it('adds a multiple of the allowance for each dependant and never taxes below zero', () => {
    // Two dependants: 600.00 + 0.5 x 600.00 + 0.7 x 600.00 = 1,320.00, above the income of 1,036.70.
    const payroll = salary({ worked: '2026-03', paid: '2026-04-10', agreed: 1000 }, { ...ZAGREB_RESIDENT, dependants: 2 })

    expect(payroll.personalAllowance.steps.map((step) => step.amount)).toEqual([euros(600), euros(300), euros(420)])
    expect([payroll.personalAllowance.amount, payroll.taxableIncome.amount, payroll.incomeTax.amount, payroll.net.amount]).toEqual([
      euros(1320),
      euros(0),
      euros(0),
      euros(1036.7),
    ])
  })

  it('keeps non-taxable payments apart from the salary and adds them to what is paid and what it costs', () => {
    // The floor salary of the first case plus 100.00 for meals and 35.00 for commuting.
    // Paid 936.26 + 135.00 = 1,071.26. Cost 1,509.20 + 135.00 = 1,644.20. Tax and state take are unchanged.
    const payroll = salary({
      worked: '2026-03',
      paid: '2026-04-10',
      agreed: 1000,
      nontaxable: [
        { payment: 'meal-allowance-flat', amount: euros(100) },
        { payment: 'commuting-ticket', amount: euros(35) },
      ],
    })

    expect([payroll.nontaxablePayments.amount, payroll.paidToEmployee.amount, payroll.totalCompanyCost.amount]).toEqual([
      euros(135),
      euros(1071.26),
      euros(1644.2),
    ])
    expect([payroll.gross.amount, payroll.incomeTax.amount, payroll.stateTake.amount]).toEqual([euros(1295.45), euros(100.44), euros(572.94)])
    expect(payroll.nontaxablePayments.steps.map((step) => step.label)).toEqual(['meal-allowance-flat', 'commuting-ticket'])
  })

  it('takes the contribution bases of the month worked and the tax rules of the payment date', () => {
    // December 2025 paid on 12 January 2026 keeps the 2025 floor of 1,168.70.
    // Relief 0.5 x 131.30 = 65.65. Pillar I 15% x 1,103.05 = 165.4575, so 165.46. Pillar II 58.435, so 58.44.
    // Income 944.80, taxable 344.80, tax 23% = 79.304, so 79.30. Net 865.50.
    // Health 16.5% x 1,168.70 = 192.8355, so 192.84. Gross II 1,361.54.
    const payroll = salary({ worked: '2025-12', paid: '2026-01-12', agreed: 0 })

    expect([payroll.gross.amount, payroll.pensionRelief.amount, payroll.pensionPillarOne.amount, payroll.pensionPillarTwo.amount]).toEqual([
      euros(1168.7),
      euros(65.65),
      euros(165.46),
      euros(58.44),
    ])
    expect([payroll.incomeTax.amount, payroll.net.amount, payroll.health.amount, payroll.employerCost.amount]).toEqual([
      euros(79.3),
      euros(865.5),
      euros(192.84),
      euros(1361.54),
    ])
    expect(payroll.gross.rules[0]?.validTo).toBe(civil('2025-12-31'))
  })

  it('refuses a city the ruleset has no rates for, an unknown payment and a salary paid before its month', () => {
    const input: PayrollMonthInput = {
      workedMonth: month('2026-03'),
      paidOn: civil('2026-04-10'),
      agreedMonthlyGross: euros(1000),
      daysWorked: 22,
      workingDaysInMonth: 22,
      nontaxablePayments: [],
      basis: 'plan',
    }

    expect(() => payrollMonth(input, { ...ZAGREB_RESIDENT, residenceCity: 'Atlantis' })).toThrow('"Atlantis" is not a Croatian city or municipality')
    expect(() => payrollMonth({ ...input, nontaxablePayments: [{ payment: 'gym', amount: euros(30) }] }, ZAGREB_RESIDENT)).toThrow(
      'gym is not a non-taxable payment',
    )
    expect(() => payrollMonth({ ...input, paidOn: civil('2026-02-27') }, ZAGREB_RESIDENT)).toThrow('cannot be paid on')
    expect(() => payrollMonth({ ...input, daysWorked: 23 }, ZAGREB_RESIDENT)).toThrow('not a share of a month')
    expect(() => payrollMonth(input, { ...ZAGREB_RESIDENT, dependants: 6 })).toThrow('outside the 5 positions')
  })
})
