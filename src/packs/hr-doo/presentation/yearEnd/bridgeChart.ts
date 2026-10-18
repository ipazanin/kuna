import { moneyAxisLabel } from '../../../../shared/charts/chartTheme'
import type { ChartTokens } from '../../../../shared/charts/chartTokens'
import { axisTooltip } from '../../../../shared/charts/chartTooltip'
import type { BarSeries } from '../../../../shared/charts/echarts'
import { formatMoney, formatWholeMoney } from '../../../../shared/money/moneyFormat'
import type { LegendEntry } from '../../../../shared/ui/ChartLegend.vue'
import type { DrillTarget } from '../../../../features/filters/domain/drillTarget'
import type { DrillChart } from '../../../../features/filters/presentation/chartDrill'

/** One bar of the bridge: a total that starts at zero, or a step that starts where the one before ended. */
export interface BridgeBar {
  readonly label: string
  readonly kind: 'total' | 'step' | 'residual'
  readonly amount: number
  readonly drill: DrillTarget | null
}

const RAISES = 'Raises profit'
const LOWERS = 'Lowers profit'
const TOTAL = 'Total'
const RESIDUAL = 'Not explained'
const AMOUNT = 'Amount'

/**
 * A waterfall laid on its side, one row per bar so the labels read in full. Each step floats from
 * the running total before it to the one after. The bars stack on a transparent base with every
 * sign added in order, so a step that crosses zero still spans exactly its own amount. The legend's
 * names are colours of the one series, not series of their own.
 */
export function bridgeChart(bars: readonly BridgeBar[], tokens: ChartTokens): DrillChart & { readonly legend: readonly LegendEntry[] } {
  let running = 0
  const placed = bars.map((bar) => {
    const start = bar.kind === 'total' ? 0 : running
    running = bar.kind === 'total' ? bar.amount : running + bar.amount
    return { bar, start }
  })
  const legendGroupOf = (bar: BridgeBar): string => (bar.kind === 'total' ? TOTAL : bar.kind === 'residual' ? RESIDUAL : bar.amount >= 0 ? RAISES : LOWERS)
  const colours: Readonly<Record<string, string>> = { [RAISES]: tokens.positive, [LOWERS]: tokens.negative, [TOTAL]: tokens.inkSecondary, [RESIDUAL]: tokens.deemphasis }
  const named = [RAISES, LOWERS, TOTAL, RESIDUAL].filter((name) => bars.some((bar) => legendGroupOf(bar) === name))
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
    name: AMOUNT,
    stack: 'bridge',
    stackStrategy: 'all',
    barMaxWidth: 18,
    data: placed.map((entry) => ({ value: entry.bar.amount, itemStyle: { color: colours[legendGroupOf(entry.bar)], borderRadius: 2 } })),
  }
  const tooltip = axisTooltip({ tokens, formatAmount: (amount) => formatMoney(amount, 'always') })
  const last = bars[bars.length - 1]
  return {
    option: {
      grid: { top: 8, right: 16 },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        // The transparent base has no name and stays out of the tooltip.
        formatter: (points: unknown) => tooltip((Array.isArray(points) ? points : [points]).filter((point) => (point as { seriesName?: string }).seriesName === AMOUNT)),
      },
      xAxis: { type: 'value', axisLabel: moneyAxisLabel(tokens) },
      yAxis: { type: 'category', inverse: true, data: bars.map((bar) => bar.label), axisLabel: { color: tokens.inkSecondary } },
      series: [base, shown],
    },
    description:
      bars.length === 0
        ? 'No bridge to show.'
        : `From ${bars[0]?.label} of ${formatWholeMoney(bars[0]?.amount ?? 0)}, one bar per adjustment: ` +
          bars
            .slice(1)
            .map((bar) => `${bar.label} ${formatWholeMoney(bar.amount, bar.kind === 'total' ? 'negative' : 'always')}`)
            .join(', ') +
          (last === undefined ? '.' : `. The last bar is ${last.label.toLowerCase()}.`),
    formatValue: (value) => formatMoney(value),
    drillAt: ({ dataIndex }) => bars[dataIndex]?.drill ?? null,
    legend: named.map((name): LegendEntry => ({ label: name, colour: colours[name] ?? tokens.ink })),
  }
}
