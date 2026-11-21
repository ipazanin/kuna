import type { CategoryMonth } from '../domain/categoryMonths'
import { words } from './words'
import type { MonthKey } from '../../../../shared/calendar/monthKey'
import { monthAxisLabel, monthLabel } from '../../../../shared/calendar/monthLabel'
import { markIncomplete, moneyAxisLabel } from '../../../../shared/charts/chartTheme'
import { tokenColour } from '../../../../shared/charts/chartTokens'
import type { ChartTokens } from '../../../../shared/charts/chartTokens'
import { axisTooltip } from '../../../../shared/charts/chartTooltip'
import { shownPoints } from '../../../../shared/charts/monthAxis'
import type { BarSeries, ChartOption } from '../../../../shared/charts/echarts'
import type { Money } from '../../../../shared/money/money'
import { formatChartMoney, formatMoney } from '../../../../shared/money/moneyFormat'
import type { LegendEntry } from '../../../../shared/ui/ChartLegend.vue'

export interface CategoryMonthsChart {
  readonly option: ChartOption
  readonly description: string
  readonly legend: readonly LegendEntry[]
}

/** One bar a month in the colour the token names, the month still filling hatched, and the average month as a dashed line across them. */
export function categoryMonthsChart(months: readonly CategoryMonth[], name: string, colourToken: string, average: Money | null, current: MonthKey, tokens: ChartTokens): CategoryMonthsChart {
  const bars: BarSeries = {
    type: 'bar',
    name,
    color: tokenColour(colourToken),
    data: markIncomplete(
      months.map((month) => month.counted),
      months.map((month) => month.month === current),
      tokens,
    ),
    ...(average === null
      ? {}
      : {
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { color: tokens.ink, type: 'dashed', width: 1.5 },
            label: { show: false },
            data: [{ yAxis: average }],
          },
        }),
  }
  const first = months[0]
  const last = months.at(-1)
  return {
    option: {
      grid: { top: 16 },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (points: unknown) =>
          axisTooltip({
            tokens,
            incompleteCategories: [current],
            categoryLabel: monthAxisLabel('long'),
            footnotes: () => (average === null ? [] : [`${words.analysis.overTime.average}: ${formatChartMoney(average)}`]),
          })(shownPoints(points)),
      },
      xAxis: { type: 'category', data: months.map((month) => month.month), axisLabel: { color: tokens.inkMuted, formatter: monthAxisLabel('short') } },
      yAxis: { type: 'value', axisLabel: moneyAxisLabel(tokens) },
      series: [bars],
    },
    description:
      first === undefined || last === undefined
        ? ''
        : [
            words.analysis.overTime.describe(name, monthLabel(first.month), monthLabel(last.month)),
            ...(average === null ? [] : [words.analysis.overTime.describeAverage(formatMoney(average))]),
            ...(last.month === current ? [words.groups.running(monthLabel(current))] : []),
          ].join(' '),
    legend: [{ label: name, colour: `var(${colourToken})` }, ...(average === null ? [] : [{ label: words.analysis.overTime.average, colour: 'var(--chart-ink)', mark: 'line' as const }])],
  }
}
