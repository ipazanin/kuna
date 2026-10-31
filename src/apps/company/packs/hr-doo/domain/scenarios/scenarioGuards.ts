import type { OwnerPayScenario, ScenarioComponent } from './ownerPayScenarios'
import type { RecordId } from '../../../../../../shared/storage/domain/recordId'
import { addDays } from '../../../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../../../shared/calendar/civilDate'
import { monthOf } from '../../../../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../../../../shared/calendar/monthKey'
import { ruleValue } from '../../ruleset/ruleset'
import type { RuleSource } from '../payroll/payrollArithmetic'
import { componentsOf, scenarioSchedule, spanOf } from './scenarioSchedule'
import type { ScenarioSchedule } from './scenarioSchedule'
import { overlapOf } from '../../../../../../shared/calendar/dateRange'
import type { DateRange } from '../../../../../../shared/calendar/dateRange'
import { words } from './words'

/** Why a scenario cannot be worked out as its rows stand, and which rows. */
export interface ScenarioGuard {
  readonly ids: readonly RecordId[]
  readonly reason: string
}

/** The components that hold one value on any day, so two rows of one of them may not share a day. */
const ONE_A_DAY = ['salary_gross', 'director_basis', 'rent_monthly'] as const

/** The cap period a scenario's yearly amount of a tax-free item can be checked against. */
const YEARLY = 'year'

/**
 * What stops a scenario from being worked out: two rows giving one component on the same day, two
 * salaries in one month, more than one dividend, an insurance basis that contradicts the salary,
 * and a tax-free item the ruleset does not cap by the year or that falls in a month with no salary.
 */
export function scenarioGuards(scenario: OwnerPayScenario, rules: RuleSource = ruleValue): readonly ScenarioGuard[] {
  const { year } = scenario
  const schedule = scenarioSchedule(scenario)
  const guards: ScenarioGuard[] = []

  for (const kind of ONE_A_DAY) {
    const rows: readonly ScenarioComponent[] = componentsOf(scenario, kind)
    rows.forEach((first, index) => {
      for (const second of rows.slice(index + 1)) {
        const shared = overlapOf(spanOf(first, year), spanOf(second, year))
        if (shared !== null) {
          guards.push({ ids: [first.id, second.id], reason: words.guards.sameDay(componentInWords(first), componentInWords(second), kind, shared.from) })
        }
      }
    })
  }

  const salaries = componentsOf(scenario, 'salary_gross')
  salaries.forEach((first, index) => {
    for (const second of salaries.slice(index + 1)) {
      const month = sharedMonth(spanOf(first, year), spanOf(second, year))
      if (month !== null && overlapOf(spanOf(first, year), spanOf(second, year)) === null) {
        guards.push({
          ids: [first.id, second.id],
          reason: words.guards.twoSalaries(componentInWords(first), componentInWords(second), month),
        })
      }
    }
  })

  const dividends = componentsOf(scenario, 'dividend')
  if (dividends.length > 1) {
    guards.push({ ids: dividends.map((dividend) => dividend.id), reason: words.guards.dividends(dividends.length) })
  }

  for (const basis of componentsOf(scenario, 'director_basis')) {
    const span = spanOf(basis, year)
    if (basis.basis === 'employee') {
      const day = firstDay(span, (candidate) => schedule.salaryOn(candidate) === null)
      if (day !== null) {
        guards.push({
          ids: [basis.id],
          reason: words.guards.employeeWithoutSalary(componentInWords(basis), day),
        })
      }
      continue
    }
    const day = firstDay(span, (candidate) => schedule.salaryOn(candidate) !== null)
    const salary = day === null ? null : schedule.salaryOn(day)
    if (day !== null && salary !== null) {
      guards.push({
        ids: [basis.id, salary.id],
        reason: words.guards.basisWithSalary(componentInWords(basis), day, componentInWords(salary)),
      })
    }
  }

  guards.push(...nontaxableGuards(schedule, rules))
  return guards
}

function nontaxableGuards(schedule: ScenarioSchedule, rules: RuleSource): ScenarioGuard[] {
  return schedule.nontaxable.flatMap(({ item, month, paidOn }): ScenarioGuard[] => {
    const caps = rules('hr.pit.nontaxable-caps', paidOn).value.caps.rows
    const yearly = [...new Set(caps.filter((row) => row.period.text === YEARLY).map((row) => row.payment.text))]
    const capRow = caps.find((row) => row.payment.text === item.item)
    if (capRow === undefined || capRow.period.text !== YEARLY) {
      const why = capRow === undefined ? words.guards.notListed(schedule.year) : words.guards.noYearlyCap
      return [{ ids: [item.id], reason: words.guards.item(item.item, why, yearly) }]
    }
    if (!schedule.salaryMonths.some((salary) => salary.month === month)) {
      return [{ ids: [item.id], reason: words.guards.noSalaryMonth(item.item, month) }]
    }
    return []
  })
}

/** A scenario row as a guard names it, such as "the salary of 3000.00 from 2027-07-01". */
export function componentInWords(component: ScenarioComponent): string {
  const days = words.component.days(component.from, component.to)
  switch (component.component) {
    case 'salary_gross':
      return component.gross === 'floor' ? words.component.floorSalary(days) : words.component.salary(component.gross, days)
    case 'director_basis':
      return words.component.basis(component.basis, days)
    case 'rent_monthly':
      return words.component.rent(component.amount, days)
    case 'dividend':
      return component.amount === 'max' ? words.component.largestDividend : words.component.dividend(component.amount)
    case 'nontaxable':
      return words.component.item(component.item, days)
  }
}

/** The first month two spans both touch, or null. */
function sharedMonth(first: DateRange, second: DateRange): MonthKey | null {
  const from = monthOf(first.from) > monthOf(second.from) ? monthOf(first.from) : monthOf(second.from)
  const to = monthOf(first.to) < monthOf(second.to) ? monthOf(first.to) : monthOf(second.to)
  return from <= to ? from : null
}

function firstDay(span: DateRange, holds: (day: CivilDate) => boolean): CivilDate | null {
  for (let day = span.from; day <= span.to; day = addDays(day, 1)) {
    if (holds(day)) {
      return day
    }
  }
  return null
}
