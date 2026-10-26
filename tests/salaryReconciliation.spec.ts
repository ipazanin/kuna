import { describe, expect, it } from 'vitest'

import type { DefinedBucket } from '../src/features/workbook/domain/bucket'
import { BUCKET_COLOUR } from '../src/features/workbook/domain/categoryColour'
import type { Category, Transaction } from '../src/features/workbook/domain/workbook'
import type { SalaryWorkbook } from '../src/packs/hr-doo/domain/accountant/salaryWorkbook'
import { readSalaryWorkbook } from '../src/packs/hr-doo/domain/accountant/salaryWorkbookReading'
import type { Employee } from '../src/packs/hr-doo/domain/employees/employees'
import { HR_DOO_PART } from '../src/packs/hr-doo/domain/hrDooPart'
import { CONTRIBUTION_ACCOUNTS } from '../src/packs/hr-doo/domain/salaries/contributionAccounts'
import { salaryReconciliation } from '../src/packs/hr-doo/domain/salaries/salaryReconciliation'
import type { EmployeeLine, SalaryPayday, SalaryProblem } from '../src/packs/hr-doo/domain/salaries/salaryReconciliation'
import { amountOf, sumMoney } from '../src/shared/money/money'
import type { Money } from '../src/shared/money/money'
import { month, salaryTabs } from './fixtures/accountantWorkbooks'
import type { SalarySpec } from './fixtures/accountantWorkbooks'
import { director } from './fixtures/employees'
import { exampleStudio } from './fixtures/exampleStudio'
import { withPackBuckets } from './fixtures/hrDooCategories'
import { euros, ledger } from './fixtures/ledger'
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

function payslipOf(spec: SalarySpec): SalaryWorkbook {
  const reading = readSalaryWorkbook(month(spec.worked), salaryTabs(spec))
  if ('refusal' in reading || reading.document[0] === undefined) throw new Error('not read')
  return reading.document[0]
}

const MARCH = { worked: '2026-03', paid: '2026-04-10' } as const

/** Five made-up employees paid on 10 April 2026 for March, with their payslips. */
const FIVE: readonly { readonly employee: Employee; readonly payslip: SalaryWorkbook }[] = [
  {
    employee: employee('ana', 'Ana Primjer', 'XX00FAKE0000000000000101', { pension_pillar_2: false }),
    payslip: payslipOf({ ...MARCH, agreed: 1800, employee: 'Ana Primjer', pensionPillarTwo: false }),
  },
  { employee: employee('ivo', 'Ivo Uzorak', 'XX00FAKE0000000000000102'), payslip: payslipOf({ ...MARCH, agreed: 13_000, employee: 'Ivo Uzorak' }) },
  {
    employee: employee('mara', 'Mara Test', 'XX00FAKE0000000000000103', { dependants: '2' }),
    payslip: payslipOf({ ...MARCH, agreed: 2500, employee: 'Mara Test', dependants: 2 }),
  },
  {
    employee: employee('luka', 'Luka Proba', 'XX00FAKE0000000000000104'),
    payslip: payslipOf({ ...MARCH, agreed: 2000, employee: 'Luka Proba', nontaxable: [{ label: 'Prehrana', amount: 100, payment: 'meal-allowance-flat' }] }),
  },
  // From Monday 16 March 2026, 12 of the month's 22 weekdays, at the director floor.
  {
    employee: director({ iban: 'XX00FAKE0000000000000105', from: '2026-03-16' }),
    payslip: payslipOf({ ...MARCH, agreed: 'director-minimum', daysWorked: 12, employee: 'Dora Example' }),
  },
]

function totalOf(field: 'pensionPillarOne' | 'pensionPillarTwo' | 'health' | 'incomeTax'): number {
  return amountOf(sumMoney(FIVE.map((entry) => entry.payslip[field])))
}

/** The payday as the bank shows it: each net salary to its employee, each contribution to its payee in one sum for everyone, and a row in May so April is a complete month. */
function payrollRows(netShortBy: Readonly<Record<string, number>> = {}): RowSpec[] {
  return [
    ...FIVE.map(({ employee: person, payslip }) => ({
      date: '2026-04-10',
      amount: -(amountOf(payslip.paidToEmployee) - (netShortBy[person.slug] ?? 0)),
      category: 'salary-net',
      iban: person.ibans[0],
    })),
    { date: '2026-04-10', amount: -totalOf('pensionPillarOne'), category: 'payroll-contributions', iban: CONTRIBUTION_ACCOUNTS.pensionPillarOne },
    { date: '2026-04-10', amount: -totalOf('pensionPillarTwo'), category: 'payroll-contributions', iban: CONTRIBUTION_ACCOUNTS.pensionPillarTwo },
    { date: '2026-04-10', amount: -totalOf('health'), category: 'payroll-contributions', iban: CONTRIBUTION_ACCOUNTS.health },
    { date: '2026-04-10', amount: -totalOf('incomeTax'), category: 'payroll-tax', iban: CITY_TAX_ACCOUNT },
    { date: '2026-05-04', amount: -20, category: 'office' },
  ]
}

function reconciled(rows: readonly RowSpec[] | readonly Transaction[], people: readonly Employee[], payslips: readonly SalaryWorkbook[]) {
  const transactions = rows.length > 0 && 'sequence' in rows[0]! ? (rows as readonly Transaction[]) : withPackBuckets(ledger(rows as readonly RowSpec[]), CATEGORIES)
  return salaryReconciliation(exampleStudio({ categories: CATEGORIES, transactions, employees: people, director: people.find((person) => person.director) ?? null }), payslips)
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
  return problems.map((problem) => `${problem.kind}${'employee' in problem && problem.employee !== null ? ` ${problem.employee.slug}` : ''}${problem.kind === 'line-differs' ? ` ${problem.check.line}` : ''}`)
}

const PEOPLE = FIVE.map((entry) => entry.employee)
const PAYSLIPS = FIVE.map((entry) => entry.payslip)

describe('salaryReconciliation', () => {
  it('lets a category carry the salary role and a role for each tax-free payment', () => {
    expect(HR_DOO_PART.categoryRoles).toEqual(expect.arrayContaining(['salary', 'tax-free:results-bonus', 'tax-free:occasional-gift', 'tax-free:meal-allowance-flat']))
  })

  it('ties five employees on one payday to their payslips, the engine and the bank, with a net row 10.00 short a problem on that employee only', () => {
    const { paydays } = reconciled(payrollRows({ luka: 10 }), PEOPLE, PAYSLIPS)
    const april = paydayOf(paydays, '2026-04')

    expect(problemKinds(april.problems)).toEqual(['line-differs luka paidToEmployee'])
    const luka = lineOf(april, 'luka', 'paidToEmployee')
    const paid = FIVE[3]!.payslip.paidToEmployee
    expect([luka?.payslip, luka?.app?.amount, luka?.bank?.amount]).toEqual([paid, paid, euros(amountOf(paid) - 10)])
    expect(april.contributions.every((check) => check.agrees)).toBe(true)
    expect(april.contributions.map((check) => check.bank?.amount)).toEqual([euros(totalOf('pensionPillarOne')), euros(totalOf('pensionPillarTwo')), euros(totalOf('health')), euros(totalOf('incomeTax'))])
  })

  it('works out each of the five as their payslips do', () => {
    const april = paydayOf(reconciled(payrollRows(), PEOPLE, PAYSLIPS).paydays, '2026-04')
    const app = (slug: string, line: EmployeeLine): Money | undefined => lineOf(april, slug, line)?.app?.amount
    expect(april.problems).toEqual([])
    // Without pillar II, pillar I is 20% of 1,800.00.
    expect([app('ana', 'pensionPillarOne'), app('ana', 'pensionPillarTwo')]).toEqual([euros(360), euros(0)])
    // 13,000.00 is over the 11,958.00 maximum base for pension, and health has no maximum.
    expect([app('ivo', 'pensionPillarOne'), app('ivo', 'pensionPillarTwo'), app('ivo', 'health')]).toEqual([euros(1793.7), euros(597.9), euros(2145)])
    // 600.00 for the employee, 0.5 and 0.7 of it for the first and second child.
    expect(app('mara', 'personalAllowance')).toBe(euros(1320))
    expect(april.employees.find((entry) => entry.employee.slug === 'dora')?.engine.kind).toBe('run')
    expect(april.employees.every((entry) => entry.lines.every((check) => check.agrees))).toBe(true)
  })

  it('splits the contributions by payee and lists each row in the build-up, so a stray row shows on its line', () => {
    const rows = [...payrollRows(), { date: '2026-04-19', amount: -0.05, category: 'payroll-contributions', iban: CONTRIBUTION_ACCOUNTS.health }]
    const april = paydayOf(reconciled(rows, PEOPLE, PAYSLIPS).paydays, '2026-04')
    expect(problemKinds(april.problems)).toEqual(['line-differs health'])
    const health = april.contributions.find((check) => check.line === 'health')
    expect(health?.bank?.amount).toBe(euros(totalOf('health') + 0.05))
    expect(health?.bank?.steps.map((step) => [step.on, step.amount])).toEqual([
      ['2026-04-19', euros(0.05)],
      ['2026-04-10', euros(totalOf('health'))],
    ])
  })

  it("runs the director at the floor for the month before a payday without a payslip, and reports the payslip as not read", () => {
    const dora = director({ iban: 'XX00FAKE0000000000000105' })
    const payslip = payslipOf({ worked: '2026-02', paid: '2026-03-10', agreed: 'director-minimum', employee: 'Dora Example' })
    const rows: RowSpec[] = [
      { date: '2026-03-10', amount: -amountOf(payslip.paidToEmployee), category: 'salary-net', iban: dora.ibans[0] },
      { date: '2026-03-10', amount: -amountOf(payslip.pensionPillarOne), category: 'payroll-contributions', iban: CONTRIBUTION_ACCOUNTS.pensionPillarOne },
      { date: '2026-03-10', amount: -amountOf(payslip.pensionPillarTwo), category: 'payroll-contributions', iban: CONTRIBUTION_ACCOUNTS.pensionPillarTwo },
      { date: '2026-03-10', amount: -amountOf(payslip.health), category: 'payroll-contributions', iban: CONTRIBUTION_ACCOUNTS.health },
      { date: '2026-03-10', amount: -amountOf(payslip.incomeTax), category: 'payroll-tax', iban: CITY_TAX_ACCOUNT },
      { date: '2026-04-02', amount: -20, category: 'office' },
    ]
    const march = paydayOf(reconciled(rows, [dora], []).paydays, '2026-03')
    expect(problemKinds(march.problems)).toEqual(['payslip-not-read dora'])
    expect(march.contributions.every((check) => check.agrees && check.payslip === null && check.app !== null && check.bank !== null)).toBe(true)
    const paid = lineOf(march, 'dora', 'paidToEmployee')
    expect([paid?.payslip, paid?.app, paid?.bank?.amount]).toEqual([null, null, payslip.paidToEmployee])
  })

  it('reports a contribution the bank paid differently from both the payslip and the engine, beside the payslip that differs from the engine', () => {
    const dora = director({ iban: 'XX00FAKE0000000000000105' })
    const payslip = payslipOf({ worked: '2026-02', paid: '2026-03-10', agreed: 'director-minimum', employee: 'Dora Example' })
    const misprinted = { ...payslip, incomeTax: euros(amountOf(payslip.incomeTax) + 0.5) }
    const rows = (incomeTaxPaid: number): RowSpec[] => [
      { date: '2026-03-10', amount: -amountOf(payslip.paidToEmployee), category: 'salary-net', iban: dora.ibans[0] },
      { date: '2026-03-10', amount: -amountOf(payslip.pensionPillarOne), category: 'payroll-contributions', iban: CONTRIBUTION_ACCOUNTS.pensionPillarOne },
      { date: '2026-03-10', amount: -amountOf(payslip.pensionPillarTwo), category: 'payroll-contributions', iban: CONTRIBUTION_ACCOUNTS.pensionPillarTwo },
      { date: '2026-03-10', amount: -amountOf(payslip.health), category: 'payroll-contributions', iban: CONTRIBUTION_ACCOUNTS.health },
      { date: '2026-03-10', amount: -incomeTaxPaid, category: 'payroll-tax', iban: CITY_TAX_ACCOUNT },
      { date: '2026-04-02', amount: -20, category: 'office' },
    ]
    const paidShort = paydayOf(reconciled(rows(amountOf(payslip.incomeTax) - 20), [dora], [misprinted]).paydays, '2026-03')
    expect(problemKinds(paidShort.problems)).toEqual(['line-differs dora incomeTax', 'line-differs incomeTax'])

    const paidAsTheEngine = paydayOf(reconciled(rows(amountOf(payslip.incomeTax)), [dora], [misprinted]).paydays, '2026-03')
    expect(problemKinds(paidAsTheEngine.problems)).toEqual(['line-differs dora incomeTax'])
  })

  it('reports a contribution paid in a month no one was paid', () => {
    const later = director({ iban: 'XX00FAKE0000000000000105', from: '2026-05-01' })
    const rows: RowSpec[] = [
      { date: '2026-03-02', amount: -20, category: 'office' },
      { date: '2026-03-20', amount: -5, category: 'payroll-tax', iban: CITY_TAX_ACCOUNT },
      { date: '2026-04-02', amount: -20, category: 'office' },
    ]
    const march = paydayOf(reconciled(rows, [later], []).paydays, '2026-03')
    expect(march.employees).toEqual([])
    expect(problemKinds(march.problems)).toEqual(['line-differs incomeTax'])
    const incomeTax = march.contributions.find((check) => check.line === 'incomeTax')
    expect([incomeTax?.payslip, incomeTax?.app?.amount, incomeTax?.bank?.amount]).toEqual([euros(0), euros(0), euros(5)])
  })

  it('reports pay to an account no employee has, a payslip whose tab names no employee, and a month the bank paid no one expected', () => {
    const [ana] = PEOPLE
    const rows: RowSpec[] = [
      { date: '2026-04-01', amount: -20, category: 'office' },
      { date: '2026-04-10', amount: -900, category: 'salary-net', iban: 'XX00FAKE0000000000000999' },
      { date: '2026-05-04', amount: -20, category: 'office' },
    ]
    const stranger = payslipOf({ ...MARCH, agreed: 1500, employee: 'Neznan Netko' })
    const april = paydayOf(reconciled(rows, [ana!], [stranger]).paydays, '2026-04')
    expect(problemKinds(april.problems)).toEqual(['payslip-of-no-employee', 'payslip-not-read ana', 'engine-not-run ana', 'no-pay-rows ana', 'pay-to-no-employee'])
  })

  it('works an employee below the director floor as the payslip does, and warns when the agreed gross is under the minimum wage', () => {
    const pay = (agreed: number, slug: string, name: string, account: string) => {
      const person = employee(slug, name, account)
      const payslip = payslipOf({ ...MARCH, agreed, employee: name, director: false })
      const rows: RowSpec[] = [
        { date: '2026-04-10', amount: -amountOf(payslip.paidToEmployee), category: 'salary-net', iban: account },
        { date: '2026-04-10', amount: -amountOf(payslip.pensionPillarOne), category: 'payroll-contributions', iban: CONTRIBUTION_ACCOUNTS.pensionPillarOne },
        { date: '2026-04-10', amount: -amountOf(payslip.pensionPillarTwo), category: 'payroll-contributions', iban: CONTRIBUTION_ACCOUNTS.pensionPillarTwo },
        { date: '2026-04-10', amount: -amountOf(payslip.health), category: 'payroll-contributions', iban: CONTRIBUTION_ACCOUNTS.health },
        { date: '2026-04-10', amount: -amountOf(payslip.incomeTax), category: 'payroll-tax', iban: CITY_TAX_ACCOUNT },
        { date: '2026-05-04', amount: -20, category: 'office' },
      ]
      return paydayOf(reconciled(rows, [person], [payslip]).paydays, '2026-04')
    }

    const ordinary = pay(1200, 'tea', 'Tea Primjer', 'XX00FAKE0000000000000106')
    // Zagreb taxes 23% of the 367.50 taxable income, 84.53, so the net is 967.50 - 84.53.
    expect([lineOf(ordinary, 'tea', 'gross')?.app?.amount, lineOf(ordinary, 'tea', 'net')?.app?.amount]).toEqual([euros(1200), euros(882.97)])
    expect(ordinary.employees.every((entry) => entry.lines.every((check) => check.agrees))).toBe(true)
    expect(problemKinds(ordinary.problems)).toEqual([])

    const underpaid = pay(1000, 'uma', 'Uma Primjer', 'XX00FAKE0000000000000107')
    expect(problemKinds(underpaid.problems)).toEqual(['below-minimum-wage uma'])
  })

  it('works an employee who is not the director out on the agreed gross of their row in a month without a payslip, and reports one without it', () => {
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
    const april = paydayOf(reconciled(rows, [tea], []).paydays, '2026-04')
    expect(problemKinds(april.problems)).toEqual(['payslip-not-read tea'])
    expect([lineOf(april, 'tea', 'gross')?.app?.amount, lineOf(april, 'tea', 'net')?.app?.amount]).toEqual([euros(1200), euros(882.97)])
    expect(april.contributions.every((check) => check.agrees && check.app !== null && check.bank !== null)).toBe(true)

    const unagreed = paydayOf(reconciled(rows, [{ ...tea, agreedGross: null }], []).paydays, '2026-04')
    expect(problemKinds(unagreed.problems)).toEqual(['payslip-not-read tea', 'engine-not-run tea'])
  })

  it('reports a payslip whose city or pillar II is not the employees tab', () => {
    const [ana] = FIVE
    const rows = [{ date: '2026-04-10', amount: -amountOf(ana!.payslip.paidToEmployee), category: 'salary-net', iban: ana!.employee.ibans[0] }]
    const moved = { ...ana!.employee, residenceCity: 'Split', pensionPillarTwo: true }
    const april = paydayOf(reconciled(rows, [moved], [ana!.payslip]).paydays, '2026-04')
    expect(april.problems.filter((problem) => problem.kind === 'payslip-facts-differ').map((problem) => problem.kind === 'payslip-facts-differ' && problem.fact)).toEqual([
      'residence-city',
      'pension-pillar-2',
    ])
  })

  it('counts a salary row split after booking whole, and a bonus paid on its own as pay the payslip does not list', () => {
    const [ana] = FIVE
    const net = amountOf(ana!.payslip.paidToEmployee)
    const rows: RowSpec[] = [
      { date: '2026-04-04', amount: -1200, category: 'results-bonus', iban: ana!.employee.ibans[0] },
      { date: '2026-04-10', amount: -(net + 180), category: 'salary-net', iban: ana!.employee.ibans[0] },
      { date: '2026-05-04', amount: -20, category: 'office' },
    ]
    const split = withSplit(withPackBuckets(ledger(rows), CATEGORIES), { date: '2026-04-10', amount: -(net + 180) }, [
      [-net, 'salary-net'],
      [-180, 'travel-orders', 'Travel order paid with the salary'],
    ], CATEGORIES)
    const april = paydayOf(reconciled(split, [ana!.employee], [ana!.payslip]).paydays, '2026-04')
    const paid = lineOf(april, 'ana', 'paidToEmployee')
    expect(paid?.bank?.amount).toBe(euros(net + 180 + 1200))
    expect(paid?.bank?.steps.map((step) => step.amount)).toEqual([euros(net + 180), euros(1200)])
    expect(paid?.agrees).toBe(false)
  })

  it('holds the tax-free payments paid on their own against their caps for the year', () => {
    const [ana] = FIVE
    const account = ana!.employee.ibans[0]
    const rows: RowSpec[] = [
      { date: '2026-02-04', amount: -1200, category: 'results-bonus', iban: account },
      { date: '2026-02-04', amount: -700, category: 'gifts', iban: account },
      { date: '2026-12-15', amount: -100, category: 'results-bonus', iban: account },
      { date: '2027-01-04', amount: -20, category: 'office' },
    ]
    const { paydays, extras } = reconciled(rows, [ana!.employee], [])
    const usage = extras.find((extra) => extra.year === 2026)?.usage ?? []
    expect(usage.map((entry) => [entry.payment, entry.paid.amount, entry.cap?.amount, entry.excess.amount])).toEqual([
      ['occasional-gift', euros(700), euros(700), euros(0)],
      ['results-bonus', euros(1300), euros(1200), euros(100)],
    ])
    expect(problemKinds(paydayOf(paydays, '2026-02').problems)).not.toContain('over-cap ana')
    expect(problemKinds(paydayOf(paydays, '2026-12').problems)).toContain('over-cap ana')
  })
})
