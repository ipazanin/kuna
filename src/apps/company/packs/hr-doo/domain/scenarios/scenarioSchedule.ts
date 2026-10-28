import type { DirectorBasis, OwnerPayScenario, ScenarioComponent } from './ownerPayScenarios'
import { addDays, civilDate, daysBetween, weekdaysBetween } from '../../../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../../../shared/calendar/civilDate'
import { firstDayOf, lastDayOf, monthKey, monthOf } from '../../../../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../../../../shared/calendar/monthKey'

export type ComponentOf<Kind extends ScenarioComponent['component']> = Extract<ScenarioComponent, { readonly component: Kind }>

export interface DaySpan {
  readonly from: CivilDate
  readonly to: CivilDate
}

/** A month the scenario pays a salary in, with the working days its salary row covers. */
export interface SalaryMonth {
  readonly month: MonthKey
  readonly salary: ComponentOf<'salary_gross'>
  readonly daysWorked: number
  /** Monday to Friday, as the monthly fund of hours counts them. */
  readonly workingDays: number
}

/** How the owner is insured on each day of a month, in calendar days. */
export interface InsuranceMonth {
  readonly month: MonthKey
  readonly days: number
  /** Days a salary row covers, insured as an employee of the company. */
  readonly employee: number
  /** Days with no salary and no other insurance, insured as a board member on own contributions. */
  readonly boardOnly: number
  /** Days with no salary, insured through an employer elsewhere. */
  readonly elsewhere: number
}

/** The part of a month a rent row covers. */
export interface RentMonth {
  readonly month: MonthKey
  readonly rent: ComponentOf<'rent_monthly'>
  readonly days: number
  readonly daysInMonth: number
}

/** A tax-free item, paid once with the salary of the month its row starts in. */
export interface NontaxablePaymentPlan {
  readonly item: ComponentOf<'nontaxable'>
  readonly month: MonthKey
  readonly paidOn: CivilDate
}

/** A scenario's components laid out over the days and months of its year. */
export interface ScenarioSchedule {
  readonly year: number
  readonly salaryMonths: readonly SalaryMonth[]
  readonly insurance: readonly InsuranceMonth[]
  readonly rentMonths: readonly RentMonth[]
  readonly nontaxable: readonly NontaxablePaymentPlan[]
  readonly dividend: ComponentOf<'dividend'> | null
  /** The salary row that covers a day, or null when no salary is paid that day. */
  salaryOn(day: CivilDate): ComponentOf<'salary_gross'> | null
}

/** A component's days, its blank ends read as the first and last day of the scenario's year. */
export function spanOf(component: ScenarioComponent, year: number): DaySpan {
  return { from: component.from ?? civilDate(year, 1, 1), to: component.to ?? civilDate(year, 12, 31) }
}

export function componentsOf<Kind extends ScenarioComponent['component']>(scenario: OwnerPayScenario, kind: Kind): ComponentOf<Kind>[] {
  return scenario.components.filter((component): component is ComponentOf<Kind> => component.component === kind)
}

function covers(span: DaySpan, day: CivilDate): boolean {
  return span.from <= day && day <= span.to
}

/** The days two spans share, or null when they share none. */
export function overlapOf(first: DaySpan, second: DaySpan): DaySpan | null {
  const from = first.from > second.from ? first.from : second.from
  const to = first.to < second.to ? first.to : second.to
  return from <= to ? { from, to } : null
}

/**
 * Lays the scenario out over its year. A day a salary row covers is a day as an employee. A day
 * without one is a day insured elsewhere when a director_basis row says insured-elsewhere, and
 * otherwise a day as a board member on own contributions, which the law makes the director when
 * nothing else insures him. A tax-free item is paid with the salary of the month its row starts in.
 */
export function scenarioSchedule(scenario: OwnerPayScenario): ScenarioSchedule {
  const { year } = scenario
  const salaries = componentsOf(scenario, 'salary_gross')
  const bases = componentsOf(scenario, 'director_basis')
  const salaryOn = (day: CivilDate) => salaries.find((salary) => covers(spanOf(salary, year), day)) ?? null
  const basisOn = (day: CivilDate): DirectorBasis => {
    if (salaryOn(day) !== null) {
      return 'employee'
    }
    const named = bases.find((basis) => covers(spanOf(basis, year), day))
    return named?.basis === 'insured-elsewhere' ? 'insured-elsewhere' : 'board-only'
  }
  const months = Array.from({ length: 12 }, (_, index) => monthKey(year, index + 1))

  const salaryMonths = months.flatMap((month): SalaryMonth[] => {
    const monthSpan = { from: firstDayOf(month), to: lastDayOf(month) }
    const workingDays = weekdaysBetween(monthSpan.from, monthSpan.to)
    return salaries.flatMap((salary) => {
      const shared = overlapOf(spanOf(salary, year), monthSpan)
      const daysWorked = shared === null ? 0 : weekdaysBetween(shared.from, shared.to)
      return daysWorked === 0 ? [] : [{ month, salary, daysWorked, workingDays }]
    })
  })

  const insurance = months.map((month): InsuranceMonth => {
    const counts = { employee: 0, boardOnly: 0, elsewhere: 0 }
    const first = firstDayOf(month)
    const days = daysBetween(first, lastDayOf(month)) + 1
    for (let offset = 0; offset < days; offset += 1) {
      const basis = basisOn(addDays(first, offset))
      if (basis === 'employee') counts.employee += 1
      else if (basis === 'insured-elsewhere') counts.elsewhere += 1
      else counts.boardOnly += 1
    }
    return { month, days, ...counts }
  })

  const rentMonths = months.flatMap((month): RentMonth[] => {
    const monthSpan = { from: firstDayOf(month), to: lastDayOf(month) }
    const daysInMonth = daysBetween(monthSpan.from, monthSpan.to) + 1
    return componentsOf(scenario, 'rent_monthly').flatMap((rent) => {
      const shared = overlapOf(spanOf(rent, year), monthSpan)
      return shared === null ? [] : [{ month, rent, days: daysBetween(shared.from, shared.to) + 1, daysInMonth }]
    })
  })

  const nontaxable = componentsOf(scenario, 'nontaxable').map((item): NontaxablePaymentPlan => {
    const month = monthOf(spanOf(item, year).from)
    return { item, month, paidOn: lastDayOf(month) }
  })

  return {
    year,
    salaryMonths,
    insurance,
    rentMonths,
    nontaxable,
    dividend: componentsOf(scenario, 'dividend')[0] ?? null,
    salaryOn,
  }
}
