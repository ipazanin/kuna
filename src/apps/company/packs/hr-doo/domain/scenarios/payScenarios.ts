import type { OwnerPayScenario } from './ownerPayScenarios'
import type { HrDooWorkbook } from '../hrDooPart'
import type { CivilDate } from '../../../../../../shared/calendar/civilDate'
import { ruleValue } from '../../ruleset/ruleset'
import { citLiability, taxPeriodOf } from '../cit/citLiability'
import { taxBase } from '../cit/taxBase'
import { payrollDirector } from '../employees/employees'
import type { RuleSource } from '../payroll/payrollArithmetic'
import { marginalEuro } from './marginalEuro'
import type { MarginalRoute } from './marginalEuro'
import { scenarioCompany } from './scenarioCompany'
import type { ScenarioCompany } from './scenarioCompany'
import { scenarioGuards } from './scenarioGuards'
import type { ScenarioGuard } from './scenarioGuards'
import { scenarioOutcome } from './scenarioOutcome'
import type { ScenarioOutcome } from './scenarioOutcome'

export type ScenarioEntry =
  | { readonly kind: 'outcome'; readonly scenario: OwnerPayScenario; readonly outcome: ScenarioOutcome }
  | { readonly kind: 'refused'; readonly scenario: OwnerPayScenario; readonly guards: readonly ScenarioGuard[] }

/** Every scenario of a year on the same company figures, and the next euro compared route by route. */
export interface PayScenarios {
  readonly year: number
  readonly company: ScenarioCompany
  /** In the order the tab first lists them. */
  readonly entries: readonly ScenarioEntry[]
  readonly marginal: readonly MarginalRoute[]
}

/**
 * The year's scenarios worked out on the forecast seen on `asOf` and the facts of the director's row
 * on the employees tab. A scenario a guard stops is listed with why. Throws a RangeError without a
 * director's row with a city, since the payroll has no tax rates then.
 */
export function payScenarios(workbook: HrDooWorkbook, year: number, asOf: CivilDate, rules: RuleSource = ruleValue): PayScenarios {
  const company = scenarioCompany(workbook, year, asOf, rules)
  const facts = payrollDirector(workbook)
  if (facts === null) {
    throw new RangeError('The employees tab has no director with a city of residence, which the payroll needs for its income tax rates.')
  }
  const entries = workbook.payScenarios
    .filter((scenario) => scenario.year === year)
    .map((scenario): ScenarioEntry => {
      const guards = scenarioGuards(scenario, rules)
      return guards.length > 0 ? { kind: 'refused', scenario, guards } : { kind: 'outcome', scenario, outcome: scenarioOutcome(scenario, company, facts, rules) }
    })
  const rate = citLiability(taxBase({ ...company.taxBaseInput, year }, rules), taxPeriodOf(year, company.registered), null, rules).rate
  return { year, company, entries, marginal: marginalEuro(year, facts, rate, rules) }
}
