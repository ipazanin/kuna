import { monthAxisLabel, monthLabel } from '../../../../shared/calendar/monthLabel'
import { parseMonthKey } from '../../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../../shared/calendar/monthKey'
import { BAR_END_DOWN, BAR_END_UP, markIncomplete, moneyAxisLabel } from '../../../../shared/charts/chartTheme'
import type { ChartTokens } from '../../../../shared/charts/chartTokens'
import { axisTooltip } from '../../../../shared/charts/chartTooltip'
import type { BarSeries, ChartOption, LineSeries } from '../../../../shared/charts/echarts'
import { sumMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import { formatWholeMoney } from '../../../../shared/money/moneyFormat'
import type { LegendEntry } from '../../../../shared/ui/ChartLegend.vue'
import type { DrillTarget } from '../../../../features/filters/domain/drillTarget'
import type { DrillChart } from '../../../../features/filters/presentation/chartDrill'

/** One month of the forecast as the chart draws it. Costs read positive and are drawn below zero. */
export interface ForecastChartMonth {
  readonly month: MonthKey
  readonly income: Money
  readonly costs: Money
  readonly profit: Money
  /** Whether a plan row or an average stands in for part of the figure, which hatches its bar. */
  readonly incomeForecast: boolean
  readonly costsForecast: boolean
  /** What the month rests on, such as "from the ledger" or "planned and averaged", for the tooltip. */
  readonly basis: string
  readonly incomeRows: DrillTarget | null
  readonly costsRows: DrillTarget | null
}

const INCOME = 'Income'
const COSTS = 'Costs'
const PROFIT = 'Profit before tax'

export interface ForecastChart extends DrillChart {
  readonly legend: readonly LegendEntry[]
}

/**
 * Income above zero and costs below it, one slot per month, with profit before tax as a line.
 * A bar a plan row or an average stands in for is hatched, and a shaded band marks the running month.
 */
export function forecastChart(months: readonly ForecastChartMonth[], running: MonthKey | null, tokens: ChartTokens): ForecastChart {
  const bars: BarSeries[] = [
    {
      type: 'bar',
      name: INCOME,
      stack: 'income',
      color: tokens.buckets.income,
      barGap: '-100%',
      itemStyle: { borderRadius: BAR_END_UP },
      ...(running === null
        ? {}
        : {
            markArea: {
              silent: true,
              itemStyle: { color: tokens.ghost },
              label: { show: true, position: 'insideTop', formatter: 'Running', color: tokens.inkMuted, fontSize: 11 },
              data: [[{ xAxis: running }, { xAxis: running }]],
            },
          }),
      data: markIncomplete(
        months.map((month) => month.income),
        months.map((month) => month.incomeForecast),
        tokens,
      ),
    },
    {
      type: 'bar',
      name: COSTS,
      stack: 'costs',
      color: tokens.buckets.operating,
      itemStyle: { borderRadius: BAR_END_DOWN },
      data: markIncomplete(
        months.map((month) => -month.costs),
        months.map((month) => month.costsForecast),
        tokens,
      ),
    },
  ]
  const profit: LineSeries = {
    type: 'line',
    name: PROFIT,
    color: tokens.ink,
    showSymbol: true,
    symbolSize: 6,
    data: months.map((month) => month.profit),
    z: 4,
  }
  const basisOf = new Map(months.map((month) => [month.month as string, month.basis]))
  const option: ChartOption = {
    grid: { top: 16 },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: axisTooltip({
        tokens,
        categoryLabel: (category) => {
          const month = parseMonthKey(category)
          if (month === null) {
            return category
          }
          return [monthLabel(month), month === running ? 'running' : null, basisOf.get(category) ?? null].filter((part) => part !== null).join(', ')
        },
        formatAmount: (amount, seriesName) => formatWholeMoney(amount, seriesName === PROFIT ? 'negative' : 'magnitude'),
      }),
    },
    xAxis: {
      type: 'category',
      data: months.map((month) => month.month),
      axisLabel: { color: tokens.inkMuted, formatter: monthAxisLabel('short') },
      axisLine: { onZero: true, lineStyle: { color: tokens.axis } },
    },
    yAxis: { type: 'value', axisLabel: moneyAxisLabel(tokens) },
    series: [...bars, profit],
  }
  return {
    option,
    description: describe(months, running),
    legend: [
      { label: INCOME, colour: 'var(--bucket-income)' },
      { label: COSTS, colour: 'var(--bucket-operating)' },
      { label: PROFIT, colour: 'var(--chart-ink)', mark: 'line' },
      { label: 'Planned or averaged', colour: 'var(--chart-deemphasis)', mark: 'hatched' },
      ...(running === null ? [] : [{ label: `Running month, ${monthLabel(running)}`, colour: 'var(--chart-ghost)', mark: 'ghost' as const }]),
    ],
    drillAt: ({ seriesName, dataIndex }) => {
      const month = months[dataIndex]
      if (month === undefined) {
        return null
      }
      if (seriesName === INCOME) return month.incomeRows
      if (seriesName === COSTS) return month.costsRows
      return null
    },
  }
}

function describe(months: readonly ForecastChartMonth[], running: MonthKey | null): string {
  const first = months[0]
  const last = months[months.length - 1]
  if (first === undefined || last === undefined) {
    return 'No months to show.'
  }
  const total = sumMoney(months.map((month) => month.profit))
  const forecast = months.filter((month) => month.incomeForecast || month.costsForecast).map((month) => monthLabel(month.month))
  return [
    `Income and costs by month from ${monthLabel(first.month)} to ${monthLabel(last.month)}, with profit before tax as a line, ${formatWholeMoney(total)} for the year.`,
    forecast.length === 0 ? 'Every month comes from the ledger.' : `A plan row or an average stands in for part of ${forecast.join(', ')}.`,
    running === null ? '' : `${monthLabel(running)} is still running and counts as forecast.`,
  ]
    .filter((sentence) => sentence !== '')
    .join(' ')
}
