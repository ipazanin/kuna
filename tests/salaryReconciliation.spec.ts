import { describe, expect, it } from 'vitest'

import type { DefinedBucket } from '../src/apps/company/workbook/domain/bucket'
import { BUCKET_COLOUR } from '../src/apps/company/workbook/domain/categoryColour'
import type { Category, Transaction } from '../src/apps/company/workbook/domain/workbook'
import { weekdaysEmployed } from '../src/apps/company/packs/hr-doo/domain/employees/employees'
import type { Employee } from '../src/apps/company/packs/hr-doo/domain/employees/employees'
import { HR_DOO_PART } from '../src/apps/company/packs/hr-doo/domain/hrDooPart'
import { payrollMonth } from '../src/apps/company/packs/hr-doo/domain/payroll/payrollMonth'
import type { PayrollMonth } from '../src/apps/company/packs/hr-doo/domain/payroll/payrollMonth'
import { CONTRIBUTION_ACCOUNTS } from '../src/apps/company/packs/hr-doo/domain/salaries/contributionAccounts'
import { salaryReconciliation } from '../src/apps/company/packs/hr-doo/domain/salaries/salaryReconciliation'
import type { EmployeeLine, SalaryPayday, SalaryProblem } from '../src/apps/company/packs/hr-doo/domain/salaries/salaryReconciliation'
import { ruleValue } from '../src/apps/company/packs/hr-doo/ruleset/ruleset'
import { weekdaysBetween } from '../src/shared/calendar/civilDate'
import { addMonths, firstDayOf, lastDayOf } from '../src/shared/calendar/monthKey'
import { ZERO, amountOf, sumMoney } from '../src/shared/money/money'
import type { Money } from '../src/shared/money/money'
import { director } from './fixtures/employees'
import { exampleStudio } from './fixtures/exampleStudio'
import { withPackBuckets } from './fixtures/hrDooCategories'
import { euros, ledger, month } from './fixtures/ledger'
import type { RowSpec } from './fixtures/ledger'
import { withSplit } from './fixtures/splits'

function category(slug: string, bucket: DefinedBucket, roles: readonly string[]): Category {
  return { slug, family: bucket, bucket, colour: BUCKET_COLOUR, roles, vat: 'none', ownerShare: null }
}

const CATEGORIES: readonly Category[] = [
  category('salary-net', 'owner-pay', ['salary', 'arrears']),
  category('results-bonus', 'owner-pay', ['tax-free:results-bonus']),
  category('gifts', 'owner-pay', ['tax-free:occasional-gift']),
  category('rent-owner', 'owner-pay', ['watched', 'arrears']),
  category('payroll-contributions', 'taxes', ['owner-pay-tax', 'watched', 'arrears']),
  category('payroll-tax', 'taxes', ['owner-pay-tax', 'arrears']),
  category('dividend-tax', 'taxes', ['owner-pay-tax', 'profit-distribution']),
  category('travel-orders', 'operating', []),
  category('office', 'operating', []),
]

const CITY_TAX_ACCOUNT = 'XX00FAKECITY000000000001'

/** A made-up employee in Zagreb, employed from 2025, paid into one made-up account. */
function employee(slug: string, name: string, account: string, changes: Record<string, string | boolean> = {}): Employee {
  return director({ employee: slug, name, iban: account, director: false, ...changes })
}

/** The worked month as the engine runs it for the payday after it, paid on that payday's last day. */
function engineMonth(person: Employee, worked: string): PayrollMonth {
  const key = month(worked)
  return payrollMonth(
    {
      workedMonth: key,
      paidOn: lastDayOf(addMonths(key, 1)),
      agreedMonthlyGross: person.agreedGross ?? ZERO,
      daysWorked: weekdaysEmployed(person, key) ?? 0,
      workingDaysInMonth: weekdaysBetween(firstDayOf(key), lastDayOf(key)),
      nontaxablePayments: [],
      basis: 'assumption',
    },
    person,
    ruleValue,
  )
}

/** Five made-up employees paid on 10 April 2026 for March, the last from Monday 16 March at the director floor. */
const PEOPLE: readonly Employee[] = [
  employee('ana', 'Ana Primjer', 'XX00FAKE0000000000000101', { pension_pillar_2: false, agreed_gross: '1800' }),
  employee('ivo', 'Ivo Uzorak', 'XX00FAKE0000000000000102', { agreed_gross: '13000' }),
  employee('mara', 'Mara Test', 'XX00FAKE0000000000000103', { dependants: '2', agreed_gross: '2500' }),
  employee('luka', 'Luka Proba', 'XX00FAKE0000000000000104', { agreed_gross: '2000' }),
  director({ iban: 'XX00FAKE0000000000000105', from: '2026-03-16' }),
]

const MARCH = PEOPLE.map((person) => engineMonth(person, '2026-03'))

function totalOf(field: 'pensionPillarOne' | 'pensionPillarTwo' | 'health' | 'incomeTax'): number {
  return amountOf(sumMoney(MARCH.map((payroll) => payroll[field].amount)))
}

/** The payday as the bank shows it: each net salary to its employee, each contribution to its payee in one sum for everyone, and a row in May so April is a complete month. */
function payrollRows(): RowSpec[] {
  return [
    ...PEOPLE.map((person, index) => ({ date: '2026-04-10', amount: -amountOf(MARCH[index]!.net.amount), category: 'salary-net', iban: person.ibans[0] })),
    { date: '2026-04-10', amount: -totalOf('pensionPillarOne'), category: 'payroll-contributions', iban: CONTRIBUTION_ACCOUNTS.pensionPillarOne },
    { date: '2026-04-10', amount: -totalOf('pensionPillarTwo'), category: 'payroll-contributions', iban: CONTRIBUTION_ACCOUNTS.pensionPillarTwo },
    { date: '2026-04-10', amount: -totalOf('health'), category: 'payroll-contributions', iban: CONTRIBUTION_ACCOUNTS.health },
    { date: '2026-04-10', amount: -totalOf('incomeTax'), category: 'payroll-tax', iban: CITY_TAX_ACCOUNT },
    { date: '2026-05-04', amount: -20, category: 'office' },
  ]
}

/** One employee's payday as the bank pays the engine's figures, with the income tax paid as given. */
function oneEmployeeRows(person: Employee, worked: string, paidOn: string, incomeTaxPaid?: number): RowSpec[] {
  const payroll = engineMonth(person, worked)
  return [
    { date: paidOn, amount: -amountOf(payroll.net.amount), category: 'salary-net', iban: person.ibans[0] },
    { date: paidOn, amount: -amountOf(payroll.pensionPillarOne.amount), category: 'payroll-contributions', iban: CONTRIBUTION_ACCOUNTS.pensionPillarOne },
    { date: paidOn, amount: -amountOf(payroll.pensionPillarTwo.amount), category: 'payroll-contributions', iban: CONTRIBUTION_ACCOUNTS.pensionPillarTwo },
    { date: paidOn, amount: -amountOf(payroll.health.amount), category: 'payroll-contributions', iban: CONTRIBUTION_ACCOUNTS.health },
    { date: paidOn, amount: -(incomeTaxPaid ?? amountOf(payroll.incomeTax.amount)), category: 'payroll-tax', iban: CITY_TAX_ACCOUNT },
  ]
}

function reconciled(rows: readonly RowSpec[] | readonly Transaction[], people: readonly Employee[]) {
  const transactions = rows.length > 0 && 'sequence' in rows[0]! ? (rows as readonly Transaction[]) : withPackBuckets(ledger(rows as readonly RowSpec[]), CATEGORIES)
  return salaryReconciliation(exampleStudio({ categories: CATEGORIES, transactions, employees: people, director: people.find((person) => person.director) ?? null }))
}

function paydayOf(paydays: readonly SalaryPayday[], payday: string): SalaryPayday {
  const found = paydays.find((entry) => entry.payday === month(payday))
  if (found === undefined) throw new Error(`no payday ${payday}`)
  return found
}

function lineOf(payday: SalaryPayday, slug: string, line: EmployeeLine) {
  return payday.employees.find((entry) => entry.employee.slug === slug)?.lines.find((check) => check.line === line)
}

function problemKinds(problems: readonly SalaryProblem[]): string[] {
  return problems.map(
    (problem) => `${problem.kind}${'employee' in problem && problem.employee !== null ? ` ${problem.employee.slug}` : ''}${problem.kind === 'line-differs' ? ` ${problem.check.line}` : ''}`,
  )
}

describe('salaryReconciliation', () => {
  it('lets a category carry the salary role and a role for each tax-free payment', () => {
    expect(HR_DOO_PART.categoryRoles).toEqual(expect.arrayContaining(['salary', 'tax-free:results-bonus', 'tax-free:occasional-gift', 'tax-free:meal-allowance-flat']))
  })

  it('ties five employees on one payday to the engine and the bank, each contribution to its payee', () => {
    const april = paydayOf(reconciled(payrollRows(), PEOPLE).paydays, '2026-04')

    expect(april.problems).toEqual([])
    expect(april.employees.map((entry) => entry.employee.slug)).toEqual(['ana', 'ivo', 'mara', 'luka', 'dora'])
    expect(april.contributions.every((check) => check.agrees)).toBe(true)
    expect(april.contributions.map((check) => check.bank?.amount)).toEqual([
      euros(totalOf('pensionPillarOne')),
      euros(totalOf('pensionPillarTwo')),
      euros(totalOf('health')),
      euros(totalOf('incomeTax')),
    ])
    const luka = lineOf(april, 'luka', 'paidToEmployee')
    expect([luka?.app, luka?.bank?.amount]).toEqual([null, MARCH[3]!.net.amount])
  })

  it('works out each of the five on the agreed gross of their row', () => {
    const april = paydayOf(reconciled(payrollRows(), PEOPLE).paydays, '2026-04')
    const app = (slug: string, line: EmployeeLine): Money | undefined => lineOf(april, slug, line)?.app?.amount
    // Without pillar II, pillar I is 20% of 1,800.00.
    expect([app('ana', 'pensionPillarOne'), app('ana', 'pensionPillarTwo')]).toEqual([euros(360), euros(0)])
    // 13,000.00 is over the 11,958.00 maximum base for pension, and health has no maximum.
    expect([app('ivo', 'pensionPillarOne'), app('ivo', 'pensionPillarTwo'), app('ivo', 'health')]).toEqual([euros(1793.7), euros(597.9), euros(2145)])
    // 600.00 for the employee, 0.5 and 0.7 of it for the first and second child.
    expect(app('mara', 'personalAllowance')).toBe(euros(1320))
    expect(april.employees.every((entry) => entry.engine.kind === 'run')).toBe(true)
  })

  it('splits the contributions by payee and lists each row in the build-up, so a stray row shows on its line', () => {
    const rows = [...payrollRows(), { date: '2026-04-19', amount: -0.05, category: 'payroll-contributions', iban: CONTRIBUTION_ACCOUNTS.health }]
    const april = paydayOf(reconciled(rows, PEOPLE).paydays, '2026-04')
    expect(problemKinds(april.problems)).toEqual(['line-differs health'])
    const health = april.contributions.find((check) => check.line === 'health')
    expect(health?.bank?.amount).toBe(euros(totalOf('health') + 0.05))
    expect(health?.bank?.steps.map((step) => [step.on, step.amount])).toEqual([
      ['2026-04-19', euros(0.05)],
      ['2026-04-10', euros(totalOf('health'))],
    ])
  })

  it('runs the director at the floor for the month before a payday', () => {
    const dora = director({ iban: 'XX00FAKE0000000000000105' })
    const rows = [...oneEmployeeRows(dora, '2026-02', '2026-03-10'), { date: '2026-04-02', amount: -20, category: 'office' }]
    const march = paydayOf(reconciled(rows, [dora]).paydays, '2026-03')
    expect(march.problems).toEqual([])
    expect(march.contributions.every((check) => check.agrees && check.app !== null && check.bank !== null)).toBe(true)
    const paid = lineOf(march, 'dora', 'paidToEmployee')
    expect([paid?.app, paid?.bank?.amount]).toEqual([null, engineMonth(dora, '2026-02').net.amount])
  })

  it('reports a contribution the bank paid differently from the engine', () => {
    const dora = director({ iban: 'XX00FAKE0000000000000105' })
    const incomeTax = amountOf(engineMonth(dora, '2026-02').incomeTax.amount)
    const rows = (incomeTaxPaid: number): RowSpec[] => [...oneEmployeeRows(dora, '2026-02', '2026-03-10', incomeTaxPaid), { date: '2026-04-02', amount: -20, category: 'office' }]

    expect(problemKinds(paydayOf(reconciled(rows(incomeTax - 20), [dora]).paydays, '2026-03').problems)).toEqual(['line-differs incomeTax'])
    expect(paydayOf(reconciled(rows(incomeTax), [dora]).paydays, '2026-03').problems).toEqual([])
  })

  it('reports a contribution paid in a month no one was paid', () => {
    const later = director({ iban: 'XX00FAKE0000000000000105', from: '2026-05-01' })
    const rows: RowSpec[] = [
      { date: '2026-03-02', amount: -20, category: 'office' },
      { date: '2026-03-20', amount: -5, category: 'payroll-tax', iban: CITY_TAX_ACCOUNT },
      { date: '2026-04-02', amount: -20, category: 'office' },
    ]
    const march = paydayOf(reconciled(rows, [later]).paydays, '2026-03')
    expect(march.employees).toEqual([])
    expect(problemKinds(march.problems)).toEqual(['line-differs incomeTax'])
    const incomeTax = march.contributions.find((check) => check.line === 'incomeTax')
    expect([incomeTax?.app?.amount, incomeTax?.bank?.amount]).toEqual([euros(0), euros(5)])
  })

  it('reports pay to an account no employee has, and a month the bank paid no one expected', () => {
    const ana = { ...PEOPLE[0]!, agreedGross: null }
    const rows: RowSpec[] = [
      { date: '2026-04-01', amount: -20, category: 'office' },
      { date: '2026-04-10', amount: -900, category: 'salary-net', iban: 'XX00FAKE0000000000000999' },
      { date: '2026-05-04', amount: -20, category: 'office' },
    ]
    const april = paydayOf(reconciled(rows, [ana]).paydays, '2026-04')
    expect(problemKinds(april.problems)).toEqual(['engine-not-run ana', 'no-pay-rows ana', 'pay-to-no-employee'])
  })

  it('works an employee who is not the director out on the agreed gross of their row, and warns when it is under the minimum wage', () => {
    const tea = employee('tea', 'Tea Primjer', 'XX00FAKE0000000000000106', { agreed_gross: '1200' })
    // 1,200.00 with pillar II in Zagreb: pillar I 172.50 after the 50.00 relief, pillar II 60.00, health 198.00, and 23% of 367.50 taxable, 84.53.
    const rows: RowSpec[] = [
      { date: '2026-04-10', amount: -882.97, category: 'salary-net', iban: tea.ibans[0] },
      { date: '2026-04-10', amount: -172.5, category: 'payroll-contributions', iban: CONTRIBUTION_ACCOUNTS.pensionPillarOne },
      { date: '2026-04-10', amount: -60, category: 'payroll-contributions', iban: CONTRIBUTION_ACCOUNTS.pensionPillarTwo },
      { date: '2026-04-10', amount: -198, category: 'payroll-contributions', iban: CONTRIBUTION_ACCOUNTS.health },
      { date: '2026-04-10', amount: -84.53, category: 'payroll-tax', iban: CITY_TAX_ACCOUNT },
      { date: '2026-05-04', amount: -20, category: 'office' },
    ]
    const april = paydayOf(reconciled(rows, [tea]).paydays, '2026-04')
    expect(april.problems).toEqual([])
    expect([lineOf(april, 'tea', 'gross')?.app?.amount, lineOf(april, 'tea', 'net')?.app?.amount]).toEqual([euros(1200), euros(882.97)])
    expect(april.contributions.every((check) => check.agrees && check.app !== null && check.bank !== null)).toBe(true)

    const unagreed = paydayOf(reconciled(rows, [{ ...tea, agreedGross: null }]).paydays, '2026-04')
    expect(problemKinds(unagreed.problems)).toEqual(['engine-not-run tea'])

    const uma = employee('uma', 'Uma Primjer', 'XX00FAKE0000000000000107', { agreed_gross: '1000' })
    const underpaid = paydayOf(reconciled([...oneEmployeeRows(uma, '2026-03', '2026-04-10'), { date: '2026-05-04', amount: -20, category: 'office' }], [uma]).paydays, '2026-04')
    expect(problemKinds(underpaid.problems)).toEqual(['below-minimum-wage uma'])
  })

  it('counts a salary row split after booking whole, and a bonus paid on its own, in what the bank paid the employee', () => {
    const ana = PEOPLE[0]!
    const net = amountOf(MARCH[0]!.net.amount)
    const rows: RowSpec[] = [
      { date: '2026-04-04', amount: -1200, category: 'results-bonus', iban: ana.ibans[0] },
      { date: '2026-04-10', amount: -(net + 180), category: 'salary-net', iban: ana.ibans[0] },
      { date: '2026-05-04', amount: -20, category: 'office' },
    ]
    const split = withSplit(
      withPackBuckets(ledger(rows), CATEGORIES),
      { date: '2026-04-10', amount: -(net + 180) },
      [
        [-net, 'salary-net'],
        [-180, 'travel-orders', 'Travel order paid with the salary'],
      ],
      CATEGORIES,
    )
    const paid = lineOf(paydayOf(reconciled(split, [ana]).paydays, '2026-04'), 'ana', 'paidToEmployee')
    expect(paid?.bank?.amount).toBe(euros(net + 180 + 1200))
    expect(paid?.bank?.steps.map((step) => step.amount)).toEqual([euros(net + 180), euros(1200)])
  })

  it('holds the tax-free payments paid on their own against their caps for the year', () => {
    const ana = PEOPLE[0]!
    const account = ana.ibans[0]
    const rows: RowSpec[] = [
      { date: '2026-02-04', amount: -1200, category: 'results-bonus', iban: account },
      { date: '2026-02-04', amount: -700, category: 'gifts', iban: account },
      { date: '2026-12-15', amount: -100, category: 'results-bonus', iban: account },
      { date: '2027-01-04', amount: -20, category: 'office' },
    ]
    const { paydays, extras } = reconciled(rows, [ana])
    const usage = extras.find((extra) => extra.year === 2026)?.usage ?? []
    expect(usage.map((entry) => [entry.payment, entry.paid.amount, entry.cap?.amount, entry.excess.amount])).toEqual([
      ['occasional-gift', euros(700), euros(700), euros(0)],
      ['results-bonus', euros(1300), euros(1200), euros(100)],
    ])
    expect(problemKinds(paydayOf(paydays, '2026-02').problems)).not.toContain('over-cap ana')
    expect(problemKinds(paydayOf(paydays, '2026-12').problems)).toContain('over-cap ana')
  })
})
