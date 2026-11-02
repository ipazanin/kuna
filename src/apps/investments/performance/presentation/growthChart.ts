import { GROWTH_START } from '../domain/portfolioPerformance'
import type { GrowthPoint } from '../domain/portfolioPerformance'
import { words } from './words'
import { percentChange } from '../../compare/domain/comparedLine'
import type { ComparedLine } from '../../compare/domain/comparedLine'
import { changeAxisLabel, comparedSeries } from '../../compare/presentation/comparedSeries'
import { words as compareWords } from '../../compare/presentation/words'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { moneyAxisLabel } from '../../../../shared/charts/chartTheme'
import { tokenColour } from '../../../../shared/charts/chartTokens'
import type { ChartTokens } from '../../../../shared/charts/chartTokens'
import { axisTooltip } from '../../../../shared/charts/chartTooltip'
import { dayAxisLabels, dayOfCategory } from '../../../../shared/charts/dayAxis'
import type { ChartOption, LineSeries } from '../../../../shared/charts/echarts'
import { shownPoints } from '../../../../shared/charts/monthAxis'
import { formatMoney, formatPercentChange } from '../../../../shared/money/moneyFormat'

export interface GrowthChart {
  readonly option: ChartOption
  readonly description: string
  readonly title: string
  readonly subtitle: string
  /** How the table view writes a point: euros of the €100, or with a comparison on, the change since the first day. */
  readonly formatValue: (value: number) => string
}

/**
 * €100 grown at the portfolio's time-weighted return as a blue line, against the benchmark's own price as a dashed grey
 * one on the same axis. With a ticker compared, the portfolio and the ticker instead, both as change since the first
 * day. A canvas takes plain numbers, so each point becomes cents only for drawing.
 */
export function growthChart(growth: readonly GrowthPoint[], benchmarkName: string | null, tokens: ChartTokens, phone: boolean, compared: ComparedLine | null = null): GrowthChart {
  const dates = growth.map((point) => point.date)
  const first = growth[0]
  const last = growth.at(-1)
  const xAxis = { type: 'category' as const, boundaryGap: false, data: dates, axisLabel: dayAxisLabels(dates, tokens, phone) }
  const portfolioLine = (data: readonly number[]): LineSeries => ({
    type: 'line',
    name: words.growth.portfolio,
    color: tokenColour('--invest-portfolio'),
    showSymbol: false,
    lineStyle: { width: 2 },
    data: [...data],
  })
  if (compared !== null && first !== undefined && last !== undefined) {
    const change = percentChange(growth.map((point) => point.portfolio))
    return {
      option: {
        grid: { top: 24, right: 16 },
        tooltip: { trigger: 'axis', formatter: (points: unknown) => axisTooltip({ tokens, categoryLabel: dayOfCategory, formatAmount: formatPercentChange })(shownPoints(points)) },
        xAxis,
        yAxis: { type: 'value', scale: true, axisLabel: changeAxisLabel(tokens) },
        series: [portfolioLine(change), comparedSeries(compared)],
      },
      description: compareWords.chartDescription(
        dayLabel(first.date),
        dayLabel(last.date),
        words.growth.portfolioInSentence,
        formatPercentChange(change.at(-1) ?? 0),
        compared.name,
        formatPercentChange(compared.change.at(-1) ?? 0),
      ),
      title: compareWords.since(dayLabel(first.date)),
      subtitle: compareWords.inEuros(compared.name),
      formatValue: formatPercentChange,
    }
  }
  const cents = (grown: number): number => Math.round(grown * 100)
  const hasBenchmark = benchmarkName !== null && growth.every((point) => point.benchmark !== null)
  const benchmark: LineSeries[] = hasBenchmark
    ? [
        {
          type: 'line',
          name: benchmarkName,
          color: tokenColour('--invest-reference'),
          showSymbol: false,
          lineStyle: { width: 2, type: [5, 4] },
          data: growth.map((point) => cents(point.benchmark!)),
        },
      ]
    : []
  const start = formatMoney(cents(GROWTH_START))
  return {
    option: {
      grid: { top: 24, right: 16 },
      tooltip: {
        trigger: 'axis',
        formatter: (points: unknown) => axisTooltip({ tokens, categoryLabel: dayOfCategory, formatAmount: (amount) => formatMoney(amount) })(shownPoints(points)),
      },
      xAxis,
      yAxis: { type: 'value', scale: true, minInterval: 100, axisLabel: moneyAxisLabel(tokens) },
      series: [portfolioLine(growth.map((point) => cents(point.portfolio))), ...benchmark],
    },
    description:
      first === undefined || last === undefined
        ? words.growth.emptyDescription
        : words.growth.description(start, dayLabel(first.date), dayLabel(last.date), formatMoney(cents(last.portfolio))) +
          (hasBenchmark && last.benchmark !== null ? words.growth.benchmarkLine(benchmarkName, formatMoney(cents(last.benchmark))) : ''),
    title: words.growth.title(start),
    subtitle: words.growth.subtitle,
    formatValue: (value) => formatMoney(value),
  }
}
