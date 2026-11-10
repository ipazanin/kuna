import { amountText } from '../../../../../../shared/storage/domain/recordFields'
import { FAKE_OWNER } from '../../../../workbook/infrastructure/fake/fakeWorkbook'
import type { FakeFields, FakePayment, FakeStaff } from '../../../../workbook/infrastructure/fake/fakeWorkbook'
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
  /** The travel orders with their legs and costs, by kind. */
  readonly trips: Readonly<Record<string, readonly FakeFields[]>>
}

const MEAL = 100
const FIRST_WORKED = '2025-06'
const LAST_WORKED = '2026-08'
const CITY_TAX = { name: 'City income tax account', iban: 'XX00FAKE0000000000000034' } as const

const ALEX: FakeEmployee = { slug: 'alex', name: FAKE_OWNER.name, iban: FAKE_OWNER.iban, city: 'Zagreb', pillarTwo: true, dependants: 0, birthYear: 1990, from: '2025-06-01', agreed: 'floor' }

/** A fixed id for a made-up trip record, so every run gives the same ids. */
function tripId(kind: number, place: number): string {
  return `00000000-0000-4000-8000-${String(kind).padStart(4, '0')}${String(place).padStart(8, '0')}`
}

const ZADAR = tripId(20, 1)
const OSIJEK = tripId(20, 2)
const LONDON = tripId(20, 3)
const RIJEKA = tripId(20, 4)
const NEW_YORK = tripId(20, 5)
const CAR = { car: 'Made-up Estate', plate: 'ZG-000-XX', km_rate: '0.50' } as const

/**
 * The owner's trips: Zadar by private car over two days with one lunch paid, a ten-hour day in Osijek by
 * train, London by plane with the ticket paid privately and the hotel on the company card, an order to Rijeka
 * at a km rate over the tax-free cap with an advance whose days are over, which waits for its settlement, and
 * New York by plane, whose per diem the table states in dollars.
 */
const ALEX_TRIPS: Readonly<Record<string, readonly FakeFields[]>> = {
  'hr-doo.trip': [
    {
      id: OSIJEK,
      number: '1/2025',
      issued: '2025-11-17',
      traveller: 'alex',
      role: 'Managing director',
      destination: 'Osijek',
      country: 'HR',
      task: 'Workshop with a client team',
      departs: '2025-11-19',
      days: 1,
      transport: 'train',
      left: '2025-11-19 06:30',
      returned: '2025-11-19 16:30',
      report: 'Ran the workshop and agreed the next steps.',
      settled_on: '2025-11-21',
    },
    {
      id: ZADAR,
      number: '1/2026',
      issued: '2026-03-10',
      traveller: 'alex',
      role: 'Managing director',
      destination: 'Zadar',
      country: 'HR',
      task: 'Client meeting and site visit',
      departs: '2026-03-12',
      days: 2,
      transport: 'private-car',
      ...CAR,
      left: '2026-03-12 07:00',
      returned: '2026-03-13 20:00',
      odometer_start: 41200,
      odometer_end: 41790,
      meals: '1, 0',
      report: 'Met the client, saw the site and signed the order.',
      settled_on: '2026-03-16',
    },
    {
      id: LONDON,
      number: '2/2026',
      issued: '2026-06-01',
      traveller: 'alex',
      role: 'Managing director',
      destination: 'London',
      country: 'GB',
      task: 'Quarterly review with Northwind Analytics',
      departs: '2026-06-15',
      days: 3,
      transport: 'plane',
      left: '2026-06-15 05:00',
      border_out: '2026-06-15 07:10',
      border_in: '2026-06-17 21:40',
      returned: '2026-06-17 22:30',
      report: 'Held the quarterly review and planned the next quarter.',
      settled_on: '2026-06-22',
    },
    {
      id: RIJEKA,
      number: '3/2026',
      issued: '2026-09-28',
      traveller: 'alex',
      role: 'Managing director',
      destination: 'Rijeka',
      country: 'HR',
      task: 'Conference talk',
      departs: '2026-10-01',
      days: 2,
      transport: 'private-car',
      ...CAR,
      km_rate: '0.60',
      advance: amountText(moneyFromAmount(150)),
      settle_by: '2026-10-31',
    },
    {
      id: NEW_YORK,
      number: '4/2026',
      issued: '2026-09-30',
      traveller: 'alex',
      role: 'Managing director',
      destination: 'New York',
      country: 'US',
      task: 'Contract talks with a client',
      departs: '2026-10-05',
      days: 4,
      transport: 'plane',
      advance: amountText(moneyFromAmount(300)),
      left: '2026-10-05 04:30',
      border_out: '2026-10-05 06:40',
      border_in: '2026-10-08 18:20',
      returned: '2026-10-08 19:30',
      report: 'Agreed the contract terms with the client.',
      settled_on: '2026-10-13',
    },
  ],
  'hr-doo.trip-leg': [
    { id: tripId(21, 1), trip: ZADAR, date: '2026-03-12', from: 'Zagreb', to: 'Zadar', km: 285 },
    { id: tripId(21, 2), trip: ZADAR, date: '2026-03-13', from: 'Zadar', to: 'Zagreb', km: 285 },
  ],
  'hr-doo.trip-cost': [
    { id: tripId(22, 1), trip: ZADAR, date: '2026-03-12', kind: 'toll', description: 'Motorway toll Zagreb to Zadar and back', amount: amountText(moneyFromAmount(47.4)), paid_by: 'traveller' },
    { id: tripId(22, 2), trip: OSIJEK, date: '2025-11-19', kind: 'ticket', description: 'Train tickets Zagreb to Osijek and back', amount: amountText(moneyFromAmount(36.8)), paid_by: 'traveller' },
    { id: tripId(22, 3), trip: LONDON, date: '2026-06-02', kind: 'ticket', description: 'Return flight Zagreb to London', amount: amountText(moneyFromAmount(286.4)), paid_by: 'traveller' },
    {
      id: tripId(22, 4),
      trip: LONDON,
      date: '2026-06-17',
      kind: 'lodging',
      description: 'Hotel, two nights',
      amount: amountText(moneyFromAmount(412.3)),
      foreign_amount: '356.00',
      currency: 'GBP',
      paid_by: 'company',
    },
    { id: tripId(22, 5), trip: NEW_YORK, date: '2026-09-30', kind: 'ticket', description: 'Return flight Zagreb to New York', amount: amountText(moneyFromAmount(742.1)), paid_by: 'traveller' },
  ],
}

/**
 * The made-up staffs by variant. `one-employee` is the owner alone at the director floor, as one
 * person's company runs. `five-employees` adds four ordinary employees on agreed salaries in three
 * cities, one outside pillar II, one with two children and one who joins in February 2026.
 */
const STAFFINGS: Readonly<Record<string, FakeStaffing>> = {
  'one-employee': {
    employees: [ALEX],
    healthShort: {},
    trips: ALEX_TRIPS,
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
    trips: {},
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
    trips: staffing.trips,
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
