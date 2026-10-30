import type { ScenarioMonth } from './scenarioMonths'
import { words } from './words'
import { yearStep } from '../../balances/presentation/balanceChart'
import { words as balanceWords } from '../../balances/presentation/words'
import { monthAxisLabel, monthLabel } from '../../../../shared/calendar/monthLabel'
import { monthsFrom, yearOfMonth } from '../../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../../shared/calendar/monthKey'
import { moneyAxisLabel } from '../../../../shared/charts/chartTheme'
import { tokenColour } from '../../../../shared/charts/chartTokens'
import type { ChartTokens } from '../../../../shared/charts/chartTokens'
import { axisTooltip } from '../../../../shared/charts/chartTooltip'
import type { ChartOption, LineSeries } from '../../../../shared/charts/echarts'
import { formatCompactMoney, formatMoney } from '../../../../shared/money/moneyFormat'

/** One compared scenario as the charts draw it. */
export interface ChartedScenario {
  readonly key: string
  readonly letter: string
  readonly name: string
  /** Its colour token, such as `--scenario-2`. */
  readonly colour: string
  readonly months: readonly ScenarioMonth[]
  /** The first month at a variable rate, or null when every instalment is fixed. */
  readonly variableFrom: MonthKey | null
}

export interface ScenarioChart {
  readonly option: ChartOption
  readonly description: string
}

/** The share of the tallest total that keeps two labels at the right edge from overlapping. */
const LABEL_GAP = 0.08

/** The base last, so its line draws over the others. */
function drawingOrder(scenarios: readonly ChartedScenario[], base: string): ChartedScenario[] {
  return [...scenarios.filter((scenario) => scenario.key !== base), ...scenarios.filter((scenario) => scenario.key === base)]
}

/** Every month any scenario covers, oldest first. */
function monthsOfAll(scenarios: readonly ChartedScenario[]): MonthKey[] {
  const firsts = scenarios.flatMap((scenario) => scenario.months.slice(0, 1).map((entry) => entry.month))
  const lasts = scenarios.flatMap((scenario) => scenario.months.slice(-1).map((entry) => entry.month))
  if (firsts.length === 0) return []
  return monthsFrom(
    firsts.reduce((earliest, month) => (month < earliest ? month : earliest)),
    lasts.reduce((latest, month) => (month > latest ? month : latest)),
  )
}

/** The axes, grid and tooltip both charts share: years on a long axis, money up the side, a note under months at a variable rate. */
function frame(months: readonly MonthKey[], scenarios: readonly ChartedScenario[], tokens: ChartTokens, phone: boolean, right: number): Pick<ChartOption, 'grid' | 'tooltip' | 'xAxis' | 'yAxis'> {
  const variable = earliestVariable(scenarios)
  const first = months[0]
  const last = months.at(-1)
  const step = first === undefined || last === undefined ? 1 : yearStep(yearOfMonth(last) - yearOfMonth(first), phone)
  return {
    grid: { top: 24, right },
    tooltip: {
      trigger: 'axis',
      formatter: axisTooltip({
        tokens,
        categoryLabel: monthAxisLabel('long'),
        formatAmount: (amount) => formatMoney(amount),
        footnotes: (month) => (variable !== null && month >= variable ? [balanceWords.estimate] : []),
      }),
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: [...months],
      axisLabel:
        months.length > 12
          ? { color: tokens.inkMuted, interval: (_index: number, month: string) => month.endsWith('-01') && Number(month.slice(0, 4)) % step === 0, formatter: (month: string) => month.slice(0, 4) }
          : { color: tokens.inkMuted, formatter: monthAxisLabel('short') },
    },
    yAxis: { type: 'value', axisLabel: moneyAxisLabel(tokens) },
  }
}

function earliestVariable(scenarios: readonly ChartedScenario[]): MonthKey | null {
  return scenarios.reduce<MonthKey | null>((earliest, scenario) => (scenario.variableFrom !== null && (earliest === null || scenario.variableFrom < earliest) ? scenario.variableFrom : earliest), null)
}

/** A 2 px line in the scenario's colour, named by its letter and name for the tooltip. */
function lineOf(scenario: ChartedScenario, data: readonly (number | null)[]): LineSeries {
  const colour = tokenColour(scenario.colour)
  return { type: 'line', name: `${scenario.letter} ${scenario.name}`, color: colour, showSymbol: false, lineStyle: { width: 2 }, data: [...data] }
}

/** A dashed hairline at the first variable month, on a wide screen only, since a phone notes it under the chart. */
function variableRule(scenarios: readonly ChartedScenario[], tokens: ChartTokens, phone: boolean): Pick<LineSeries, 'markLine'> {
  const variable = earliestVariable(scenarios)
  if (phone || variable === null) return {}
  return { markLine: { silent: true, symbol: 'none', lineStyle: { color: tokens.axis, type: 'dashed', width: 1 }, label: { show: false }, data: [{ xAxis: variable }] } }
}

/**
 * What each scenario owes at each month end, one line each. Its letter sits where it is paid off,
 * and scenarios paid off in the same month share one label, such as "B C".
 */
export function scenarioBalanceChart(scenarios: readonly ChartedScenario[], base: string, tokens: ChartTokens, phone: boolean): ScenarioChart {
  const months = monthsOfAll(scenarios)
  const ends = new Map<MonthKey, ChartedScenario[]>()
  for (const scenario of scenarios) {
    const last = scenario.months.at(-1)
    if (last !== undefined) ends.set(last.month, [...(ends.get(last.month) ?? []), scenario])
  }
  const series = drawingOrder(scenarios, base).map((scenario, index): LineSeries => {
    const owed = new Map(scenario.months.map((entry) => [entry.month, entry.owed]))
    const last = scenario.months.at(-1)
    const sharing = last === undefined ? [] : (ends.get(last.month) ?? [])
    return {
      ...lineOf(
        scenario,
        months.map((month) => owed.get(month) ?? null),
      ),
      ...(index === 0 ? variableRule(scenarios, tokens, phone) : {}),
      markPoint: {
        silent: true,
        symbolSize: 0,
        label: { show: true, position: 'top', color: tokens.ink, fontSize: 12, fontWeight: 600 },
        data:
          last === undefined || sharing[0] !== scenario
            ? []
            : [{ name: sharing.map((held) => held.letter).join(' '), coord: [last.month, last.owed], label: { formatter: sharing.map((held) => held.letter).join(' ') } }],
      },
    }
  })
  const entries = scenarios.flatMap((scenario) => scenario.months.slice(-1).map((last) => words.charts.owedEntry(scenario.letter, scenario.name, monthLabel(last.month))))
  return { option: { ...frame(months, scenarios, tokens, phone, 16), series }, description: words.charts.owedDescription(entries.join(' ')) }
}

/**
 * The interest you pay, added up month by month, one line each. A line holds its total from its
 * payoff to the right edge, where its letter and total sit, pushed apart when two totals are close.
 */
export function scenarioInterestChart(scenarios: readonly ChartedScenario[], base: string, tokens: ChartTokens, phone: boolean, fromToday: boolean): ScenarioChart {
  const months = monthsOfAll(scenarios)
  const edge = months.at(-1)
  const totals = new Map(scenarios.map((scenario) => [scenario.key, scenario.months.at(-1)?.interest ?? 0]))
  const tallest = Math.max(0, ...totals.values())
  const labelAt = new Map<string, number>()
  for (const scenario of [...scenarios].sort((first, second) => totals.get(second.key)! - totals.get(first.key)!)) {
    const below = [...labelAt.values()].at(-1)
    const total = totals.get(scenario.key)!
    labelAt.set(scenario.key, below === undefined ? total : Math.min(total, below - LABEL_GAP * tallest))
  }
  const series = drawingOrder(scenarios, base).map((scenario, index): LineSeries => {
    const interest = new Map(scenario.months.map((entry) => [entry.month, entry.interest]))
    const first = scenario.months[0]?.month
    const total = totals.get(scenario.key)!
    return {
      ...lineOf(
        scenario,
        months.map((month) => (first === undefined || month < first ? null : (interest.get(month) ?? total))),
      ),
      ...(index === 0 ? variableRule(scenarios, tokens, phone) : {}),
      markPoint: {
        silent: true,
        symbolSize: 0,
        label: { show: true, position: 'right', color: tokens.ink, fontSize: 12 },
        data: edge === undefined ? [] : [{ name: scenario.letter, coord: [edge, labelAt.get(scenario.key)!], label: { formatter: `${scenario.letter} ${formatCompactMoney(total)}` } }],
      },
    }
  })
  const entries = scenarios.map((scenario) => words.charts.interestEntry(scenario.letter, scenario.name, formatMoney(totals.get(scenario.key)!)))
  return { option: { ...frame(months, scenarios, tokens, phone, 88), series }, description: words.charts.interestDescription(fromToday, entries.join(' ')) }
}
