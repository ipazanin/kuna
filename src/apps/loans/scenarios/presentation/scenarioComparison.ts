import type { ScenarioOutcome } from '../domain/scenarioOutcome'
import type { ScenarioRefusal } from '../domain/scenarioPlan'
import { fractionOf, MILLIONTHS_PER_PERCENT } from '../../bankLoans/domain/yearlyRate'
import type { YearlyRate } from '../../bankLoans/domain/yearlyRate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { monthLabel } from '../../../../shared/calendar/monthLabel'
import { monthNumber, monthOf, yearOfMonth } from '../../../../shared/calendar/monthKey'
import { formatCount, formatMoney, formatPoints, formatRate } from '../../../../shared/money/moneyFormat'
import type { Money } from '../../../../shared/money/money'
import { plural } from '../../../../shared/text/translation'
import { words } from './words'

/** A loan's tab compares its scenarios from today, with the loan as it stands as A. Offers compare whole loans. */
export type ScenarioTab = 'loan' | 'offers'

/** The most scenarios a comparison holds, A to D. */
export const MOST_COMPARED = 4

/** A worked-out scenario in its slot, 1 to 4, which gives its letter and colour for as long as it stays picked. */
export interface ComparedScenario {
  readonly key: string
  readonly name: string
  readonly slot: number
  readonly outcome: ScenarioOutcome
  /** Kuna's estimate of an offer's effective rate, or null where Kuna has none. */
  readonly eks?: YearlyRate | null
  /** The effective rate the bank printed for an offer, or null when none was typed in. */
  readonly bankEks?: YearlyRate | null
  /** What the scenario leaves you ahead of the base at the savings rate, or null without one. */
  readonly leftOver?: Money | null
}

export interface ComparisonColumn {
  readonly key: string
  readonly name: string
  readonly letter: string
  /** The colour token of the scenario's marks, such as `--scenario-2`. */
  readonly colour: string
  readonly isBase: boolean
}

export interface ComparisonCell {
  /** The figure as it reads, or a dash where the scenario has none. */
  readonly text: string
  /** The one best figure of the line, which no other scenario holds. */
  readonly best: boolean
  /** Worked out at a variable rate, so the bank's figure may differ. */
  readonly estimate: boolean
  /** The difference to the base, such as "−€5.33", "2 y 7 m sooner" or "−31". Null in the base's column and where nothing differs. */
  readonly difference: string | null
  /** Why the figure needs a second look, such as a subsidy that is paid back, or null. */
  readonly warning: string | null
}

export interface ComparisonLine {
  readonly key: string
  readonly label: string
  readonly group: 'instalments' | 'costs'
  readonly total: boolean
  readonly cells: readonly ComparisonCell[]
}

export interface ScenarioComparison {
  readonly columns: readonly ComparisonColumn[]
  readonly lines: readonly ComparisonLine[]
}

const NO_FIGURE = '–'

/** A scenario's letter from its slot: A for 1. */
export function letterOf(slot: number): string {
  return String.fromCharCode(64 + slot)
}

/** How many months later `to` falls than `from`, by their months. */
function monthsLater(from: CivilDate, to: CivilDate): number {
  const [start, end] = [monthOf(from), monthOf(to)]
  return (yearOfMonth(end) - yearOfMonth(start)) * 12 + monthNumber(end) - monthNumber(start)
}

/** How many months later `to` is paid off than `from`, null when either is not. */
export function payoffMonthsLater(from: CivilDate | null, to: CivilDate | null): number | null {
  return from === null || to === null ? null : monthsLater(from, to)
}

/** "2 y 7 m" for a whole number of months, either way. */
export function spanOf(months: number): string {
  const span = Math.abs(months)
  return [...(span >= 12 ? [words.span.years(Math.floor(span / 12))] : []), ...(span % 12 > 0 ? [words.span.months(span % 12)] : [])].join(' ')
}

/** "2 y 7 m sooner", or later, for a whole number of months. */
export function spanText(months: number): string {
  return months < 0 ? words.span.sooner(spanOf(months)) : words.span.later(spanOf(months))
}

type Better = 'lower' | 'higher' | 'none'

/** One line of figures: how each scenario's reads, how two differ and which way is better. */
interface LineSpec<Figure> {
  readonly key: string
  readonly label: string
  readonly group: ComparisonLine['group']
  readonly total?: boolean
  readonly better: Better
  /** False where a tick would mislead. */
  readonly ticks?: boolean
  /** False where the figure is itself the difference to the base. */
  readonly differences?: boolean
  readonly pick: (scenario: ComparedScenario) => Figure | null
  readonly estimate?: (outcome: ScenarioOutcome) => boolean
  readonly warning?: (outcome: ScenarioOutcome) => string | null
  /** How far the figure is above the other, in its own unit, which decides the best and the difference. */
  readonly above: (figure: Figure, other: Figure) => number
  readonly text: (figure: Figure) => string
  readonly differenceText: (difference: number) => string
}

function moneyLine(
  key: string,
  label: string,
  group: ComparisonLine['group'],
  better: Better,
  pick: (scenario: ComparedScenario) => number | null,
  more: Partial<LineSpec<number>> = {},
): LineSpec<number> {
  return { key, label, group, better, pick, above: (figure, other) => figure - other, text: (cents) => formatMoney(cents), differenceText: (cents) => formatMoney(cents, 'always'), ...more }
}

function lineOf<Figure>(spec: LineSpec<Figure>, scenarios: readonly ComparedScenario[], base: ComparedScenario | null): ComparisonLine {
  const figures = scenarios.map((scenario) => spec.pick(scenario))
  const held = figures.filter((figure) => figure !== null)
  const direction = spec.better === 'higher' ? -1 : 1
  const lowest = held.reduce<Figure | null>((least, figure) => (least === null || direction * spec.above(figure, least) < 0 ? figure : least), null)
  const single = lowest !== null && held.filter((figure) => spec.above(figure, lowest) === 0).length === 1 && held.length > 1
  const baseFigure = base === null ? null : spec.pick(base)
  return {
    key: spec.key,
    label: spec.label,
    group: spec.group,
    total: spec.total === true,
    cells: scenarios.map((scenario, index): ComparisonCell => {
      const figure = figures[index] ?? null
      const difference = figure === null || baseFigure === null || scenario === base || spec.differences === false ? 0 : spec.above(figure, baseFigure)
      return {
        text: figure === null ? NO_FIGURE : spec.text(figure),
        best: spec.ticks !== false && spec.better !== 'none' && single && figure !== null && spec.above(figure, lowest) === 0,
        estimate: figure !== null && spec.estimate !== undefined && spec.estimate(scenario.outcome),
        difference: difference === 0 ? null : spec.differenceText(difference),
        warning: figure === null ? null : (spec.warning?.(scenario.outcome) ?? null),
      }
    }),
  }
}

/**
 * The compared scenarios side by side in the order of their slots, the base marked. Each line marks
 * the one best figure when a single scenario holds it, lower, fewer or earlier being better, and
 * gives every other column its difference to the base. Extra you put in and what the subsidy pays
 * have no better way. A money line every scenario holds at nothing drops, and the instalment after a
 * move shows only when a compared scenario moves. Offers of different numbers of instalments get no
 * tick on interest or the total, since a shorter loan always pays less interest. Offers add Kuna's
 * estimate of the effective rate, and the bank's when one is typed in. With a savings rate, a last
 * line gives what each scenario leaves you ahead, more being better.
 */
export function compareScenarios(compared: readonly ComparedScenario[], base: string, tab: ScenarioTab, payer: string): ScenarioComparison {
  const scenarios = [...compared].sort((first, second) => first.slot - second.slot)
  const baseScenario = scenarios.find((scenario) => scenario.key === base) ?? null
  const sameTerm = new Set(scenarios.map((scenario) => scenario.outcome.instalments)).size <= 1
  const termTicks = tab === 'loan' || sameTerm
  const { lines: label } = words

  const instalments: readonly LineSpec<number>[] = [
    moneyLine('next-instalment', tab === 'loan' ? label.nextInstalment : label.firstInstalment, 'instalments', 'lower', ({ outcome }) => outcome.nextInstalment),
    moneyLine('highest-instalment', label.highestInstalment, 'instalments', 'lower', ({ outcome }) => outcome.highestInstalment?.amount ?? null, {
      estimate: (outcome) => outcome.highestInstalment?.estimate === true,
    }),
    ...(scenarios.some((scenario) => scenario.outcome.afterMove !== null) ? [moneyLine('after-move', label.afterMove, 'instalments', 'lower', ({ outcome }) => outcome.afterMove)] : []),
  ]
  const count: LineSpec<number> = {
    key: 'instalments',
    label: tab === 'loan' ? label.instalmentsLeft : label.instalmentsInAll,
    group: 'instalments',
    better: 'lower',
    pick: ({ outcome }) => outcome.instalments,
    above: (figure, other) => figure - other,
    text: (instalments) => formatCount(instalments),
    differenceText: (instalments) => formatCount(instalments, 'always'),
  }
  const payoff: LineSpec<CivilDate> = {
    key: 'payoff',
    label: label.payoff,
    group: 'instalments',
    better: 'lower',
    pick: ({ outcome }) => outcome.payoff,
    above: (figure, other) => monthsLater(other, figure),
    text: (day) => monthLabel(monthOf(day)),
    differenceText: spanText,
  }
  const costs: readonly LineSpec<number>[] = [
    moneyLine('interest', tab === 'loan' ? label.interestLeft : label.interest, 'costs', 'lower', ({ outcome }) => outcome.interest, { ticks: termTicks }),
    moneyLine('extra', label.extra, 'costs', 'none', ({ outcome }) => outcome.extra),
    moneyLine('costs', label.costs, 'costs', 'lower', ({ outcome }) => outcome.costs),
    moneyLine('subsidy', label.subsidyPays(payer), 'costs', 'none', ({ outcome }) => outcome.subsidy, { warning: (outcome) => (outcome.subsidyPayback === null ? null : words.paidBack) }),
    moneyLine('total', label.total, 'costs', 'lower', ({ outcome }) => outcome.total, { total: true, ticks: termTicks }),
  ]
  const rateLine = (key: string, lineLabel: string, better: Better, pick: (scenario: ComparedScenario) => YearlyRate | null): LineSpec<number> => ({
    key,
    label: lineLabel,
    group: 'costs',
    better,
    pick,
    above: (figure, other) => figure - other,
    text: (rate) => formatRate(fractionOf(rate as YearlyRate)),
    differenceText: (rate) => {
      const points = Math.abs(rate) / MILLIONTHS_PER_PERCENT
      return plural(words.points(formatPoints(points), rate > 0), points)
    },
  })
  const rates: readonly LineSpec<number>[] =
    tab === 'offers'
      ? [
          rateLine('eks', label.eks, 'lower', (scenario) => scenario.eks ?? null),
          ...(scenarios.some((scenario) => (scenario.bankEks ?? null) !== null) ? [rateLine('bank-eks', label.bankEks, 'none', (scenario) => scenario.bankEks ?? null)] : []),
        ]
      : []
  const leftOverLine = (lineLabel: string): LineSpec<number> =>
    moneyLine('left-over', lineLabel, 'costs', 'higher', (scenario) => scenario.leftOver ?? null, { differences: false, text: (cents) => formatMoney(cents, 'always') })
  const heldAtNothing = (spec: LineSpec<number>): boolean => scenarios.every((scenario) => (spec.pick(scenario) ?? 0) === 0)
  const leftOvers = scenarios.some((scenario) => (scenario.leftOver ?? null) !== null) ? [leftOverLine(label.leftOver)] : []

  return {
    columns: scenarios.map((scenario) => ({ key: scenario.key, name: scenario.name, letter: letterOf(scenario.slot), colour: `--scenario-${scenario.slot}`, isBase: scenario === baseScenario })),
    lines: [
      ...instalments.filter((spec) => !heldAtNothing(spec)).map((spec) => lineOf(spec, scenarios, baseScenario)),
      lineOf(count, scenarios, baseScenario),
      lineOf(payoff, scenarios, baseScenario),
      ...costs.filter((spec) => !heldAtNothing(spec)).map((spec) => lineOf(spec, scenarios, baseScenario)),
      ...rates.filter((spec) => scenarios.some((scenario) => spec.pick(scenario) !== null)).map((spec) => lineOf(spec, scenarios, baseScenario)),
      ...leftOvers.map((spec) => lineOf(spec, scenarios, baseScenario)),
    ],
  }
}

/** Why Kuna cannot work a scenario out, as its card says it. */
export function refusalText(refusal: ScenarioRefusal): string {
  switch (refusal.refused) {
    case 'not-a-due-date':
      return words.refusals.notADueDate(dayLabel(refusal.date), refusal.loan)
    case 'rate-shares-day':
      return words.refusals.rateSharesDay(dayLabel(refusal.date))
    case 'no-first-rate':
      return words.refusals.noFirstRate(dayLabel(refusal.firstInstalment))
    case 'move-not-before-payoff':
      return words.refusals.moveNotBeforePayoff(dayLabel(refusal.on))
    case 'two-moves':
      return words.refusals.twoMoves
  }
}
