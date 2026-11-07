import { moneyAxisLabel } from './chartTheme'
import type { ChartTokens } from './chartTokens'
import { axisTooltip } from './chartTooltip'
import type { BarSeries, ChartOption } from './echarts'
import { formatChartMoney } from '../money/moneyFormat'
import type { ChartPointSelection } from '../ui/ChartCard.vue'
import type { LegendEntry } from '../ui/ChartLegend.vue'
import type { Money } from '../money/money'

/**
 * One bar of the bridge. A total starts at zero and the other kinds start where the bar before them ended. A step takes
 * the tone of its sign, a transfer the caller's colour and a residual grey.
 */
export interface BridgeBar<Target> {
  readonly label: string
  readonly kind: 'total' | 'step' | 'transfer' | 'residual'
  readonly amount: Money
  readonly drill: Target | null
}

/** What the legend calls each kind of bar, what the tooltip calls the amounts, and the chart in words for a screen reader. */
export interface BridgeWording<Target> {
  readonly raises: string
  readonly lowers: string
  readonly total: string
  readonly residual: string
  readonly transfer?: LegendEntry
  readonly amount: string
  readonly description: (bars: readonly BridgeBar<Target>[]) => string
}

/** A bar of a bridge that starts from a value written beside it, which has no totals. */
export type StepBar<Target> = BridgeBar<Target> & { readonly kind: Exclude<BridgeBar<Target>['kind'], 'total'> }

export interface BridgeChart<Target> {
  readonly option: ChartOption
  readonly description: string
  readonly formatValue: (value: number) => string
  drillAt(selection: ChartPointSelection): Target | null
  readonly legend: readonly LegendEntry[]
}

/**
 * A waterfall laid on its side, one row per bar so the labels read in full. The bars stack on a transparent base with
 * every sign added in order, so a step that crosses zero still spans exactly its own amount. The legend's names are
 * colours of the one series, not series of their own. A total takes the secondary ink.
 */
export function bridgeChart<Target>(bars: readonly BridgeBar<Target>[], tokens: ChartTokens, wording: BridgeWording<Target>): BridgeChart<Target>
/** Steps alone, the first starting at `from`, on a value axis that fits the bars rather than reaching to zero, for a bridge whose start and end are written beside it. */
export function bridgeChart<Target>(bars: readonly StepBar<Target>[], tokens: ChartTokens, wording: Omit<BridgeWording<Target>, 'total'>, from: number): BridgeChart<Target>
export function bridgeChart<Target>(
  bars: readonly BridgeBar<Target>[],
  tokens: ChartTokens,
  wording: Omit<BridgeWording<Target>, 'total'> & { readonly total?: string },
  from: number | null = null,
): BridgeChart<Target> {
  let running = from ?? 0
  const placed = bars.map((bar) => {
    const start = bar.kind === 'total' ? 0 : running
    running = bar.kind === 'total' ? bar.amount : running + bar.amount
    return { bar, start }
  })
  const transfer = wording.transfer ?? null
  const legendGroupOf = (bar: BridgeBar<Target>): string => {
    switch (bar.kind) {
      case 'total':
        return wording.total ?? ''
      case 'residual':
        return wording.residual
      case 'transfer':
        return transfer?.label ?? wording.residual
      case 'step':
        return bar.amount >= 0 ? wording.raises : wording.lowers
    }
  }
  const colours: Readonly<Record<string, string>> = {
    [wording.raises]: tokens.positive,
    [wording.lowers]: tokens.negative,
    ...(wording.total === undefined ? {} : { [wording.total]: tokens.inkSecondary }),
    ...(transfer === null ? {} : { [transfer.label]: transfer.colour }),
    [wording.residual]: tokens.deemphasis,
  }
  const named = Object.keys(colours).filter((name) => bars.some((bar) => legendGroupOf(bar) === name))
  const base: BarSeries = {
    type: 'bar',
    stack: 'bridge',
    stackStrategy: 'all',
    silent: true,
    itemStyle: { color: 'transparent' },
    emphasis: { disabled: true },
    data: placed.map((entry) => entry.start),
  }
  // One series coloured bar by bar: a series with gaps would break the stack for the series above it.
  const shown: BarSeries = {
    type: 'bar',
    name: wording.amount,
    stack: 'bridge',
    stackStrategy: 'all',
    barMaxWidth: 18,
    data: placed.map((entry) => ({ value: entry.bar.amount, itemStyle: { color: colours[legendGroupOf(entry.bar)], borderRadius: 2 } })),
  }
  const tooltip = axisTooltip({ tokens, formatAmount: (amount) => formatChartMoney(amount, 'always') })
  return {
    option: {
      grid: { top: 8, right: 16 },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        // The transparent base has no name and stays out of the tooltip.
        formatter: (points: unknown) => tooltip((Array.isArray(points) ? points : [points]).filter((point) => (point as { seriesName?: string }).seriesName === wording.amount)),
      },
      xAxis: { type: 'value', ...(from === null ? {} : { scale: true }), axisLabel: { ...moneyAxisLabel(tokens), hideOverlap: true } },
      yAxis: { type: 'category', inverse: true, data: bars.map((bar) => bar.label), axisLabel: { color: tokens.inkSecondary } },
      series: [base, shown],
    },
    description: wording.description(bars),
    formatValue: formatChartMoney,
    drillAt: ({ dataIndex }) => bars[dataIndex]?.drill ?? null,
    legend: named.map((name): LegendEntry => ({ label: name, colour: colours[name] ?? tokens.ink })),
  }
}
