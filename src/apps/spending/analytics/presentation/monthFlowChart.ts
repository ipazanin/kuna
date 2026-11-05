import type { MonthFlow } from '../domain/monthFlow'
import { words } from './words'
import type { MonthKey } from '../../../../shared/calendar/monthKey'
import { monthAxisLabel, monthLabel } from '../../../../shared/calendar/monthLabel'
import { markIncomplete, moneyAxisLabel } from '../../../../shared/charts/chartTheme'
import type { ChartTokens } from '../../../../shared/charts/chartTokens'
import { axisTooltip } from '../../../../shared/charts/chartTooltip'
import { shownPoints } from '../../../../shared/charts/monthAxis'
import type { BarSeries, ChartOption, LineSeries } from '../../../../shared/charts/echarts'
import type { Money } from '../../../../shared/money/money'
import { formatMoney, formatPercent, formatShare } from '../../../../shared/money/moneyFormat'
import type { LegendEntry } from '../../../../shared/ui/ChartLegend.vue'

/** The chart's figures as a table, since a savings rate does not read as money. */
export interface MonthFlowTable {
  readonly columns: readonly string[]
  readonly rows: readonly { readonly month: MonthKey; readonly label: string; readonly cells: readonly string[] }[]
}

export interface MonthFlowChart {
  readonly option: ChartOption
  readonly description: string
  readonly legend: readonly LegendEntry[]
  readonly table: MonthFlowTable
}

interface Measure {
  readonly name: string
  readonly colour: string
  readonly legendColour: string
  readonly amountOf: (month: MonthFlow) => Money
}

/**
 * Income, spending and saved as three bars a month, with the savings rate as a line on its own axis. The month still
 * filling is hatched. A month with no income has no rate, so the line breaks there.
 */
export function monthFlowChart(months: readonly MonthFlow[], current: MonthKey, tokens: ChartTokens): MonthFlowChart {
  const measures: readonly Measure[] = [
    { name: words.income, colour: tokens.positive, legendColour: 'var(--tone-positive)', amountOf: (month) => month.income },
    { name: words.spent, colour: tokens.inkMuted, legendColour: 'var(--chart-ink-muted)', amountOf: (month) => month.spent },
    { name: words.saved, colour: tokens.accent, legendColour: 'var(--accent)', amountOf: (month) => month.saved },
  ]
  const incomplete = months.map((month) => month.month === current)
  const bars = measures.map((measure): BarSeries => ({
    type: 'bar',
    name: measure.name,
    color: measure.colour,
    data: markIncomplete(months.map(measure.amountOf), incomplete, tokens),
  }))
  const rate: LineSeries = {
    type: 'line',
    name: words.savingsRate,
    yAxisIndex: 1,
    color: tokens.ink,
    showSymbol: true,
    symbolSize: 6,
    connectNulls: false,
    data: months.map((month) => month.savingsRate),
    z: 4,
  }
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
            formatAmount: (amount, seriesName) => (seriesName === words.savingsRate ? formatShare(amount) : formatMoney(amount)),
          })(shownPoints(points)),
      },
      xAxis: { type: 'category', data: months.map((month) => month.month), axisLabel: { color: tokens.inkMuted, formatter: monthAxisLabel('short') } },
      yAxis: [
        { type: 'value', axisLabel: moneyAxisLabel(tokens) },
        { type: 'value', splitLine: { show: false }, axisLabel: { color: tokens.inkMuted, fontSize: 11, formatter: (fraction: number) => formatPercent(fraction) } },
      ],
      series: [...bars, rate],
    },
    description: describe(months, current),
    legend: [...measures.map((measure) => ({ label: measure.name, colour: measure.legendColour })), { label: words.savingsRate, colour: 'var(--chart-ink)', mark: 'line' as const }],
    table: {
      columns: [...measures.map((measure) => measure.name), words.savingsRate],
      rows: months.map((month) => ({
        month: month.month,
        label: monthLabel(month.month),
        cells: [...measures.map((measure) => formatMoney(measure.amountOf(month))), month.savingsRate === null ? '–' : formatShare(month.savingsRate)],
      })),
    },
  }
}

function describe(months: readonly MonthFlow[], current: MonthKey): string {
  const first = months[0]
  const last = months.at(-1)
  if (first === undefined || last === undefined) return ''
  const shown = monthLabel(last.month)
  return [
    words.flow.span(monthLabel(first.month), shown),
    words.flow.month(shown, formatMoney(last.income), formatMoney(last.spent), formatMoney(last.saved)),
    last.savingsRate === null ? words.flow.noRate : words.flow.rate(formatShare(last.savingsRate)),
    ...(last.month === current ? [words.flow.running(shown)] : []),
  ].join(' ')
}
