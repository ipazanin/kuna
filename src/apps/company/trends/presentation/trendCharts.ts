import { monthAxisLabel, monthLabel } from '../../../../shared/calendar/monthLabel'
import { incompleteBand, moneyAxisLabel } from '../../../../shared/charts/chartTheme'
import type { ChartTokens } from '../../../../shared/charts/chartTokens'
import { axisTooltip } from '../../../../shared/charts/chartTooltip'
import type { ChartOption, LineSeries } from '../../../../shared/charts/echarts'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import type { DrillChart } from '../../filters/presentation/chartDrill'
import type { MonthOfProfitAndLoss } from '../domain/monthlyProfitAndLoss'

interface TrendLine {
  readonly name: string
  readonly colour: string
  readonly amounts: readonly (number | null)[]
  readonly area?: boolean
}

/** Running total of net from the ledger's first month, drawn as a filled line. */
export function cumulativeNetChart(months: readonly MonthOfProfitAndLoss[], tokens: ChartTokens): DrillChart {
  const last = months[months.length - 1]
  return trendChart(months, tokens, [{ name: 'Cumulative net', colour: tokens.accent, amounts: months.map((month) => month.cumulativeNet), area: true }], {
    description: last === undefined ? 'No months to show.' : `Cumulative net since the ledger began, ${formatMoney(last.cumulativeNet)} by ${monthLabel(last.month)}.`,
  })
}

/** Average net over the three and the twelve months up to each month. Only complete months count. */
export function rollingNetChart(months: readonly MonthOfProfitAndLoss[], tokens: ChartTokens): DrillChart {
  const latest = [...months].reverse().find((month) => month.rolling3 !== null)
  return trendChart(
    months,
    tokens,
    [
      { name: '3-month average', colour: tokens.ink, amounts: months.map((month) => month.rolling3?.net ?? null) },
      { name: '12-month average', colour: tokens.accent, amounts: months.map((month) => month.rolling12?.net ?? null) },
    ],
    {
      description:
        latest === undefined
          ? 'Not enough complete months for a rolling average yet.'
          : `Average net per month. In ${monthLabel(latest.month)} the 3-month average was ${formatMoney(latest.rolling3?.net ?? 0)}` +
            (latest.rolling12 === null ? '.' : ` and the 12-month average ${formatMoney(latest.rolling12.net)}.`),
    },
  )
}

function trendChart(months: readonly MonthOfProfitAndLoss[], tokens: ChartTokens, lines: readonly TrendLine[], { description }: { readonly description: string }): DrillChart {
  const categories: string[] = months.map((month) => month.month)
  const incomplete = months.map((month) => !month.complete)
  const series: LineSeries[] = lines.map((line, index) => ({
    type: 'line',
    name: line.name,
    color: line.colour,
    connectNulls: false,
    showSymbol: months.length <= 18,
    ...(line.area ? { areaStyle: { color: line.colour, opacity: 0.08 } } : {}),
    data: [...line.amounts],
    ...(index === 0 ? { markArea: incompleteBand(categories, incomplete, tokens) } : {}),
  }))
  const option: ChartOption = {
    grid: { top: 16 },
    tooltip: {
      trigger: 'axis',
      formatter: axisTooltip({
        tokens,
        incompleteCategories: categories.filter((_, index) => incomplete[index]),
        categoryLabel: monthAxisLabel('long'),
        formatAmount: (amount) => formatMoney(amount),
      }),
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: categories,
      axisLabel: { color: tokens.inkMuted, formatter: monthAxisLabel('short') },
    },
    yAxis: { type: 'value', axisLabel: moneyAxisLabel(tokens) },
    series,
  }
  return { option, description, drillAt: ({ dataIndex }) => months[dataIndex]?.lines.net.drill ?? null }
}
