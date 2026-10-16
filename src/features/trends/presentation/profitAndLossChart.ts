import { monthAxisLabel, monthLabel } from '../../../shared/calendar/monthLabel'
import { BAR_END_DOWN, BAR_END_UP, markIncomplete, moneyAxisLabel, stackGap } from '../../../shared/charts/chartTheme'
import type { ChartTokens } from '../../../shared/charts/chartTokens'
import { axisTooltip } from '../../../shared/charts/chartTooltip'
import type { BarSeries, ChartOption, LineSeries } from '../../../shared/charts/echarts'
import { formatWholeMoney } from '../../../shared/money/moneyFormat'
import type { LegendEntry } from '../../../shared/ui/ChartLegend.vue'
import type { DrillChart } from '../../filters/presentation/chartDrill'
import { shownBucketLines } from '../../settings/domain/profitAndLossLabels'
import type { Settings } from '../../settings/domain/settings'
import type { ProfitAndLossLine } from '../../workbook/domain/bucketTotals'
import type { MonthOfProfitAndLoss } from '../domain/monthlyProfitAndLoss'

export interface ProfitAndLossSeries {
  readonly name: string
  readonly line: ProfitAndLossLine
  readonly tone: 'income' | 'operating' | 'taxes' | 'owner-pay'
}

/** Income and each cost line on screen, named by the settings. */
export function profitAndLossSeries(settings: Settings): ProfitAndLossSeries[] {
  return shownBucketLines(settings).map(({ line, bucket }) => ({ name: settings.bucketLabels[bucket], line, tone: bucket }))
}

/** The legend entries of those series, in the bucket colours. */
export function profitAndLossLegend(series: readonly ProfitAndLossSeries[]): LegendEntry[] {
  return series.map((entry) => ({ label: entry.name, colour: `var(--bucket-${entry.tone})` }))
}

export interface NetLine {
  readonly name: string
  readonly amountOf: (month: MonthOfProfitAndLoss) => number | null
}

export const MONTHLY_NET: NetLine = { name: 'Net', amountOf: (month) => month.lines.net.amount }

export const ROLLING_3_NET: NetLine = { name: 'Net, 3-month average', amountOf: (month) => month.rolling3?.net ?? null }

export interface ProfitAndLossChartSettings {
  readonly series: readonly ProfitAndLossSeries[]
  readonly netLine: NetLine
  /** Series names the legend has switched off. */
  readonly hidden?: readonly string[]
  /** A zoom slider under the plot, starting on these month indexes. */
  readonly zoom?: { readonly startIndex: number; readonly endIndex: number }
}

/**
 * Income above zero and the cost buckets stacked below it, one slot per month, with a net
 * line across. Months still filling up, or opening part-way, are hatched.
 */
export function profitAndLossChart(
  months: readonly MonthOfProfitAndLoss[],
  tokens: ChartTokens,
  settings: ProfitAndLossChartSettings,
): DrillChart {
  const hidden = settings.hidden ?? []
  const incomplete = months.map((month) => !month.complete)
  const visible = settings.series.filter((series) => !hidden.includes(series.name))
  const lowestCost = [...visible].reverse().find((series) => series.line !== 'income')
  const bars: BarSeries[] = visible.map((series) => {
    const isIncome = series.line === 'income'
    const amounts = months.map((month) => (isIncome ? 1 : -1) * month.lines[series.line].amount)
    return {
      type: 'bar',
      name: series.name,
      stack: isIncome ? 'income' : 'costs',
      color: tokens.buckets[series.tone],
      ...(isIncome ? { barGap: '-100%' } : {}),
      itemStyle: { ...stackGap(tokens), borderRadius: isIncome ? BAR_END_UP : series === lowestCost ? BAR_END_DOWN : 0 },
      data: markIncomplete(amounts, incomplete, tokens),
    }
  })
  const net: LineSeries[] = hidden.includes(settings.netLine.name)
    ? []
    : [
        {
          type: 'line',
          name: settings.netLine.name,
          color: tokens.ink,
          showSymbol: true,
          symbolSize: 6,
          connectNulls: false,
          data: months.map(settings.netLine.amountOf),
          z: 4,
        },
      ]
  const zoom = settings.zoom
  const option: ChartOption = {
    grid: { top: 16, ...(zoom === undefined ? {} : { bottom: 48 }) },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: axisTooltip({
        tokens,
        incompleteCategories: months.filter((month) => !month.complete).map((month) => month.month),
        categoryLabel: monthAxisLabel('long'),
        formatAmount: (amount, seriesName) =>
          formatWholeMoney(amount, settings.series.some((series) => series.name === seriesName) ? 'magnitude' : 'negative'),
      }),
    },
    xAxis: {
      type: 'category',
      data: months.map((month) => month.month),
      axisLabel: { color: tokens.inkMuted, formatter: monthAxisLabel('short') },
      axisLine: { onZero: true, lineStyle: { color: tokens.axis } },
    },
    yAxis: { type: 'value', axisLabel: moneyAxisLabel(tokens) },
    ...(zoom === undefined
      ? {}
      : {
          dataZoom: [
            {
              type: 'slider',
              xAxisIndex: 0,
              startValue: zoom.startIndex,
              endValue: zoom.endIndex,
              realtime: false,
              height: 22,
              bottom: 8,
              brushSelect: false,
              borderColor: tokens.grid,
              backgroundColor: 'transparent',
              fillerColor: tokens.ghost,
              dataBackground: { lineStyle: { color: tokens.axis }, areaStyle: { color: tokens.grid } },
              selectedDataBackground: { lineStyle: { color: tokens.accent }, areaStyle: { color: tokens.ghost } },
              handleStyle: { color: tokens.surface, borderColor: tokens.accent },
              moveHandleStyle: { color: tokens.accent },
              textStyle: { color: tokens.inkMuted, fontSize: 11 },
              labelFormatter: (_index: number, category: string) => monthAxisLabel('short')(category),
            },
          ],
        }),
    series: [...bars, ...net],
  }
  return {
    option,
    description: describe(months, settings.netLine),
    drillAt: ({ seriesName, dataIndex }) => {
      const month = months[dataIndex]
      if (month === undefined) {
        return null
      }
      const series = settings.series.find((candidate) => candidate.name === seriesName)
      return month.lines[series?.line ?? 'net'].drill
    },
  }
}

function describe(months: readonly MonthOfProfitAndLoss[], netLine: NetLine): string {
  const first = months[0]
  const last = months[months.length - 1]
  if (first === undefined || last === undefined) {
    return 'No months to show.'
  }
  const best = months.reduce((top, month) => (month.lines.net.amount > top.lines.net.amount ? month : top), first)
  const worst = months.reduce((low, month) => (month.lines.net.amount < low.lines.net.amount ? month : low), first)
  const parts = [
    `Income and costs by month from ${monthLabel(first.month)} to ${monthLabel(last.month)}, with ${netLine.name.toLowerCase()} as a line.`,
    `Best month ${monthLabel(best.month)} with a net of ${formatWholeMoney(best.lines.net.amount)}.`,
    `Weakest month ${monthLabel(worst.month)} with a net of ${formatWholeMoney(worst.lines.net.amount)}.`,
  ]
  if (!last.complete) {
    parts.push(`${monthLabel(last.month)} is still running and is not counted in any average.`)
  }
  return parts.join(' ')
}
