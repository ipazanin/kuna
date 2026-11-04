import { leftOver } from '../domain/leftOver'
import { changeDate } from '../domain/loanScenario'
import type { LoanChange, LoanCosts, LoanScenario } from '../domain/loanScenario'
import { offerEks } from '../domain/effectiveRate'
import { moveBreakEven, scenarioOutcome } from '../domain/scenarioOutcome'
import type { MoveBreakEven, ScenarioOutcome } from '../domain/scenarioOutcome'
import { offerBase, scenarioPlan } from '../domain/scenarioPlan'
import type { ScenarioBase, ScenarioPlan, ScenarioRefusal } from '../domain/scenarioPlan'
import { compareScenarios, letterOf, refusalText, spanOf } from './scenarioComparison'
import type { ComparedScenario, ScenarioComparison } from './scenarioComparison'
import type { ChartedScenario } from './scenarioCharts'
import { scenarioMonths } from './scenarioMonths'
import type { PickedScenario } from './useScenarioCompare'
import { words } from './words'
import { fractionOf } from '../../bankLoans/domain/yearlyRate'
import type { YearlyRate } from '../../bankLoans/domain/yearlyRate'
import { words as bankWords } from '../../bankLoans/presentation/words'
import type { ExtraPayment } from '../../workbook/domain/extraPayment'
import { LOAN_SCENARIO_RECORDS } from '../../workbook/domain/loanKinds'
import type { RatePeriod } from '../../workbook/domain/ratePeriod'
import type { ScenarioBook } from '../../workbook/domain/readLoanBook'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { lastDayOf, monthOf } from '../../../../shared/calendar/monthKey'
import { subtractMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import { formatMoney, formatRate } from '../../../../shared/money/moneyFormat'
import { keyOfRecordId } from '../../../../shared/storage/domain/recordId'
import { plural } from '../../../../shared/text/translation'

/** A scenario's key in the address and on the screen, its bare UUID. */
export function scenarioKey(scenario: LoanScenario): string {
  return keyOfRecordId(LOAN_SCENARIO_RECORDS, scenario.id)
}

/** The letter and colour token a compared scenario wears on every mark. */
export interface ScenarioMarking {
  readonly letter: string
  readonly colour: string
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

/** A picked scenario in its slot. */
export interface SlottedScenario {
  readonly worked: WorkedScenario
  readonly slot: number
  readonly letter: string
  /** The colour token of its marks, such as `--scenario-2`. */
  readonly colour: string
}

export function slotted(worked: readonly WorkedScenario[], picked: readonly PickedScenario[]): SlottedScenario[] {
  return picked.flatMap(({ key, slot }) => {
    const found = worked.find((entry) => entry.key === key)
    return found === undefined ? [] : [{ worked: found, slot, letter: letterOf(slot), colour: `--scenario-${slot}` }]
  })
}

/** The compared offers side by side, with what each leaves you ahead at the savings rate when one is typed in. Offers Kuna cannot work out stay out. */
export function offersComparison(compared: readonly SlottedScenario[], base: string, savings: YearlyRate | null): ScenarioComparison {
  const workedOut = compared.flatMap(({ worked, slot }) => (worked.outcome === null || 'refused' in worked.plan ? [] : [{ worked, outcome: worked.outcome, plan: worked.plan, slot }]))
  const basePlan = workedOut.find((entry) => entry.worked.key === base)?.plan ?? null
  const ahead =
    savings === null || basePlan === null
      ? null
      : leftOver(
          workedOut.map((entry) => entry.plan),
          basePlan,
          savings,
        )
  const scenarios = workedOut.map((entry, index): ComparedScenario => ({
    key: entry.worked.key,
    name: entry.worked.name,
    slot: entry.slot,
    outcome: entry.outcome,
    repayment: entry.plan.loan.repayment,
    eks: entry.worked.eks,
    bankEks: entry.worked.kept?.scenario.start.kind === 'offer' ? entry.worked.kept.scenario.start.terms.bankEks : null,
    leftOver: ahead?.[index] ?? null,
  }))
  return compareScenarios(scenarios, base)
}

/** The earliest payoff among the compared scenarios, by which the left-over line counts. */
export function earliestPayoff(compared: readonly SlottedScenario[]): CivilDate | null {
  return compared.reduce<CivilDate | null>((earliest, { worked }) => {
    const day = worked.outcome?.payoff ?? null
    return day !== null && (earliest === null || day < earliest) ? day : earliest
  }, null)
}

function rateWithType(rate: YearlyRate, rateType: RatePeriod['rateType']): string {
  return words.summary.rate(formatRate(fractionOf(rate)), bankWords.changes.rateTypes[rateType])
}

function costsText(costs: LoanCosts): string {
  return [
    ...(costs.upfront > 0 ? [words.summary.upfront(formatMoney(costs.upfront))] : []),
    ...(costs.monthly > 0 ? [words.summary.monthly(formatMoney(costs.monthly))] : []),
    ...(costs.yearly > 0 ? [words.summary.yearly(formatMoney(costs.yearly))] : []),
  ].join(', ')
}

/** What an extra payment's effect is called, which in Croatian follows the instalment word of where it shows. */
export type EffectWords = Readonly<Record<ExtraPayment['effect'], { readonly label: string }>>

/**
 * One change in a sentence, such as "Extra €150.00 every month from 20 Jan 2027, shorter term." A move
 * with costs says when they are paid back once `breakEven` is given.
 */
export function changeSummary(change: LoanChange, effects: EffectWords, breakEven?: MoveBreakEven | null): string {
  const effect = (value: ExtraPayment['effect']) => effects[value].label.toLowerCase()
  switch (change.kind) {
    case 'extra-payment':
      return words.summary.extra(formatMoney(change.amount), dayLabel(change.date), effect(change.effect))
    case 'regular-extra-payment': {
      const every = words.summary.every[change.every]
      return change.until === null
        ? words.summary.regular(formatMoney(change.amount), every, dayLabel(change.from), effect(change.effect))
        : words.summary.regularUntil(formatMoney(change.amount), every, dayLabel(change.from), dayLabel(change.until), effect(change.effect))
    }
    case 'rate-change':
      return words.summary.rateChange(rateWithType(change.rate, change.rateType), dayLabel(change.from))
    case 'move': {
      const costs = costsText(change.costs)
      const paidBack = costs === '' || breakEven === undefined ? '' : breakEven === null ? words.summary.neverPaidBack : words.summary.paidBackBy(dayLabel(lastDayOf(breakEven.month)))
      return `${plural(words.summary.move(change.lender, dayLabel(change.on), rateWithType(change.rate, change.rateType), change.instalments), change.instalments)}${costs === '' ? '' : words.summary.moveCosts(costs)}.${paidBack}`
    }
    case 'term-change':
      return words.summary.termChange(spanOf(change.instalments), dayLabel(change.from))
  }
}

/** What a try on a loan you have changes, in a line or two of sentences, the effects in the loan's own words. */
export function triedSummary(worked: WorkedScenario, effects: EffectWords): string {
  const changes = worked.kept?.changes ?? []
  if (changes.length === 0) return words.summary.noChanges
  return [...changes]
    .sort((first, second) => changeDate(first).localeCompare(changeDate(second)))
    .map((change) => changeSummary(change, effects, change.kind === 'move' ? worked.breakEven : null))
    .join(' ')
}

/** The charts' lines, one per compared scenario Kuna can work out. */
export function chartedScenarios(compared: readonly SlottedScenario[], from: CivilDate | null): ChartedScenario[] {
  return compared.flatMap(({ worked, letter, colour }) =>
    worked.outcome === null || 'refused' in worked.plan
      ? []
      : [
          {
            key: worked.key,
            letter,
            name: worked.name,
            colour,
            months: scenarioMonths(worked.plan, from),
            variableFrom: worked.outcome.variableFrom === null ? null : monthOf(worked.outcome.variableFrom),
          },
        ],
  )
}

/** One line of the list of kept scenarios. */
export interface ScenarioRow {
  readonly key: string
  readonly name: string
  /** Its letter and colour while compared, or null. */
  readonly mark: ScenarioMarking | null
  readonly detail: string
  readonly kept: ScenarioBook
}

/** Every offer, compared or not, with its terms and what it does to the interest against the base. */
export function scenarioRows(worked: readonly WorkedScenario[], compared: readonly SlottedScenario[], base: string | null): ScenarioRow[] {
  const baseOutcome = worked.find((entry) => entry.key === base)?.outcome ?? null
  return worked.flatMap((entry) => {
    const slot = compared.find((held) => held.worked.key === entry.key)
    const mark = slot === undefined ? null : { letter: slot.letter, colour: slot.colour }
    if (entry.kept === null || entry.kept.scenario.start.kind !== 'offer') return []
    const { terms } = entry.kept.scenario.start
    const what = plural(words.summary.offer(formatMoney(terms.principal), terms.instalments), terms.instalments)
    const effect =
      'refused' in entry.plan ? refusalText(entry.plan) : entry.outcome === null || baseOutcome === null || entry.key === base ? null : interestAgainst(entry.outcome.interest, baseOutcome.interest)
    const detail = [...(mark === null ? [words.list.notCompared] : []), what, ...(effect === null ? [] : [effect])].join(' · ')
    return [{ key: entry.key, name: entry.name, mark, detail, kept: entry.kept }]
  })
}

/** "€1,234.56 less interest", more, or the same. */
export function interestAgainst(figure: Money, base: Money): string {
  const difference = subtractMoney(figure, base)
  if (difference === 0) return words.list.sameInterest
  return difference < 0 ? words.list.lessInterest(formatMoney(-difference)) : words.list.moreInterest(formatMoney(difference))
}
