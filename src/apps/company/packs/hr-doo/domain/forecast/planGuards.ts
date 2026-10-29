import type { OwnerPayScenario } from '../scenarios/ownerPayScenarios'
import type { PlanLine } from './plan'
import type { RecordId } from '../../../../../../shared/storage/domain/recordId'
import { civilDate } from '../../../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../../../shared/calendar/civilDate'
import { ruleValue } from '../../ruleset/ruleset'
import type { RuleSource } from '../payroll/payrollArithmetic'
import { scenarioGuards } from '../scenarios/scenarioGuards'
import { payOnly, switchedScenario } from '../scenarios/switchedScenario'

/** Why lines of the plan tab cannot be planned with as they stand, and which lines. */
export interface PlanGuard {
  readonly ids: readonly RecordId[]
  readonly reason: string
}

type OwnerPayLine = Extract<PlanLine, { readonly kind: 'owner-pay-scenario' }>

/** The owner pay a year's plan sets: one scenario for the year, or two with the day the second takes over. */
export interface PlannedOwnerPay {
  readonly year: number
  /** The pay of the year as one scenario, without its dividend. */
  readonly scenario: OwnerPayScenario
  readonly first: OwnerPayScenario
  readonly second: OwnerPayScenario | null
  /** The day the second scenario takes over, or null with one scenario. */
  readonly switchOn: CivilDate | null
  readonly lines: readonly OwnerPayLine[]
}

export type OwnerPayPlan =
  { readonly kind: 'none' } | { readonly kind: 'refused'; readonly lines: readonly OwnerPayLine[]; readonly guards: readonly PlanGuard[] } | { readonly kind: 'planned'; readonly pay: PlannedOwnerPay }

/**
 * What stops the plan tab from being planned with, year by year: an owner pay that switches more
 * than once, switches with no scenario before it, switches on 1 January, names a scenario of
 * another year or adds up to a scenario its guards stop, and more than one dividend in a year. The
 * reader has checked each row on its own already.
 */
export function planGuards(lines: readonly PlanLine[], scenarios: readonly OwnerPayScenario[], rules: RuleSource = ruleValue): PlanGuard[] {
  const years = [...new Set(lines.map((line) => line.year))].sort((earlier, later) => earlier - later)
  return years.flatMap((year) => {
    const inYear = lines.filter((line) => line.year === year)
    const ownerPay = ownerPayPlan(inYear, scenarios, rules)
    const dividends = inYear.filter((line) => line.kind === 'amount' && line.item === 'dividend')
    const months = dividends.map((line) => `month ${line.month}`)
    return [
      ...(ownerPay.kind === 'refused' ? ownerPay.guards : []),
      ...(dividends.length > 1 ? [{ ids: dividends.map((line) => line.id), reason: `The plan for ${year} pays a dividend in ${listed(months)}. Plan one payout a year.` }] : []),
    ]
  })
}

/** The owner pay one year's plan rows set, or why they cannot set it. */
export function ownerPayPlan(yearLines: readonly PlanLine[], scenarios: readonly OwnerPayScenario[], rules: RuleSource = ruleValue): OwnerPayPlan {
  const lines = yearLines.filter((line): line is OwnerPayLine => line.kind === 'owner-pay-scenario')
  const [any] = lines
  if (any === undefined) {
    return { kind: 'none' }
  }
  const { year } = any
  const refused = (guards: readonly PlanGuard[]): OwnerPayPlan => ({ kind: 'refused', lines, guards })
  const ids = lines.map((line) => line.id)
  const undated = lines.filter((line) => line.from === null)
  const dated = lines.filter((line) => line.from !== null)
  if (dated.length > 1) {
    return refused([
      { ids: dated.map((line) => line.id), reason: `The owner pay of ${year} switches on ${listed(dated.map((line) => line.from ?? ''))}. A year's plan switches once, from one scenario to another.` },
    ])
  }
  const [switching] = dated
  if (switching !== undefined && switching.from === civilDate(year, 1, 1)) {
    return refused([{ ids: [switching.id], reason: `The switch to ${switching.scenario} is dated 1 January ${year}, which leaves the first scenario no day. Leave its date blank instead.` }])
  }
  const [opening] = undated
  if (opening === undefined) {
    return refused([{ ids, reason: `The owner pay switches to ${switching?.scenario} on ${switching?.from}, but no row without a date sets it before then. Add the scenario ${year} starts with.` }])
  }
  const named = lines.map((line) => ({ line, scenario: scenarios.find((candidate) => candidate.slug === line.scenario) }))
  const wrongYear = named.flatMap(({ line, scenario }): PlanGuard[] =>
    scenario === undefined
      ? [{ ids: [line.id], reason: `The owner pay of ${year} names ${line.scenario}, which is not on the scenarios tab.` }]
      : scenario.year === year
        ? []
        : [{ ids: [line.id], reason: `The owner pay of ${year} names ${line.scenario}, a scenario for ${scenario.year}.` }],
  )
  if (wrongYear.length > 0) {
    return refused(wrongYear)
  }
  const first = named.find(({ line }) => line === opening)?.scenario as OwnerPayScenario
  const second = switching === undefined ? null : (named.find(({ line }) => line === switching)?.scenario as OwnerPayScenario)
  const scenario = second === null || switching?.from == null ? payOnly(first) : switchedScenario(first, second, switching.from)
  const stopped = scenarioGuards(scenario, rules)
  if (stopped.length > 0) {
    return refused(stopped.map((guard) => ({ ids, reason: `The owner pay of ${year}: ${guard.reason}` })))
  }
  return { kind: 'planned', pay: { year, scenario, first, second, switchOn: switching?.from ?? null, lines } }
}

/** Words as a sentence lists them: "a and b", "a, b and c". */
function listed(words: readonly string[]): string {
  return words.length < 2 ? words.join('') : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`
}
