import { leftOver } from './leftOver'
import type { ScenarioOutcome } from './scenarioOutcome'
import type { WorkedScenario } from './workedScenario'
import type { YearlyRate } from '../../bankLoans/domain/yearlyRate'
import type { BankLoan } from '../../workbook/domain/bankLoan'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { monthNumber, monthOf, yearOfMonth } from '../../../../shared/calendar/monthKey'
import type { Money } from '../../../../shared/money/money'

/** A worked-out scenario in its slot, 1 to 4, which gives its letter and colour for as long as it stays picked. */
export interface ComparedScenario {
  readonly key: string
  readonly name: string
  readonly slot: number
  readonly outcome: ScenarioOutcome
  readonly repayment: BankLoan['repayment']
  /** Kuna's estimate of an offer's effective rate, or null where Kuna has none. */
  readonly eks?: YearlyRate | null
  /** The effective rate the bank printed for an offer, or null when none was typed in. */
  readonly bankEks?: YearlyRate | null
  /** What the scenario leaves you ahead of the base at the savings rate, or null without one. */
  readonly leftOver?: Money | null
}

/** One scenario's figure on a line of the comparison. */
export interface ComparedCell<Figure> {
  readonly scenario: ComparedScenario
  /** Null where the scenario has no such figure. */
  readonly figure: Figure | null
  /** The one best figure of the line, which no other scenario holds. */
  readonly best: boolean
  /** Worked out at a variable rate, so the bank's figure may differ. */
  readonly estimate: boolean
  /** How far the figure is above the base's, in cents, months or millionths. Zero in the base's column and where nothing differs. */
  readonly aboveBase: number
}

type MoneyLineKey = 'instalment' | 'interest' | 'total' | 'extra' | 'costs' | 'subsidy' | 'left-over'
type RateLineKey = 'eks' | 'bank-eks'

export type ComparedLine =
  | { readonly unit: 'money'; readonly key: MoneyLineKey; readonly cells: readonly ComparedCell<Money>[] }
  | { readonly unit: 'month'; readonly key: 'payoff'; readonly cells: readonly ComparedCell<CivilDate>[] }
  | { readonly unit: 'rate'; readonly key: RateLineKey; readonly cells: readonly ComparedCell<YearlyRate>[] }

export interface ComparedScenarios {
  /** In the order of their slots. */
  readonly scenarios: readonly ComparedScenario[]
  readonly base: ComparedScenario | null
  readonly lines: readonly ComparedLine[]
}

type Better = 'lower' | 'higher' | 'none'

/** How a line finds its best figure and its differences to the base. */
interface LineRule<Figure> {
  readonly better: Better
  /** False where a tick would mislead. */
  readonly ticks?: boolean
  /** False where the figure is itself the difference to the base. */
  readonly differences?: boolean
  readonly pick: (scenario: ComparedScenario) => Figure | null
  readonly estimate?: (outcome: ScenarioOutcome) => boolean
  /** How far the figure is above the other, in its own unit, which decides the best and the difference. */
  readonly above: (figure: Figure, other: Figure) => number
}

function amountAbove(figure: number, other: number): number {
  return figure - other
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

function cellsOf<Figure>(rule: LineRule<Figure>, scenarios: readonly ComparedScenario[], base: ComparedScenario | null): ComparedCell<Figure>[] {
  const figures = scenarios.map((scenario) => rule.pick(scenario))
  const held = figures.filter((figure) => figure !== null)
  const direction = rule.better === 'higher' ? -1 : 1
  const lowest = held.reduce<Figure | null>((least, figure) => (least === null || direction * rule.above(figure, least) < 0 ? figure : least), null)
  const single = lowest !== null && held.filter((figure) => rule.above(figure, lowest) === 0).length === 1 && held.length > 1
  const baseFigure = base === null ? null : rule.pick(base)
  return scenarios.map((scenario, index) => {
    const figure = figures[index] ?? null
    return {
      scenario,
      figure,
      best: rule.ticks !== false && rule.better !== 'none' && single && figure !== null && rule.above(figure, lowest) === 0,
      estimate: figure !== null && rule.estimate !== undefined && rule.estimate(scenario.outcome),
      aboveBase: figure === null || baseFigure === null || scenario === base || rule.differences === false ? 0 : rule.above(figure, baseFigure),
    }
  })
}

/**
 * The compared offers side by side in the order of their slots. The monthly instalment leads, then
 * interest, what you pay in all and the payoff. Extra you put in, costs, what the subsidy pays, Kuna's
 * EKS, the bank's EKS and what each leaves you ahead at a savings rate follow, each only where a column
 * has a figure. Each line marks the one best figure when a single offer holds it, lower or earlier being
 * better, and gives every other column its difference to the base. Extra you put in and what the subsidy
 * pays have no better way. Offers of different numbers of instalments get no tick on interest or the
 * total, since a shorter loan always pays less interest. Annuity and equal principal offers together get
 * no tick on the instalment, since an equal principal instalment starts higher and falls.
 */
export function comparedScenarios(compared: readonly ComparedScenario[], base: string): ComparedScenarios {
  const scenarios = [...compared].sort((first, second) => first.slot - second.slot)
  const baseScenario = scenarios.find((scenario) => scenario.key === base) ?? null
  const termTicks = new Set(scenarios.map((scenario) => scenario.outcome.instalments)).size <= 1
  const instalmentTicks = new Set(scenarios.map((scenario) => scenario.repayment)).size <= 1

  const moneyLine = (key: MoneyLineKey, better: Better, pick: LineRule<Money>['pick'], more: Partial<LineRule<Money>> = {}): ComparedLine => ({
    unit: 'money',
    key,
    cells: cellsOf({ better, pick, above: amountAbove, ...more }, scenarios, baseScenario),
  })
  const rateLine = (key: RateLineKey, better: Better, pick: LineRule<YearlyRate>['pick']): ComparedLine => ({
    unit: 'rate',
    key,
    cells: cellsOf({ better, pick, above: amountAbove }, scenarios, baseScenario),
  })
  const heldAtNothing = (line: ComparedLine): boolean => line.cells.every((cell) => (cell.figure ?? 0) === 0)

  return {
    scenarios,
    base: baseScenario,
    lines: [
      moneyLine('instalment', 'lower', ({ outcome }) => outcome.nextInstalment, { ticks: instalmentTicks, estimate: (outcome) => outcome.variableFrom !== null }),
      moneyLine('interest', 'lower', ({ outcome }) => outcome.interest, { ticks: termTicks }),
      moneyLine('total', 'lower', ({ outcome }) => outcome.total, { ticks: termTicks }),
      { unit: 'month', key: 'payoff', cells: cellsOf({ better: 'lower', pick: ({ outcome }) => outcome.payoff, above: (figure, other) => monthsLater(other, figure) }, scenarios, baseScenario) },
      ...[
        moneyLine('extra', 'none', ({ outcome }) => outcome.extra),
        moneyLine('costs', 'lower', ({ outcome }) => outcome.costs),
        moneyLine('subsidy', 'none', ({ outcome }) => outcome.subsidy),
        rateLine('eks', 'lower', (scenario) => scenario.eks ?? null),
        rateLine('bank-eks', 'none', (scenario) => scenario.bankEks ?? null),
        moneyLine('left-over', 'higher', (scenario) => scenario.leftOver ?? null, { differences: false }),
      ].filter((line) => !heldAtNothing(line)),
    ],
  }
}

/** A worked-out scenario and the slot it holds. */
interface InSlot {
  readonly worked: WorkedScenario
  readonly slot: number
}

/** The compared offers Kuna can work out, each with what it leaves you ahead of the base at the savings rate when one is typed in. */
export function comparedOffers(compared: readonly InSlot[], base: string, savings: YearlyRate | null): ComparedScenario[] {
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
  return workedOut.map((entry, index) => ({
    key: entry.worked.key,
    name: entry.worked.name,
    slot: entry.slot,
    outcome: entry.outcome,
    repayment: entry.plan.loan.repayment,
    eks: entry.worked.eks,
    bankEks: entry.worked.kept?.scenario.start.kind === 'offer' ? entry.worked.kept.scenario.start.terms.bankEks : null,
    leftOver: ahead?.[index] ?? null,
  }))
}

/** The earliest payoff among the compared scenarios, by which the left-over line counts. */
export function earliestPayoff(compared: readonly InSlot[]): CivilDate | null {
  return compared.reduce<CivilDate | null>((earliest, { worked }) => {
    const day = worked.outcome?.payoff ?? null
    return day !== null && (earliest === null || day < earliest) ? day : earliest
  }, null)
}
