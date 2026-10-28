import type { OwnerPayScenario, ScenarioComponent } from './ownerPayScenarios'
import type { RecordId } from '../../../../../../shared/storage/domain/recordId'
import { addDays } from '../../../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../../../shared/calendar/civilDate'
import { monthOf } from '../../../../../../shared/calendar/monthKey'
import { plainAmount } from '../../../../../../shared/money/money'
import { ruleValue } from '../../ruleset/ruleset'
import type { RuleSource } from '../payroll/payrollArithmetic'
import { componentsOf, scenarioSchedule, spanOf } from './scenarioSchedule'
import type { ScenarioSchedule } from './scenarioSchedule'
import { overlapOf } from '../../../../../../shared/calendar/dateRange'
import type { DateRange } from '../../../../../../shared/calendar/dateRange'

/** Why a scenario cannot be worked out as its rows stand, and which rows. */
export interface ScenarioGuard {
  readonly ids: readonly RecordId[]
  readonly reason: string
}

/** The components that hold one value on any day, so two rows of one of them may not share a day. */
const ONE_A_DAY = [
  ['salary_gross', 'set the salary'],
  ['director_basis', 'set the director basis'],
  ['rent_monthly', 'set the rent'],
] as const

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

  for (const [kind, sets] of ONE_A_DAY) {
    const rows: readonly ScenarioComponent[] = componentsOf(scenario, kind)
    rows.forEach((first, index) => {
      for (const second of rows.slice(index + 1)) {
        const shared = overlapOf(spanOf(first, year), spanOf(second, year))
        if (shared !== null) {
          guards.push({ ids: [first.id, second.id], reason: `${capitalised(componentInWords(first))} and ${componentInWords(second)} both ${sets} on ${shared.from}.` })
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
          reason: `${capitalised(componentInWords(first))} and ${componentInWords(second)} both pay a salary in ${month}. A salary can change only from the first of a month.`,
        })
      }
    }
  })

  const dividends = componentsOf(scenario, 'dividend')
  if (dividends.length > 1) {
    guards.push({ ids: dividends.map((dividend) => dividend.id), reason: `The scenario sets ${dividends.length} dividends. A scenario pays one, out of the year's profit.` })
  }

  for (const basis of componentsOf(scenario, 'director_basis')) {
    const span = spanOf(basis, year)
    if (basis.basis === 'employee') {
      const day = firstDay(span, (candidate) => schedule.salaryOn(candidate) === null)
      if (day !== null) {
        guards.push({ ids: [basis.id], reason: `${capitalised(componentInWords(basis))} makes the director an employee on ${day}, a day no salary row covers. Add the salary, or end the row earlier.` })
      }
      continue
    }
    const day = firstDay(span, (candidate) => schedule.salaryOn(candidate) !== null)
    const salary = day === null ? null : schedule.salaryOn(day)
    if (day !== null && salary !== null) {
      guards.push({
        ids: [basis.id, salary.id],
        reason: `${capitalised(componentInWords(basis))} holds on ${day}, a day ${componentInWords(salary)} pays. A director paid a salary is insured as an employee.`,
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
      const why = capRow === undefined ? `is not a tax-free payment the ruleset lists for ${schedule.year}` : `has no yearly cap to check a year's amount against`
      return [{ ids: [item.id], reason: `The item ${item.item} ${why}. Use one with a yearly cap: ${yearly.join(', ')}.` }]
    }
    if (!schedule.salaryMonths.some((salary) => salary.month === month)) {
      return [{ ids: [item.id], reason: `The item ${item.item} is paid in ${month}, a month with no salary. A tax-free payment goes only to an employee.` }]
    }
    return []
  })
}

/** A scenario row as a guard names it, such as "the salary of 3000.00 from 2027-07-01". */
export function componentInWords(component: ScenarioComponent): string {
  const days = `${component.from === null ? '' : ` from ${component.from}`}${component.to === null ? '' : ` to ${component.to}`}`
  switch (component.component) {
    case 'salary_gross':
      return `the ${component.gross === 'floor' ? 'floor salary' : `salary of ${plainAmount(component.gross)}`}${days}`
    case 'director_basis':
      return `the ${component.basis} director basis${days}`
    case 'rent_monthly':
      return `the rent of ${plainAmount(component.amount)}${days}`
    case 'dividend':
      return `the ${component.amount === 'max' ? 'largest dividend' : `dividend of ${plainAmount(component.amount)}`}`
    case 'nontaxable':
      return `${component.item}${days}`
  }
}

function capitalised(text: string): string {
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`
}

/** The first month two spans both touch, or null. */
function sharedMonth(first: DateRange, second: DateRange): string | null {
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
