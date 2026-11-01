import { gainSteps } from '../domain/periodGains'
import type { GainStep, PeriodGains } from '../domain/periodGains'
import { words } from './words'
import { moneyAxisLabel } from '../../../../shared/charts/chartTheme'
import { tokenColour } from '../../../../shared/charts/chartTokens'
import type { ChartTokens } from '../../../../shared/charts/chartTokens'
import { axisTooltip } from '../../../../shared/charts/chartTooltip'
import type { BarSeries, ChartOption } from '../../../../shared/charts/echarts'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import type { Money } from '../../../../shared/money/money'
import type { LegendEntry } from '../../../../shared/ui/ChartLegend.vue'

export interface GainBridgeChart {
  readonly option: ChartOption
  readonly description: string
  readonly legend: readonly LegendEntry[]
}

/** How a bar reads: a value, money put in or taken out, a gain or a loss, or tax and fees, which are costs. */
type BridgeLook = 'total' | 'moved' | 'gain' | 'cost'

interface BridgeBar {
  readonly label: string
  readonly look: BridgeLook
  readonly amount: Money
}

const STEP_LABELS: Readonly<Record<GainStep, string>> = {
  'put-in': words.bridge.putIn,
  'taken-out': words.bridge.takenOut,
  price: words.bridge.price,
  currency: words.bridge.currency,
  realised: words.bridge.realised,
  income: words.bridge.income,
  withheld: words.bridge.withheld,
  fees: words.bridge.fees,
}

const LOOK_NAMES: Readonly<Record<Exclude<BridgeLook, 'gain'>, string>> = {
  total: words.bridge.total,
  moved: words.bridge.moved,
  cost: words.bridge.costs,
}

const STEP_LOOKS: Readonly<Record<GainStep, BridgeLook>> = {
  'put-in': 'moved',
  'taken-out': 'moved',
  price: 'gain',
  currency: 'gain',
  realised: 'gain',
  income: 'gain',
  withheld: 'cost',
  fees: 'cost',
}

/**
 * The value at the start, each step of the period that moved it and the value at the end, as a waterfall laid on its
 * side so the labels read in full. A step floats on a blank base from the running value before it, and the stack adds
 * every sign in order, so a step across zero still spans its own amount. Only gains and losses take a tone.
 */
export function gainBridgeChart(gains: PeriodGains, tokens: ChartTokens): GainBridgeChart {
  const bars: BridgeBar[] = [
    { label: words.bridge.start, look: 'total', amount: gains.start },
    ...gainSteps(gains).flatMap((step) => (step.amount === 0 ? [] : [{ label: STEP_LABELS[step.step], look: STEP_LOOKS[step.step], amount: step.amount }])),
    { label: words.bridge.end, look: 'total', amount: gains.end },
  ]
  let running = 0
  const placed = bars.map((bar) => {
    const base = bar.look === 'total' ? 0 : running
    running = bar.look === 'total' ? bar.amount : running + bar.amount
    return { bar, base }
  })
  const legendNameOf = (bar: BridgeBar): string => (bar.look === 'gain' ? (bar.amount > 0 ? words.bridge.gain : words.bridge.loss) : LOOK_NAMES[bar.look])
  const colours: Readonly<Record<string, string>> = {
    [words.bridge.total]: tokens.inkSecondary,
    [words.bridge.moved]: tokenColour('--invest-portfolio'),
    [words.bridge.gain]: tokens.positive,
    [words.bridge.loss]: tokens.negative,
    [words.bridge.costs]: tokens.deemphasis,
  }
  const named = Object.keys(colours).filter((name) => bars.some((bar) => legendNameOf(bar) === name))
  const base: BarSeries = {
    type: 'bar',
    stack: 'bridge',
    stackStrategy: 'all',
    silent: true,
    itemStyle: { color: 'transparent' },
    emphasis: { disabled: true },
    data: placed.map((entry) => entry.base),
  }
  // One series coloured bar by bar, since a series with gaps would break the stack for the one above it.
  const shown: BarSeries = {
    type: 'bar',
    name: words.bridge.amount,
    stack: 'bridge',
    stackStrategy: 'all',
    barMaxWidth: 18,
    data: placed.map((entry) => ({ value: entry.bar.amount, itemStyle: { color: colours[legendNameOf(entry.bar)], borderRadius: 2 } })),
  }
  const tooltip = axisTooltip({ tokens, formatAmount: (amount) => formatMoney(amount) })
  return {
    option: {
      grid: { top: 8, right: 16 },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (points: unknown) => tooltip((Array.isArray(points) ? points : [points]).filter((point) => (point as { seriesName?: string }).seriesName === words.bridge.amount)),
      },
      xAxis: { type: 'value', axisLabel: { ...moneyAxisLabel(tokens), hideOverlap: true } },
      yAxis: { type: 'category', inverse: true, data: bars.map((bar) => bar.label), axisLabel: { color: tokens.inkSecondary } },
      series: [base, shown],
    },
    description: words.bridge.description(
      formatMoney(gains.start),
      bars
        .filter((bar) => bar.look !== 'total')
        .map((bar) => `${bar.label} ${formatMoney(bar.amount, 'always')}`)
        .join(', '),
      formatMoney(gains.end),
    ),
    legend: named.map((name): LegendEntry => ({ label: name, colour: colours[name] ?? tokens.ink })),
  }
}
