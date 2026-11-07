import type { ScenarioMonth } from './scenarioMonths'
import { words } from './words'
import { yearStep } from '../../../../shared/charts/monthAxis'
import { words as balanceWords } from '../../balances/presentation/words'
import { monthAxisLabel, monthLabel } from '../../../../shared/calendar/monthLabel'
import type { DateRange } from '../../../../shared/calendar/dateRange'
import { monthsFrom, yearOfMonth } from '../../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../../shared/calendar/monthKey'
import { monthInRange, wholeMonthsSpan } from '../../../../shared/charts/chartRange'
import { moneyAxisLabel } from '../../../../shared/charts/chartTheme'
import { tokenColour } from '../../../../shared/charts/chartTokens'
import type { ChartTokens } from '../../../../shared/charts/chartTokens'
import { axisTooltip } from '../../../../shared/charts/chartTooltip'
import type { ChartOption, LineSeries } from '../../../../shared/charts/echarts'
import { formatCompactMoney, formatMoney } from '../../../../shared/money/moneyFormat'
import { ZERO } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'

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

/** The span both charts can show, from the first month any scenario covers to the last, null with no scenario charted. */
export function scenarioChartSpan(scenarios: readonly ChartedScenario[]): DateRange | null {
  const months = monthsOfAll(scenarios)
  const [first] = months
  const last = months.at(-1)
  return first === undefined || last === undefined ? null : wholeMonthsSpan(first, last)
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

/** A dashed hairline at the first variable month while the chart shows it, on a wide screen only, since a phone notes it under the chart. */
function variableRule(scenarios: readonly ChartedScenario[], months: readonly MonthKey[], tokens: ChartTokens, phone: boolean): Pick<LineSeries, 'markLine'> {
  const variable = earliestVariable(scenarios)
  if (phone || variable === null || !months.includes(variable)) return {}
  return { markLine: { silent: true, symbol: 'none', lineStyle: { color: tokens.axis, type: 'dashed', width: 1 }, label: { show: false }, data: [{ xAxis: variable }] } }
}

/**
 * What each scenario owes at each month end in the range, one line each. Its letter sits where it is paid off
 * while the range shows that month, and scenarios paid off in the same month share one label, such as "B C".
 * The description gives every payoff month, in the range or not.
 */
export function scenarioBalanceChart(scenarios: readonly ChartedScenario[], base: string, tokens: ChartTokens, phone: boolean, shownDays: DateRange | null): ScenarioChart {
  const months = monthsOfAll(scenarios).filter((month) => monthInRange(shownDays, month))
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
      ...(index === 0 ? variableRule(scenarios, months, tokens, phone) : {}),
      markPoint: {
        silent: true,
        symbolSize: 0,
        label: { show: true, position: 'top', color: tokens.ink, fontSize: 12, fontWeight: 600 },
        data:
          last === undefined || sharing[0] !== scenario || !months.includes(last.month)
            ? []
            : [{ name: sharing.map((held) => held.letter).join(' '), coord: [last.month, last.owed], label: { formatter: sharing.map((held) => held.letter).join(' ') } }],
      },
    }
  })
  const entries = scenarios.flatMap((scenario) => scenario.months.slice(-1).map((last) => words.charts.owedEntry(scenario.letter, scenario.name, monthLabel(last.month))))
  return { option: { ...frame(months, scenarios, tokens, phone, 16), series }, description: words.charts.owedDescription(entries.join(' ')) }
}

/**
 * The interest you pay, added up month by month, one line each, over the months in the range. A line holds
 * its total from its payoff to the right edge, where its letter and what it has come to by then sit, pushed
 * apart when two are close. Over the whole span that is its total, which the description always gives.
 */
export function scenarioInterestChart(scenarios: readonly ChartedScenario[], base: string, tokens: ChartTokens, phone: boolean, shownDays: DateRange | null): ScenarioChart {
  const months = monthsOfAll(scenarios).filter((month) => monthInRange(shownDays, month))
  const edge = months.at(-1)
  const totals = new Map(scenarios.map((scenario) => [scenario.key, scenario.months.at(-1)?.interest ?? ZERO]))
  const interestBy = new Map(scenarios.map((scenario) => [scenario.key, new Map(scenario.months.map((entry) => [entry.month, entry.interest]))]))
  const interestOn = (scenario: ChartedScenario, month: MonthKey): Money | null => {
    const first = scenario.months[0]?.month
    return first === undefined || month < first ? null : (interestBy.get(scenario.key)!.get(month) ?? totals.get(scenario.key)!)
  }
  const atEdge = new Map(
    scenarios.flatMap((scenario) => {
      const reached = edge === undefined ? null : interestOn(scenario, edge)
      return reached === null ? [] : [[scenario.key, reached] as const]
    }),
  )
  const tallest = Math.max(0, ...atEdge.values())
  const labelAt = new Map<string, number>()
  for (const [key, reached] of [...atEdge].sort((first, second) => second[1] - first[1])) {
    const below = [...labelAt.values()].at(-1)
    labelAt.set(key, below === undefined ? reached : Math.min(reached, below - LABEL_GAP * tallest))
  }
  const series = drawingOrder(scenarios, base).map((scenario, index): LineSeries => {
    const reached = atEdge.get(scenario.key)
    return {
      ...lineOf(
        scenario,
        months.map((month) => interestOn(scenario, month)),
      ),
      ...(index === 0 ? variableRule(scenarios, months, tokens, phone) : {}),
      markPoint: {
        silent: true,
        symbolSize: 0,
        label: { show: true, position: 'right', color: tokens.ink, fontSize: 12 },
        data:
          edge === undefined || reached === undefined
            ? []
            : [{ name: scenario.letter, coord: [edge, labelAt.get(scenario.key)!], label: { formatter: `${scenario.letter} ${formatCompactMoney(reached)}` } }],
      },
    }
  })
  const entries = scenarios.map((scenario) => words.charts.interestEntry(scenario.letter, scenario.name, formatMoney(totals.get(scenario.key)!)))
  return { option: { ...frame(months, scenarios, tokens, phone, 88), series }, description: words.charts.interestDescription(entries.join(' ')) }
}
