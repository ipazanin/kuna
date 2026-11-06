import { offerEks } from './effectiveRate'
import type { LoanChange, LoanScenario } from './loanScenario'
import { moveBreakEven, scenarioOutcome } from './scenarioOutcome'
import type { MoveBreakEven, ScenarioOutcome } from './scenarioOutcome'
import { offerBase, scenarioPlan } from './scenarioPlan'
import type { ScenarioBase, ScenarioPlan, ScenarioRefusal } from './scenarioPlan'
import type { YearlyRate } from '../../bankLoans/domain/yearlyRate'
import { LOAN_SCENARIO_RECORDS } from '../../workbook/domain/loanKinds'
import type { ScenarioBook } from '../../workbook/domain/readLoanBook'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { keyOfRecordId } from '../../../../shared/storage/domain/recordId'

/** A scenario's key in the address and on the screen, its bare UUID. */
export function scenarioKey(scenario: LoanScenario): string {
  return keyOfRecordId(LOAN_SCENARIO_RECORDS, scenario.id)
}

/** A scenario worked out. */
export interface WorkedScenario {
  readonly key: string
  readonly name: string
  /** The kept scenario, or null for one still being typed. */
  readonly kept: ScenarioBook | null
  readonly plan: ScenarioPlan | ScenarioRefusal
  /** Null when Kuna cannot work the scenario out. */
  readonly outcome: ScenarioOutcome | null
  /** The month a move's costs are paid back, null without a move or when they never are. */
  readonly breakEven: MoveBreakEven | null
  /** Kuna's estimate of an offer's effective rate. */
  readonly eks: YearlyRate | null
}

/** A scenario's plan and figures, from the day for a try on a loan you have, or over the whole loan for an offer with `from` null. */
export function workedScenario(key: string, name: string, kept: ScenarioBook | null, base: ScenarioBase, changes: readonly LoanChange[], from: CivilDate | null): WorkedScenario {
  const plan = scenarioPlan(base, changes, from)
  if ('refused' in plan) return { key, name, kept, plan, outcome: null, breakEven: null, eks: null }
  const withoutMove =
    plan.move === null
      ? null
      : scenarioPlan(
          base,
          changes.filter((change) => change.kind !== 'move'),
          from,
        )
  return {
    key,
    name,
    kept,
    plan,
    outcome: scenarioOutcome(plan, from),
    breakEven: withoutMove === null || 'refused' in withoutMove ? null : moveBreakEven(plan, withoutMove),
    eks: from === null ? offerEks(base, changes) : null,
  }
}

/** Every offer worked out over its whole loan. */
export function workedOffers(scenarios: readonly ScenarioBook[]): WorkedScenario[] {
  return scenarios.flatMap((kept) =>
    kept.scenario.start.kind === 'offer' ? [workedScenario(scenarioKey(kept.scenario), kept.scenario.name, kept, offerBase(kept.scenario.name, kept.scenario.start.terms), kept.changes, null)] : [],
  )
}
