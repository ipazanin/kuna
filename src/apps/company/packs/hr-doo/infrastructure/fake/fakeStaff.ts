import { amountText } from '../../../../../../shared/storage/domain/recordFields'
import { FAKE_OWNER } from '../../../../workbook/infrastructure/fake/fakeWorkbook'
import type { FakePayment, FakeStaff } from '../../../../workbook/infrastructure/fake/fakeWorkbook'
import { civilDate, weekdaysBetween } from '../../../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../../../shared/calendar/civilDate'
import { addMonths, firstDayOf, lastDayOf, monthNumber, parseMonthKey, yearOfMonth } from '../../../../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../../../../shared/calendar/monthKey'
import { amountOf, moneyFromAmount, sumMoney } from '../../../../../../shared/money/money'
import { payrollMonth } from '../../domain/payroll/payrollMonth'
import type { PayrollMonth } from '../../domain/payroll/payrollMonth'
import { CONTRIBUTION_ACCOUNTS } from '../../domain/salaries/contributionAccounts'
import { ruleValue } from '../../ruleset/ruleset'

/** A made-up person a fake variant pays, every one of them on full months. */
interface FakeEmployee {
  readonly slug: string
  readonly name: string
  readonly iban: string
  readonly city: string
  readonly pillarTwo: boolean
  readonly dependants: number
  readonly birthYear: number
  /** The first day of a month. */
  readonly from: string
  /** The agreed monthly gross in euros, or the director floor. */
  readonly agreed: number | 'floor'
}

/** What a variant pays, and where the bank pays otherwise than the engine, so the Salaries page has a problem to show. */
interface FakeStaffing {
  readonly employees: readonly FakeEmployee[]
  /** Paydays whose health insurance row is this many euros short. */
  readonly healthShort: Readonly<Record<string, number>>
}

const MEAL = 100
const FIRST_WORKED = '2025-06'
const LAST_WORKED = '2026-08'
const CITY_TAX = { name: 'City income tax account', iban: 'XX00FAKE0000000000000034' } as const

const ALEX: FakeEmployee = { slug: 'alex', name: FAKE_OWNER.name, iban: FAKE_OWNER.iban, city: 'Zagreb', pillarTwo: true, dependants: 0, birthYear: 1990, from: '2025-06-01', agreed: 'floor' }

/**
 * The made-up staffs by variant. `one-employee` is the owner alone at the director floor, as one
 * person's company runs. `five-employees` adds four ordinary employees on agreed salaries in three
 * cities, one outside pillar II, one with two children and one who joins in February 2026.
 */
const STAFFINGS: Readonly<Record<string, FakeStaffing>> = {
  'one-employee': {
    employees: [ALEX],
    healthShort: {},
  },
  'five-employees': {
    employees: [
      ALEX,
      { slug: 'mia', name: 'Mia Primjer', iban: 'XX00FAKE0000000000000201', city: 'Zagreb', pillarTwo: true, dependants: 0, birthYear: 1994, from: '2025-06-01', agreed: 2400 },
      { slug: 'tomo', name: 'Tomo Uzorak', iban: 'XX00FAKE0000000000000202', city: 'Split', pillarTwo: false, dependants: 0, birthYear: 1968, from: '2025-06-01', agreed: 1800 },
      { slug: 'lea', name: 'Lea Proba', iban: 'XX00FAKE0000000000000203', city: 'Zagreb', pillarTwo: true, dependants: 2, birthYear: 1988, from: '2025-09-01', agreed: 3100 },
      { slug: 'niko', name: 'Niko Test', iban: 'XX00FAKE0000000000000204', city: 'Rijeka', pillarTwo: true, dependants: 0, birthYear: 2000, from: '2026-02-01', agreed: 1600 },
    ],
    healthShort: { '2026-09': 10 },
  },
}

/** The made-up staff of a fake variant, or null for a variant that pays the owner's flat salary. */
export function fakeStaffOf(variant: string | null): FakeStaff | null {
  const staffing = variant === null ? undefined : STAFFINGS[variant]
  if (staffing === undefined) return null
  return {
    employees: staffing.employees.map((person) => ({
      employee: person.slug,
      name: person.name,
      iban: person.iban,
      residence_city: person.city,
      pension_pillar_2: person.pillarTwo,
      dependants: person.dependants,
      birth_year: person.birthYear,
      agreed_gross: person.agreed === 'floor' ? null : amountText(moneyFromAmount(person.agreed)),
      from: person.from,
      director: person.agreed === 'floor',
    })),
    payday: (paidIn, worked) => paydayRows(staffing, paidIn, worked),
  }
}

function month(text: string): MonthKey {
  const parsed = parseMonthKey(text)
  if (parsed === null) throw new RangeError(`${text} is not a month.`)
  return parsed
}

/** The 12th of the month after the worked one, the fake's payday. */
function paidOnFor(worked: MonthKey): CivilDate {
  const paid = addMonths(worked, 1)
  return civilDate(yearOfMonth(paid), monthNumber(paid), 12)
}

/** Each employee's month as the engine works it out, with a meal allowance beside the salary. */
function payrollOf(staffing: FakeStaffing, worked: MonthKey): { readonly person: FakeEmployee; readonly payroll: PayrollMonth }[] {
  if (worked < month(FIRST_WORKED) || worked > month(LAST_WORKED)) return []
  const workingDays = weekdaysBetween(firstDayOf(worked), lastDayOf(worked))
  return staffing.employees
    .filter((person) => person.from <= firstDayOf(worked))
    .map((person) => ({
      person,
      payroll: payrollMonth(
        {
          workedMonth: worked,
          paidOn: paidOnFor(worked),
          agreedMonthlyGross: moneyFromAmount(person.agreed === 'floor' ? 0 : person.agreed),
          daysWorked: workingDays,
          workingDaysInMonth: workingDays,
          nontaxablePayments: [{ payment: 'meal-allowance-flat', amount: moneyFromAmount(MEAL) }],
          basis: 'plan',
        },
        { residenceCity: person.city, pensionPillarTwo: person.pillarTwo, director: person.agreed === 'floor', dependants: person.dependants, birthYear: person.birthYear },
        ruleValue,
      ),
    }))
}

/** Each net salary with its meal allowance to its employee, and each contribution in one sum for everyone to its payee. */
function paydayRows(staffing: FakeStaffing, paidIn: string, workedText: string): FakePayment[] {
  const worked = month(workedText)
  const paid = payrollOf(staffing, worked)
  if (paid.length === 0) return []
  const description = `Salary for ${workedText}`
  const total = (line: 'pensionPillarOne' | 'pensionPillarTwo' | 'health' | 'incomeTax') => amountOf(sumMoney(paid.map(({ payroll }) => payroll[line].amount)))
  const contribution = (counterparty: string, iban: string, amount: number, category: string): FakePayment[] => (amount === 0 ? [] : [{ counterparty, iban, description, amount: -amount, category }])
  return [
    ...paid.map(({ person, payroll }) => ({
      counterparty: person.name,
      iban: person.iban,
      description,
      amount: -amountOf(payroll.paidToEmployee.amount),
      category: 'salary-net',
    })),
    ...contribution('State budget, pension insurance', CONTRIBUTION_ACCOUNTS.pensionPillarOne, total('pensionPillarOne'), 'payroll-contributions'),
    ...contribution('Pension pillar II', CONTRIBUTION_ACCOUNTS.pensionPillarTwo, total('pensionPillarTwo'), 'payroll-contributions'),
    ...contribution('Health insurance fund', CONTRIBUTION_ACCOUNTS.health, total('health') - (staffing.healthShort[paidIn] ?? 0), 'payroll-contributions'),
    ...contribution(CITY_TAX.name, CITY_TAX.iban, total('incomeTax'), 'payroll-tax'),
  ]
}
