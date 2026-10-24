import { describe, expect, it } from 'vitest'

import { salaryMonthChecks, salaryRules } from '../src/packs/hr-doo/domain/accountant/payrollReconciliation'
import type { SalaryWorkbook } from '../src/packs/hr-doo/domain/accountant/salaryWorkbook'
import { readSalaryWorkbook } from '../src/packs/hr-doo/domain/accountant/salaryWorkbookReading'
import { rowDrill } from '../src/features/filters/domain/drillTarget'
import type { DefinedBucket } from '../src/features/workbook/domain/bucket'
import { BUCKET_COLOUR } from '../src/features/workbook/domain/categoryColour'
import type { Category, Transaction } from '../src/features/workbook/domain/workbook'
import { addMoney, amountOf, moneyFromCents, subtractMoney, sumMoney } from '../src/shared/money/money'
import { month, salaryTabs } from './fixtures/accountantWorkbooks'
import type { SalarySpec } from './fixtures/accountantWorkbooks'
import { exampleStudio } from './fixtures/exampleStudio'
import { withPackBuckets } from './fixtures/hrDooCategories'
import { civil, euros, ledger } from './fixtures/ledger'
import type { RowSpec } from './fixtures/ledger'
import { withSplit } from './fixtures/splits'

function category(slug: string, bucket: DefinedBucket, roles: readonly string[]): Category {
  return { slug, family: bucket, bucket, colour: BUCKET_COLOUR, roles, vat: 'none' }
}

const CATEGORIES: readonly Category[] = [
  category('salary-net', 'owner-pay', ['arrears']),
  category('rent-owner', 'owner-pay', ['watched', 'arrears']),
  category('payroll-contributions', 'taxes', ['owner-pay-tax', 'watched', 'arrears']),
  category('payroll-tax', 'taxes', ['owner-pay-tax', 'arrears']),
  category('dividend-tax', 'taxes', ['owner-pay-tax', 'profit-distribution']),
  category('reimbursement-to-owner', 'financing', ['reimbursement']),
]

/** March 2026, paid on 10 April with a meal allowance, and the office rent listed beside it. */
const MARCH: SalarySpec = {
  worked: '2026-03',
  paid: '2026-04-10',
  agreed: 1500,
  nontaxable: [{ label: 'Prehrana', amount: 100, payment: 'meal-allowance-flat' }],
  outside: [{ label: 'Zakup poslovnog prostora', amount: 300 }],
}

function salaryOf(spec: SalarySpec): SalaryWorkbook {
  const reading = readSalaryWorkbook(month(spec.worked), salaryTabs(spec))
  if ('refusal' in reading) throw new Error(`refused: ${reading.refusal.reason}`)
  return reading.document
}

const SALARY = salaryOf(MARCH)
const CONTRIBUTIONS = amountOf(sumMoney([SALARY.pensionPillarOne, SALARY.pensionPillarTwo, SALARY.health]))
const NET_PAYOUT = amountOf(SALARY.paidToEmployee) - 300

/** The payout week as the bank shows it: contributions, tax, net pay and rent, and a dividend tax three days later. */
const PAYOUT_WEEK: readonly RowSpec[] = [
  { date: '2026-04-10', amount: -CONTRIBUTIONS, category: 'payroll-contributions' },
  { date: '2026-04-10', amount: -amountOf(SALARY.incomeTax), category: 'payroll-tax' },
  { date: '2026-04-10', amount: -NET_PAYOUT, category: 'salary-net' },
  { date: '2026-04-10', amount: -300, category: 'rent-owner' },
  { date: '2026-04-13', amount: -45, category: 'dividend-tax' },
  { date: '2026-04-20', amount: -12, category: 'payroll-contributions' },
]

function checksOf(transactions: readonly Transaction[], categories: readonly Category[] = CATEGORIES, salary: SalaryWorkbook = SALARY, daysWorked = new Map()) {
  const [check] = salaryMonthChecks(exampleStudio({ categories, transactions }), [salary], daysWorked)
  if (check === undefined) throw new Error('no check')
  return check
}

const ROWS = withPackBuckets(ledger(PAYOUT_WEEK), CATEGORIES)

describe('salaryMonthChecks', () => {
  it('closes the state share and the payout on the payout week, and every line on the ruleset', () => {
    const check = checksOf(ROWS)
    expect(check.stateTake).toMatchObject({ theirs: SALARY.stateTake, holds: true })
    expect(check.stateTake.ours.amount).toBe(SALARY.stateTake)
    expect(check.payout).toMatchObject({ theirs: euros(NET_PAYOUT), holds: true })
    expect(check.rules.kind === 'checked' && check.rules.lines.filter((line) => line.verdict !== 'pass')).toEqual([])
  })

  it('leaves the dividend tax of the payout week out of the state share', () => {
    const withoutRole = CATEGORIES.map((candidate) => (candidate.slug === 'dividend-tax' ? { ...candidate, roles: ['owner-pay-tax'] } : candidate))
    const check = checksOf(withPackBuckets(ledger(PAYOUT_WEEK), withoutRole), withoutRole)
    expect(check.stateTake.ours.amount).toBe(addMoney(SALARY.stateTake, euros(45)))
    expect(check.stateTake.holds).toBe(false)
  })

  it('finds a payout split after booking by the row as booked', () => {
    const net = euros(NET_PAYOUT)
    const split = withSplit(ROWS, { date: '2026-04-10', amount: -NET_PAYOUT }, [
      [-amountOf(subtractMoney(net, euros(20))), 'salary-net'],
      [-20, 'reimbursement-to-owner', 'Parking paid by the owner'],
    ], CATEGORIES)
    const check = checksOf(split)
    const whole = split.find((row) => row.split !== undefined)!.split!.whole
    expect(check.payout.holds).toBe(true)
    expect(check.payout.ours.drill).toEqual(rowDrill(whole))
  })

  it('fails both bank checks for a salary whose payout week has no bank rows yet', () => {
    const check = checksOf(withPackBuckets(ledger([{ date: '2026-03-02', amount: -50, category: 'payroll-tax' }]), CATEGORIES))
    expect([check.stateTake.holds, check.payout.holds]).toEqual([false, false])
    expect(check.payout.ours.drill?.filters.period).toEqual({ preset: 'custom', range: { from: civil('2026-04-05'), to: civil('2026-04-15') } })
  })

  it('runs a part month at the director floor through the engine only with its days worked', () => {
    const partMonth = salaryOf({ ...MARCH, agreed: 'director-minimum', daysWorked: 12 })
    expect(checksOf(ROWS, CATEGORIES, partMonth).rules).toEqual({ kind: 'part-month' })
    const checked = checksOf(ROWS, CATEGORIES, partMonth, new Map([[month('2026-03'), 12]])).rules
    expect(checked.kind === 'checked' && checked.lines.every((line) => line.verdict === 'pass')).toBe(true)
  })

  it('leaves a part month above the floor unchecked even with its days, since its full-month gross is not in the workbook', () => {
    const partMonth = salaryOf({ ...MARCH, daysWorked: 12 })
    expect(checksOf(ROWS, CATEGORIES, partMonth, new Map([[month('2026-03'), 12]])).rules).toEqual({ kind: 'part-month' })
  })
})

describe('salaryRules', () => {
  it('fails the line the engine computes otherwise', () => {
    const rules = salaryRules({ ...SALARY, net: addMoney(SALARY.net, moneyFromCents(1)) }, 0, null)
    expect(rules.kind === 'checked' && rules.lines.filter((line) => line.verdict !== 'pass')).toEqual([{ line: 'net', verdict: 'fail' }])
  })

  it('states the correction of a total that adds gross I instead of gross II', () => {
    const totalWithoutHealth = sumMoney([SALARY.gross, euros(100), euros(300)])
    const rules = salaryRules({ ...SALARY, totalCompanyCost: totalWithoutHealth }, 0, null)
    expect(rules.kind === 'checked' && rules.lines.find((line) => line.line === 'totalCompanyCost')).toEqual({ line: 'totalCompanyCost', verdict: 'total-adds-gross-one' })
  })

  it('fails a payment beside the salary it does not know', () => {
    const rules = salaryRules({ ...SALARY, besideSalary: [...SALARY.besideSalary, { kind: 'unknown', label: 'Dar za dijete', amount: euros(50) }] }, 0, null)
    expect(rules.kind === 'checked' && rules.lines.find((line) => line.line === 'besideSalary')?.verdict).toBe('fail')
  })

  it('names a city the ruleset has no rates for instead of running the engine', () => {
    expect(salaryRules({ ...SALARY, residenceCity: 'Atlantida' }, 0, null).kind).toBe('unknown-city')
  })
})
