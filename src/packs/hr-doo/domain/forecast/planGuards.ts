import type { OwnerPayScenario } from '../../../../features/workbook/domain/ownerPayScenarios'
import type { PlanLine } from '../../../../features/workbook/domain/plan'
import { civilDate } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { ruleValue } from '../../ruleset/ruleset'
import type { RuleSource } from '../payroll/payrollArithmetic'
import { scenarioGuards } from '../scenarios/scenarioGuards'
import { payOnly, switchedScenario } from '../scenarios/switchedScenario'

/** Why rows of the plan tab cannot be planned with as they stand, naming the rows. */
export interface PlanGuard {
  readonly sheetRows: readonly number[]
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
  | { readonly kind: 'none' }
  | { readonly kind: 'refused'; readonly lines: readonly OwnerPayLine[]; readonly guards: readonly PlanGuard[] }
  | { readonly kind: 'planned'; readonly pay: PlannedOwnerPay }

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
    const dividends = inYear.filter((line) => line.kind === 'amount' && line.item === 'dividend').map((line) => line.sheetRow)
    return [
      ...(ownerPay.kind === 'refused' ? ownerPay.guards : []),
      ...(dividends.length > 1 ? [{ sheetRows: dividends, reason: `Rows ${listed(dividends)} each plan a dividend for ${year}. Plan one payout a year.` }] : []),
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
  const rows = lines.map((line) => line.sheetRow)
  const undated = lines.filter((line) => line.from === null)
  const dated = lines.filter((line) => line.from !== null)
  if (dated.length > 1) {
    return refused([{ sheetRows: dated.map((line) => line.sheetRow), reason: `Rows ${listed(dated.map((line) => line.sheetRow))} each switch the owner pay of ${year}. A year's plan switches once, from one scenario to another.` }])
  }
  const [switching] = dated
  if (switching !== undefined && switching.from === civilDate(year, 1, 1)) {
    return refused([{ sheetRows: [switching.sheetRow], reason: `Row ${switching.sheetRow} switches the owner pay on 1 January, which leaves the first scenario no day. Leave its date blank instead.` }])
  }
  const [opening] = undated
  if (opening === undefined) {
    return refused([{ sheetRows: rows, reason: `Row ${switching?.sheetRow} switches the owner pay on ${switching?.from}, but no row without a date sets it before then. Add the scenario ${year} starts with.` }])
  }
  const named = lines.map((line) => ({ line, scenario: scenarios.find((candidate) => candidate.slug === line.scenario) }))
  const wrongYear = named.flatMap(({ line, scenario }): PlanGuard[] =>
    scenario === undefined
      ? [{ sheetRows: [line.sheetRow], reason: `Row ${line.sheetRow} names ${line.scenario}, which is not on the scenarios tab.` }]
      : scenario.year === year
        ? []
        : [{ sheetRows: [line.sheetRow], reason: `Row ${line.sheetRow} names ${line.scenario}, a scenario for ${scenario.year}, in the plan for ${year}.` }],
  )
  if (wrongYear.length > 0) {
    return refused(wrongYear)
  }
  const first = named.find(({ line }) => line === opening)?.scenario as OwnerPayScenario
  const second = switching === undefined ? null : (named.find(({ line }) => line === switching)?.scenario as OwnerPayScenario)
  const scenario = second === null || switching?.from == null ? payOnly(first) : switchedScenario(first, second, switching.from)
  const stopped = scenarioGuards(scenario, rules)
  if (stopped.length > 0) {
    return refused(stopped.map((guard) => ({ sheetRows: rows, reason: `The owner pay of ${rows.length === 1 ? `row ${rows[0]}` : `rows ${listed(rows)}`}: ${guard.reason}` })))
  }
  return { kind: 'planned', pay: { year, scenario, first, second, switchOn: switching?.from ?? null, lines } }
}

/** Row numbers as a sentence lists them: "3 and 4", "3, 4 and 7". */
function listed(rows: readonly number[]): string {
  return rows.length < 2 ? rows.join('') : `${rows.slice(0, -1).join(', ')} and ${rows[rows.length - 1]}`
}
