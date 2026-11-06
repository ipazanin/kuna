import { changeDate } from '../domain/loanScenario'
import type { LoanChange, LoanCosts } from '../domain/loanScenario'
import type { MoveBreakEven } from '../domain/scenarioOutcome'
import { comparedOffers } from '../domain/scenarioComparison'
import type { PickedScenario } from '../domain/scenarioSlots'
import type { WorkedScenario } from '../domain/workedScenario'
import { compareScenarios, letterOf, refusalText, spanOf } from './scenarioComparison'
import type { ScenarioComparison } from './scenarioComparison'
import type { ChartedScenario } from './scenarioCharts'
import { scenarioMonths } from './scenarioMonths'
import { words } from './words'
import { fractionOf } from '../../bankLoans/domain/yearlyRate'
import type { YearlyRate } from '../../bankLoans/domain/yearlyRate'
import { words as bankWords } from '../../bankLoans/presentation/words'
import type { ExtraPayment } from '../../workbook/domain/extraPayment'
import type { RatePeriod } from '../../workbook/domain/ratePeriod'
import type { ScenarioBook } from '../../workbook/domain/readLoanBook'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { lastDayOf, monthOf } from '../../../../shared/calendar/monthKey'
import { subtractMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import { formatMoney, formatRate } from '../../../../shared/money/moneyFormat'
import { plural } from '../../../../shared/text/translation'

/** The letter and colour token a compared scenario wears on every mark. */
export interface ScenarioMarking {
  readonly letter: string
  readonly colour: string
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
  return compareScenarios(comparedOffers(compared, base, savings), base)
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
