import type { Grant } from '../../../../features/workbook/domain/grants'
import type { ScenarioComponent } from '../../../../features/workbook/domain/ownerPayScenarios'
import { addDays, civilDate } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { Money } from '../../../../shared/money/money'
import { ruleValue } from '../../ruleset/ruleset'
import type { RuleSource } from '../payroll/payrollArithmetic'

/** A component before it is on the tab. */
export type ComponentDraft = ScenarioComponent extends infer Each ? (Each extends ScenarioComponent ? Omit<Each, 'id'> : never) : never

export interface ScenarioDraft {
  readonly slug: string
  readonly label: string
  readonly year: number
  readonly components: readonly ComponentDraft[]
}

/** The tax-free items the second starting scenario pays up to their caps, which need no fact beyond the employment. */
const STARTING_TAX_FREE = ['results-bonus', 'occasional-gift', 'meal-allowance-flat'] as const

export interface StartingScenarios {
  readonly drafts: readonly ScenarioDraft[]
  /** The day the scenarios that stop the salary stop it, or null when no day in the year can, which leaves them out. */
  readonly switchOn: CivilDate | null
}

/**
 * The first day of the year no grant requires the employment on: 1 January when none binds the
 * year, the day after the latest employment date otherwise, or null when that falls after the year.
 */
export function employmentFreeFrom(year: number, grants: readonly Grant[]): CivilDate | null {
  const yearStart = civilDate(year, 1, 1)
  const required = grants.map((grant) => grant.employmentRequiredUntil).filter((day): day is CivilDate => day !== null)
  const lastRequired = required.reduce<CivilDate | null>((latest, day) => (latest === null || day > latest ? day : latest), null)
  const afterRequired = lastRequired === null ? yearStart : addDays(lastRequired, 1)
  return afterRequired > civilDate(year, 12, 31) ? null : afterRequired < yearStart ? yearStart : afterRequired
}

/**
 * The four scenarios to start comparing from, for one year: the floor salary all year, the same
 * with the yearly tax-free caps used and rent, and the floor salary until the grants no longer
 * require employment, then board-only insurance or a job elsewhere. Each pays out the rest as a
 * dividend. The caps come from the ruleset for the year. The rent is the owner's own figure, so a
 * null rent leaves it out. The first is the base the others compare with.
 */
export function startingScenarios(year: number, grants: readonly Grant[], monthlyRent: Money | null, rules: RuleSource = ruleValue): StartingScenarios {
  const yearStart = civilDate(year, 1, 1)
  const caps = rules('hr.pit.nontaxable-caps', yearStart).value.caps.rows
  const taxFree = STARTING_TAX_FREE.map((item): ComponentDraft => {
    const cap = caps.find((row) => row.payment.text === item && row.period.text === 'year')?.cap
    if (cap === undefined) {
      throw new RangeError(`The ruleset gives ${item} no yearly cap in ${year}.`)
    }
    return { component: 'nontaxable', item, amount: cap.cents, from: null, to: null }
  })
  const always = { from: null, to: null }
  const floor: ComponentDraft = { component: 'salary_gross', gross: 'floor', ...always }
  const dividend: ComponentDraft = { component: 'dividend', amount: 'max', ...always }
  const rent: ComponentDraft[] = monthlyRent === null ? [] : [{ component: 'rent_monthly', amount: monthlyRent, ...always }]

  const switchOn = employmentFreeFrom(year, grants)
  const until = (basis: 'board-only' | 'insured-elsewhere', on: CivilDate): ComponentDraft[] => [
    ...(on > yearStart ? [{ ...floor, to: addDays(on, -1) }] : []),
    { component: 'director_basis', basis, from: on > yearStart ? on : null, to: null },
    dividend,
  ]

  const drafts: ScenarioDraft[] = [
    { slug: `floor-salary-${year}`, label: 'Floor salary all year', year, components: [floor, dividend] },
    { slug: `floor-salary-extras-${year}`, label: monthlyRent === null ? 'Floor salary and tax-free items' : 'Floor salary, tax-free items and rent', year, components: [floor, ...taxFree, ...rent, dividend] },
    ...(switchOn === null
      ? []
      : [
          { slug: `floor-then-board-${year}`, label: 'Floor salary, then board member only', year, components: until('board-only', switchOn) },
          { slug: `floor-then-elsewhere-${year}`, label: 'Floor salary, then a job elsewhere', year, components: until('insured-elsewhere', switchOn) },
        ]),
  ]
  return { drafts, switchOn }
}
