import { BAR_END_RIGHT, stackGap } from '../../../../shared/charts/chartTheme'
import type { ChartTokens } from '../../../../shared/charts/chartTokens'
import { axisTooltip } from '../../../../shared/charts/chartTooltip'
import type { BarSeries, ChartOption } from '../../../../shared/charts/echarts'
import { formatPercent, formatWholeMoney } from '../../../../shared/money/moneyFormat'
import type { LegendEntry } from '../../../../shared/ui/ChartLegend.vue'
import { SEGMENT_LABELS } from './payScenariosView'
import type { ScenarioSplit, SplitSegment } from './payScenariosView'

const SEGMENTS: readonly SplitSegment[] = ['net', 'pillar-two', 'pillar-one', 'health', 'income-tax', 'rent-tax', 'dividend-tax', 'corporate-tax', 'kept']

export interface ScenarioBars {
  readonly option: ChartOption
  readonly description: string
  readonly legend: readonly LegendEntry[]
  /** False when no scenario has a profit to split, so there is nothing to draw. */
  readonly drawn: boolean
}

/**
 * A part as a share of the bar in percent, with one decimal. A part below zero draws as nothing. A
 * payout beyond the year's profit draws on earlier years, so such a bar is the sum of its parts.
 */
function shareOf(cents: number, split: ScenarioSplit): number {
  const drawn = split.parts.reduce((total, part) => total + (part.cents > 0 ? part.cents : 0), 0)
  const whole = Math.max(split.whole, drawn)
  return whole > 0 && cents > 0 ? Math.round((cents / whole) * 1000) / 10 : 0
}

/**
 * One 100% bar per scenario, splitting its profit before owner pay into what reaches the owner,
 * pillar II, each tax and contribution, and what the company keeps. The eight categorical slots go
 * to the owner's and the state's parts in a fixed order, and what is kept wears the recessive grey.
 * A narrow chart cuts the scenario names short, and the tooltip and table give them whole.
 */
export function scenarioBars(splits: readonly ScenarioSplit[], tokens: ChartTokens, narrow: boolean): ScenarioBars {
  const colourOf = (segment: SplitSegment, index: number) => (segment === 'kept' ? tokens.deemphasis : (tokens.series[index] ?? tokens.ink))
  const shown = SEGMENTS.filter((segment) => splits.some((split) => split.parts.some((part) => part.segment === segment && shareOf(part.cents, split) > 0)))
  const lastShown = (split: ScenarioSplit) => shown.filter((segment) => shareOf(split.parts.find((part) => part.segment === segment)?.cents ?? 0, split) > 0).at(-1)
  const series: BarSeries[] = shown.map((segment) => ({
    type: 'bar',
    name: SEGMENT_LABELS[segment],
    stack: 'split',
    color: colourOf(segment, SEGMENTS.indexOf(segment)),
    itemStyle: stackGap(tokens),
    barMaxWidth: 28,
    data: splits.map((split) => ({
      value: shareOf(split.parts.find((part) => part.segment === segment)?.cents ?? 0, split),
      itemStyle: { borderRadius: lastShown(split) === segment ? BAR_END_RIGHT : 0 },
    })),
  }))
  const option: ChartOption = {
    grid: { top: 8, right: 16, left: 8, containLabel: true },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: axisTooltip({ tokens, formatAmount: (share) => formatPercent(share / 100) }),
    },
    xAxis: { type: 'value', max: 100, axisLabel: { color: tokens.inkMuted, fontSize: 11, formatter: (share: number) => formatPercent(share / 100) } },
    yAxis: { type: 'category', inverse: true, data: splits.map((split) => split.label), axisLabel: { color: tokens.inkSecondary, width: narrow ? 88 : 140, overflow: narrow ? 'truncate' : 'break' } },
    series,
  }
  const description = splits
    .map(
      (split) =>
        `${split.label}, of ${formatWholeMoney(split.whole)} profit before owner pay: ` +
        split.parts
          .filter((part) => shareOf(part.cents, split) > 0)
          .map((part) => `${SEGMENT_LABELS[part.segment].toLowerCase()} ${formatPercent(shareOf(part.cents, split) / 100)}`)
          .join(', '),
    )
    .join('. ')
  return {
    option,
    description: `${description}.`,
    legend: shown.map((segment) => ({ label: SEGMENT_LABELS[segment], colour: colourOf(segment, SEGMENTS.indexOf(segment)) })),
    drawn: splits.some((split) => split.whole > 0),
  }
}
