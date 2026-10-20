import type { OwnerPayScenario, ScenarioComponent } from '../../../../features/workbook/domain/ownerPayScenarios'
import { addDays, civilDate } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { overlapOf, spanOf } from './scenarioSchedule'
import type { DaySpan } from './scenarioSchedule'

/**
 * The owner pay of a year that follows one scenario until the day before `switchOn` and another
 * from it: each scenario's components cut to its part of the year. A tax-free item is paid in the
 * month its row starts, so the second scenario's items start on the switch day at the earliest. The
 * dividend is left out, since the plan sets the year's payout on its own row.
 */
export function switchedScenario(first: OwnerPayScenario, second: OwnerPayScenario, switchOn: CivilDate): OwnerPayScenario {
  const { year } = first
  const before = { from: civilDate(year, 1, 1), to: addDays(switchOn, -1) }
  const after = { from: switchOn, to: civilDate(year, 12, 31) }
  return {
    slug: `${first.slug}+${second.slug}`,
    label: `${first.label || first.slug}, then ${second.label || second.slug}`,
    year,
    components: [...cutTo(first, before), ...cutTo(second, after)],
  }
}

/** One scenario's pay as the plan counts it: every component but the dividend. */
export function payOnly(scenario: OwnerPayScenario): OwnerPayScenario {
  return { ...scenario, components: scenario.components.filter((component) => component.component !== 'dividend') }
}

function cutTo(scenario: OwnerPayScenario, part: DaySpan): ScenarioComponent[] {
  const { year } = scenario
  const yearStart = civilDate(year, 1, 1)
  const yearEnd = civilDate(year, 12, 31)
  return payOnly(scenario).components.flatMap((component): ScenarioComponent[] => {
    const span = spanOf(component, year)
    if (component.component === 'nontaxable') {
      const paid = span.from > part.from ? span.from : part.from
      return paid > part.to ? [] : [{ ...component, from: paid === yearStart ? null : paid }]
    }
    const shared = overlapOf(span, part)
    return shared === null ? [] : [{ ...component, from: shared.from === yearStart ? null : shared.from, to: shared.to === yearEnd ? null : shared.to }]
  })
}
