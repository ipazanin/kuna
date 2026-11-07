import { comparedScenarios } from '../domain/scenarioComparison'
import type { ComparedCell, ComparedLine, ComparedScenario } from '../domain/scenarioComparison'
import type { ScenarioOutcome } from '../domain/scenarioOutcome'
import type { ScenarioRefusal } from '../domain/scenarioPlan'
import { fractionOf, percentagePoints } from '../../bankLoans/domain/yearlyRate'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { monthLabel } from '../../../../shared/calendar/monthLabel'
import { monthOf } from '../../../../shared/calendar/monthKey'
import { formatMoney, formatPoints, formatRate } from '../../../../shared/money/moneyFormat'
import { plural } from '../../../../shared/text/translation'
import { words } from './words'
import { moneyFromCents } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'

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
  /** A second figure under the first, such as the last instalment where the instalment changes, or null. */
  readonly second: string | null
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

/** "2 y 7 m" for a whole number of months, either way. */
export function spanOf(months: number): string {
  const span = Math.abs(months)
  return [...(span >= 12 ? [words.span.years(Math.floor(span / 12))] : []), ...(span % 12 > 0 ? [words.span.months(span % 12)] : [])].join(' ')
}

/** "2 y 7 m sooner", or later, for a whole number of months. */
export function spanText(months: number): string {
  return months < 0 ? words.span.sooner(spanOf(months)) : words.span.later(spanOf(months))
}

function cellOf<Figure>(
  cell: ComparedCell<Figure>,
  text: (figure: Figure) => string,
  differenceText: (difference: number) => string,
  second: (outcome: ScenarioOutcome) => string | null = () => null,
  warning: (outcome: ScenarioOutcome) => string | null = () => null,
): ComparisonCell {
  return {
    text: cell.figure === null ? NO_FIGURE : text(cell.figure),
    second: cell.figure === null ? null : second(cell.scenario.outcome),
    best: cell.best,
    estimate: cell.estimate,
    difference: cell.aboveBase === 0 ? null : differenceText(cell.aboveBase),
    warning: cell.figure === null ? null : warning(cell.scenario.outcome),
  }
}

function lastInstalmentText(outcome: ScenarioOutcome): string | null {
  return outcome.instalmentChanges && outcome.lastInstalment !== null ? words.lastInstalment(formatMoney(outcome.lastInstalment)) : null
}

function subsidyWarning(outcome: ScenarioOutcome): string | null {
  return outcome.subsidyPayback === null ? null : words.paidBack
}

function moneyCells(line: Extract<ComparedLine, { readonly unit: 'money' }>): ComparisonCell[] {
  const signed = (cents: number): string => formatMoney(moneyFromCents(cents), 'always')
  const text = line.key === 'left-over' ? signed : (cents: Money): string => formatMoney(cents)
  const second = line.key === 'instalment' ? lastInstalmentText : undefined
  const warning = line.key === 'subsidy' ? subsidyWarning : undefined
  return line.cells.map((cell) => cellOf(cell, text, signed, second, warning))
}

function pointsText(difference: number): string {
  const points = percentagePoints(difference)
  return plural(words.points(formatPoints(points), difference > 0), points)
}

function lineLabel(key: ComparedLine['key']): string {
  const { lines: label } = words
  const labels: Readonly<Record<ComparedLine['key'], string>> = {
    instalment: label.instalment,
    interest: label.interest,
    total: label.total,
    payoff: label.payoff,
    extra: label.extra,
    costs: label.costs,
    subsidy: label.subsidyPays,
    eks: label.eks,
    'bank-eks': label.bankEks,
    'left-over': label.leftOver,
  }
  return labels[key]
}

function cellsOfLine(line: ComparedLine): ComparisonCell[] {
  switch (line.unit) {
    case 'money':
      return moneyCells(line)
    case 'month':
      return line.cells.map((cell) => cellOf(cell, (day) => monthLabel(monthOf(day)), spanText))
    case 'rate':
      return line.cells.map((cell) => cellOf(cell, (rate) => formatRate(fractionOf(rate)), pointsText))
  }
}

/** The compared offers side by side in words, the base marked, the last instalment under the monthly one where it changes. */
export function compareScenarios(compared: readonly ComparedScenario[], base: string): ScenarioComparison {
  const { scenarios, base: baseScenario, lines } = comparedScenarios(compared, base)
  return {
    columns: scenarios.map((scenario) => ({ key: scenario.key, name: scenario.name, letter: letterOf(scenario.slot), colour: `--scenario-${scenario.slot}`, isBase: scenario === baseScenario })),
    lines: lines.map((line) => ({ key: line.key, label: lineLabel(line.key), total: line.key === 'total', cells: cellsOfLine(line) })),
  }
}
/** Why Kuna cannot work a scenario out, as its card says it. */
export function refusalText(refusal: ScenarioRefusal): string {
  switch (refusal.refused) {
    case 'not-a-due-date':
      return words.refusals.notADueDate(dayLabel(refusal.date), refusal.loan)
    case 'rate-shares-day':
      return words.refusals.rateSharesDay(dayLabel(refusal.date))
    case 'term-shares-day':
      return words.refusals.termSharesDay(dayLabel(refusal.date))
    case 'term-past-end':
      return words.refusals.termPastEnd(dayLabel(refusal.date), refusal.loan)
    case 'no-first-rate':
      return words.refusals.noFirstRate(dayLabel(refusal.firstInstalment))
    case 'move-not-before-payoff':
      return words.refusals.moveNotBeforePayoff(dayLabel(refusal.on))
    case 'two-moves':
      return words.refusals.twoMoves
  }
}
