import { keptOver } from '../domain/keptMoney'
import type { KeptMonth } from '../domain/keptMoney'
import { words } from './words'
import type { MonthKey } from '../../../../shared/calendar/monthKey'
import { monthAxisLabel, monthLabel } from '../../../../shared/calendar/monthLabel'
import { markIncomplete, moneyAxisLabel, stackGap } from '../../../../shared/charts/chartTheme'
import { tokenColour } from '../../../../shared/charts/chartTokens'
import type { ChartTokens } from '../../../../shared/charts/chartTokens'
import { axisTooltip } from '../../../../shared/charts/chartTooltip'
import { shownPoints } from '../../../../shared/charts/monthAxis'
import type { BarSeries, ChartOption } from '../../../../shared/charts/echarts'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import type { LegendEntry } from '../../../../shared/ui/ChartLegend.vue'

export interface KeptMoneyChart {
  readonly option: ChartOption
  readonly description: string
  readonly legend: readonly LegendEntry[]
}

type KeptPart = 'investments' | 'loanPrincipal' | 'assets' | 'rest'

/**
 * Each part keeps one colour however many of the others show. Investments wear the colour Money in and out gives money saved to
 * investments, and a loan's principal its colour on every loan chart. The other two take hues that chart leaves free.
 */
const PARTS: readonly { readonly part: KeptPart; readonly token: string }[] = [
  { part: 'investments', token: '--accent' },
  { part: 'loanPrincipal', token: '--loan-principal' },
  { part: 'assets', token: '--series-3' },
  { part: 'rest', token: '--series-7' },
]

/**
 * One stacked bar a month of what was kept, income less spending, split into what went to investments, to a bank loan's
 * principal, into things bought and what was left in the accounts. A month that spent more than it took in has a rest below zero.
 * A part with nothing in any month is left out, and the month still filling is hatched.
 */
export function keptMoneyChart(months: readonly KeptMonth[], current: MonthKey, tokens: ChartTokens): KeptMoneyChart {
  const shown = PARTS.filter(({ part }) => months.some((month) => month[part] !== 0))
  const incomplete = months.map((month) => month.month === current)
  const series = shown.map(({ part, token }): BarSeries => ({
    type: 'bar',
    name: words.analysis.savings.parts[part],
    stack: 'kept',
    color: tokenColour(token),
    itemStyle: { ...stackGap(tokens), borderRadius: 0 },
    data: markIncomplete(
      months.map((month) => month[part]),
      incomplete,
      tokens,
    ),
  }))
  const first = months[0]
  const last = months.at(-1)
  const together = keptOver(months)
  const partsText = shown.map(({ part }) => `${words.analysis.savings.parts[part]} ${formatMoney(together[part])}`).join(', ')
  return {
    option: {
      grid: { top: 16 },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (points: unknown) => axisTooltip({ tokens, incompleteCategories: [current], categoryLabel: monthAxisLabel('long') })(shownPoints(points)),
      },
      xAxis: { type: 'category', data: months.map((month) => month.month), axisLabel: { color: tokens.inkMuted, formatter: monthAxisLabel('short') } },
      yAxis: { type: 'value', axisLabel: moneyAxisLabel(tokens) },
      series,
    },
    description: first === undefined || last === undefined ? '' : words.analysis.savings.describeWent(monthLabel(first.month), monthLabel(last.month), partsText),
    legend: shown.map(({ part, token }) => ({ label: words.analysis.savings.parts[part], colour: `var(${token})` })),
  }
}
