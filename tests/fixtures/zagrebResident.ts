import type { CivilDate } from '../../src/shared/calendar/civilDate'
import type { EmployeeFacts } from '../../src/packs/hr-doo/domain/payroll/incomeTax'
import type { RuleSource } from '../../src/packs/hr-doo/domain/payroll/payrollArithmetic'
import { ruleValue } from '../../src/packs/hr-doo/ruleset/ruleset'
import type { RuleId, RuleLookup, RuleValues } from '../../src/packs/hr-doo/ruleset/ruleset'
import { table, text } from '../../src/packs/hr-doo/ruleset/schema'

/**
 * The ruleset lists only the city rates the pack's own workbook needs. The tests add a Zagreb row at
 * the top of Zagreb's statutory range, 23% and 33%, read from `hr.pit.local-rate-ranges`.
 */
export const zagrebRules: RuleSource = <Id extends RuleId>(id: Id, on: CivilDate): RuleLookup<RuleValues[Id]> => {
  const lookup = ruleValue(id, on)
  if (id !== 'hr.pit.local-rates') {
    return lookup
  }
  const zagrebRange = ruleValue('hr.pit.local-rate-ranges', on).value.ranges.rows.find((range) => range.unitType.text === 'zagreb')
  if (zagrebRange === undefined) {
    throw new Error('The ruleset has no statutory range for Zagreb.')
  }
  const cityRates = (lookup.value as RuleValues['hr.pit.local-rates']).cityRates.rows
  const withZagreb: RuleValues['hr.pit.local-rates'] = {
    cityRates: table([...cityRates, { city: text('Zagreb'), lowerRate: zagrebRange.lowerRateTo, higherRate: zagrebRange.higherRateTo }]),
  }
  return { ...lookup, value: withZagreb as RuleValues[Id] }
}

/** A synthetic employed director living in Zagreb, in pillar II, with no dependants and no birth year set. */
export const ZAGREB_RESIDENT: EmployeeFacts = {
  residenceCity: 'Zagreb',
  pensionPillarTwo: true,
  dependants: 0,
  birthYear: null,
}
