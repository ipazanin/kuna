import { describe, expect, it } from 'vitest'

import type { RecordFields } from '../src/shared/storage/domain/recordFields'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import type { RecordsRead } from '../src/shared/storage/domain/recordsRead'
import { refusalOr, storedFieldsOfValues } from '../src/shared/storage/domain/storedFields'
import type { Employee } from '../src/apps/company/packs/hr-doo/domain/employees/employees'
import { payrollDirector, weekdaysEmployed } from '../src/apps/company/packs/hr-doo/domain/employees/employees'
import { EMPLOYEE_CODEC, employeeOf, readEmployees } from '../src/apps/company/packs/hr-doo/domain/employees/employeesReading'
import { EMPLOYEE_RECORDS } from '../src/apps/company/packs/hr-doo/domain/hrDooKinds'
import { EMPLOYEE_WRITES } from '../src/apps/company/packs/hr-doo/domain/hrDooWrites'
import { payrollMonth } from '../src/apps/company/packs/hr-doo/domain/payroll/payrollMonth'
import { payScenarios } from '../src/apps/company/packs/hr-doo/domain/scenarios/payScenarios'
import { payState } from '../src/apps/company/packs/hr-doo/presentation/payScenarios/payScenariosView'
import { director } from './fixtures/employees'
import { exampleStudio } from './fixtures/exampleStudio'
import { civil, euros, month } from './fixtures/ledger'

/** The employees tab as a storage holds it, each record made by the codec from its fields. */
function tab(...rows: RecordFields[]): RecordsRead<Employee> {
  const records: RecordsRead<Employee>['records'][number][] = []
  const refused: RecordsRead<Employee>['refused'][number][] = []
  rows.forEach((row, index) => {
    const fields = storedFieldsOfValues(row)
    const id = recordIdOf(EMPLOYEE_RECORDS, `${String(row.employee ?? '')}-${index}`)
    const made = refusalOr(() => employeeOf(fields, id))
    if ('made' in made) {
      records.push({ record: made.made, id, label: EMPLOYEE_CODEC.label(fields), fields })
    } else {
      refused.push({ id, label: EMPLOYEE_CODEC.label(fields), fields, reason: made.refused })
    }
  })
  return { records, refused }
}

const DORA: RecordFields = { employee: 'dora', residence_city: 'Zagreb', from: '2025-01-01', director: true }

describe('the days an employee worked in a month', () => {
  it('counts Monday to Friday from the start day, so a start on Thursday 5 June 2025 works 18 of 21 weekdays', () => {
    expect(weekdaysEmployed({ from: civil('2025-06-05'), to: null }, month('2025-06'))).toBe(18)
    expect(weekdaysEmployed({ from: civil('2025-05-12'), to: null }, month('2025-06'))).toBe(21)
  })

  it('stops on the last day of the employment, and is null for a month it does not reach', () => {
    expect(weekdaysEmployed({ from: civil('2025-01-01'), to: civil('2025-06-13') }, month('2025-06'))).toBe(10)
    expect(weekdaysEmployed({ from: civil('2025-07-01'), to: null }, month('2025-06'))).toBeNull()
    expect(weekdaysEmployed({ from: civil('2025-01-01'), to: civil('2025-05-31') }, month('2025-06'))).toBeNull()
  })
})

describe('the employees tab', () => {
  it('reads a row with its flags, numbers and dates, blank flags reading FALSE', () => {
    const [read] = tab({ ...DORA, name: 'Dora Example', pension_pillar_2: true, dependants: '2', birth_year: '1990', to: '2026-12-31' }).records
    expect(read?.record).toMatchObject({ slug: 'dora', name: 'Dora Example', residenceCity: 'Zagreb', pensionPillarTwo: true, dependants: 2, birthYear: 1990, from: '2025-01-01', to: '2026-12-31', director: true })
    expect(tab({ employee: 'ivo', residence_city: 'Split', from: '2026-01-12' }).records[0]?.record).toMatchObject({ pensionPillarTwo: false, dependants: 0, birthYear: null, agreedGross: null, to: null, director: false })
    expect(tab({ employee: 'ivo', residence_city: 'Split', from: '2026-01-12', agreed_gross: '1200' }).records[0]?.record.agreedGross).toBe(euros(1200))
  })

  it('refuses a row without a name or a start, a city the ruleset does not know, an end before the start and a flag or number that does not hold', () => {
    const reasons = tab(
      { residence_city: 'Zagreb', from: '2025-01-01' },
      { employee: 'ana', residence_city: 'Zagreb' },
      { employee: 'mia', residence_city: 'Atlantida', from: '2025-01-01' },
      { employee: 'ivo', residence_city: 'Split', from: '2025-03-01', to: '2025-02-28' },
      { employee: 'eva', residence_city: 'Split', from: '2025-03-01', director: 'perhaps' },
      { employee: 'leo', residence_city: 'Split', from: '2025-03-01', dependants: '21' },
      { employee: 'uma', residence_city: 'Split', from: '2025-03-01', agreed_gross: '0' },
    ).refused.map((refused) => refused.reason)
    expect(reasons).toEqual([
      'no employee name',
      'no from date',
      'residence_city "Atlantida" is not a Croatian city or municipality',
      'to 2025-02-28 is before from 2025-03-01',
      'director "perhaps" is neither TRUE nor FALSE',
      'dependants "21" is not a whole number from 0 to 20',
      'agreed_gross must be more than zero',
    ])
  })

  it('reports a row with no city and keeps it, since the payroll leaves it out', () => {
    const reading = readEmployees(tab({ employee: 'dora', from: '2025-01-01', director: true }))
    expect(reading.facts.map((employee) => employee.slug)).toEqual(['dora'])
    expect(reading.problems.map((problem) => problem.reason)).toEqual(['no residence_city, which sets the income tax rates, so the payroll leaves this employee out'])
    expect(reading.director?.slug).toBe('dora')
    expect(payrollDirector(reading)).toBeNull()
  })

  it('leaves out every row of a name listed twice, and every director when more than one row is marked so', () => {
    const twice = readEmployees(tab(DORA, { ...DORA, residence_city: 'Split' }, { employee: 'ivo', residence_city: 'Split', from: '2026-01-12' }))
    expect(twice.facts.map((employee) => employee.slug)).toEqual(['ivo'])
    expect(twice.director).toBeNull()

    const directors = readEmployees(tab(DORA, { employee: 'ivo', residence_city: 'Split', from: '2026-01-12', director: true }))
    expect(directors.facts).toEqual([])
    expect(directors.problems.map((problem) => problem.reason)).toEqual([
      'more than one row is marked director, so none of them counts. Mark one',
      'more than one row is marked director, so none of them counts. Mark one',
    ])
    expect(readEmployees(tab(DORA, { employee: 'ivo', residence_city: 'Split', from: '2026-01-12' })).director?.slug).toBe('dora')
  })

  it('reads the accounts a salary is paid into, and counts an account two employees name for neither', () => {
    const reading = readEmployees(
      tab(
        { ...DORA, iban: 'xx00 fake 0000 0000 0000 0105, XX00FAKE0000000000000107' },
        { employee: 'ivo', residence_city: 'Split', from: '2026-01-12', iban: 'XX00FAKE0000000000000107' },
      ),
    )
    expect(reading.facts.map((employee) => [employee.slug, employee.ibans])).toEqual([
      ['dora', ['XX00FAKE0000000000000105']],
      ['ivo', []],
    ])
    expect(reading.problems.map((problem) => problem.reason)).toEqual([
      'XX00FAKE0000000000000107 is on another employee too, so a payment to it counts for neither',
      'XX00FAKE0000000000000107 is on another employee too, so a payment to it counts for neither',
    ])
  })

  it('writes a row back as the fields it was read from', () => {
    const fields = { employee: 'dora', name: 'Dora Example', iban: 'XX00FAKE0000000000000105, XX00FAKE0000000000000106', residence_city: 'Zagreb', pension_pillar_2: true, dependants: '2', birth_year: '1990', agreed_gross: '1600.00', from: '2025-01-01', director: true }
    expect(EMPLOYEE_CODEC.fieldsOf(employeeOf(storedFieldsOfValues(fields), recordIdOf(EMPLOYEE_RECORDS, 'dora')))).toEqual(fields)
  })

  it('refuses a name the app cannot use as a key', () => {
    const added = tab({ ...DORA, employee: 'Dora E' }).records[0]!
    const change = { edits: [{ before: null, after: added }], untouched: [], before: { records: [], refused: [] }, after: { records: [added], refused: [] }, undoing: false }
    expect(EMPLOYEE_WRITES.refusals(change, { of: () => ({ records: [], refused: [] }) })).toEqual([
      '"dora e" is not an employee name the app can use: write it in lower-case letters and digits with single hyphens, such as ai-services.',
    ])
  })
})

describe('the payroll of a director row', () => {
  it('works out 2026 at the floor, the no-decision local rates of 20% and 30% and 135.00 tax free', () => {
    // A unit with no decision of its own pays 20% and 30% (ZPDoh Art. 19.a(5)). Bakar is one.
    const row = director({ residence_city: 'Bakar' })
    const payroll = payrollMonth(
      {
        workedMonth: month('2026-03'),
        paidOn: civil('2026-04-10'),
        agreedMonthlyGross: euros(0),
        daysWorked: 22,
        workingDaysInMonth: 22,
        nontaxablePayments: [
          { payment: 'meal-allowance-flat', amount: euros(100) },
          { payment: 'commuting-ticket', amount: euros(35) },
        ],
        basis: 'plan',
      },
      row,
    )
    // Pillar I 15% of 1,295.45 less the 2.28 relief, 193.98. Pillar II 5%, 64.77. Income 1,036.70, less 600.00 allowance.
    // Tax 20% of 436.70, 87.34. Health 16.5%, 213.75. Total cost 1,509.20 + 135.00, paid out 949.36 + 135.00.
    expect(
      [payroll.gross, payroll.pensionPillarOne, payroll.pensionPillarTwo, payroll.income, payroll.taxableIncome, payroll.incomeTax, payroll.net, payroll.health, payroll.employerCost, payroll.totalCompanyCost, payroll.paidToEmployee].map(
        (figure) => figure.amount,
      ),
    ).toEqual([1295.45, 193.98, 64.77, 1036.7, 436.7, 87.34, 949.36, 213.75, 1509.2, 1644.2, 1084.36].map(euros))
  })

  it('needs a director with a city for the pay scenarios, and links to the employees on Salaries', () => {
    const registered = exampleStudio()
    const needs = (workbook: typeof registered) => {
      const state = payState(workbook, 2027, civil('2026-10-01'))
      return state.state === 'needs' ? [state.need, state.action.to] : state.state
    }
    const toEmployees = { path: '/company/salaries', hash: '#employee-rows' }

    expect(needs(registered)).toEqual(['a director on the employees tab', toEmployees])
    const cityless = director({ residence_city: '' })
    expect(needs(exampleStudio({ employees: [cityless], director: cityless }))).toEqual(["the director's city", toEmployees])
    expect(() => payScenarios(registered, 2027, civil('2026-10-01'))).toThrow(RangeError)
    const owner = director()
    expect(needs(exampleStudio({ employees: [owner], director: owner }))).toBe('ready')
  })
})
