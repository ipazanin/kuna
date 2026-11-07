import type { Underwater } from '../domain/underwater'
import { words } from './words'
import { tokenColour } from '../../../../shared/charts/chartTokens'
import type { ChartTokens } from '../../../../shared/charts/chartTokens'
import { axisTooltip } from '../../../../shared/charts/chartTooltip'
import { dayAxisLabels, dayOfCategory } from '../../../../shared/charts/dayAxis'
import type { ChartOption, LineSeries } from '../../../../shared/charts/echarts'
import { shownPoints } from '../../../../shared/charts/monthAxis'
import { formatPercent } from '../../../../shared/money/moneyFormat'
import { shareFromRatio } from '../../../../shared/money/percent'
import { formatChartChange } from '../../compare/presentation/comparedSeries'

export interface UnderwaterChart {
  readonly option: ChartOption
  readonly description: string
}

/** Each point's fall below the running peak as a line filled down from zero, in the portfolio's colour. */
export function underwaterChart(below: Underwater, tokens: ChartTokens, phone: boolean): UnderwaterChart {
  const dates = below.points.map((point) => point.date)
  const colour = tokenColour('--invest-portfolio')
  const line: LineSeries = {
    type: 'line',
    name: words.falls.below,
    color: colour,
    showSymbol: false,
    lineStyle: { width: 2 },
    areaStyle: { color: colour, opacity: 0.22 },
    data: below.points.map((point) => point.below),
  }
  return {
    option: {
      grid: { top: 16, right: 16 },
      tooltip: {
        trigger: 'axis',
        formatter: (points: unknown) => axisTooltip({ tokens, categoryLabel: dayOfCategory, formatAmount: formatChartChange })(shownPoints(points)),
      },
      xAxis: { type: 'category', boundaryGap: false, data: dates, axisLabel: dayAxisLabels(dates, tokens, phone) },
      yAxis: { type: 'value', max: 0, axisLabel: { color: tokens.inkMuted, formatter: (share: number) => formatPercent(shareFromRatio(share)) } },
      series: [line],
    },
    description: below.deepest === 0 ? words.falls.neverFellDescription : words.falls.description(formatPercent(below.deepest, 'magnitude'), formatPercent(below.now, 'magnitude')),
  }
}
