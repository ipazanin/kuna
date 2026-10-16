import { BAR_END_RIGHT, moneyAxisLabel, stackGap } from '../../../shared/charts/chartTheme'
import { bucketTone } from '../../../shared/charts/chartTokens'
import type { ChartTokens } from '../../../shared/charts/chartTokens'
import { axisTooltip } from '../../../shared/charts/chartTooltip'
import type { BarSeries } from '../../../shared/charts/echarts'
import { formatCompactEuros, formatPercent, formatWholeEuros } from '../../../shared/money/euroFormat'
import type { DrillChart } from '../../filters/presentation/chartDrill'
import type { CategoryTotal } from '../../spending/domain/categoryTotals'
import type { EuroSplit, EuroSplitPart } from '../domain/euroSplit'

export interface LabelledSplit {
  readonly label: string
  readonly split: EuroSplit
}

const SPLIT_PARTS: readonly { readonly part: EuroSplitPart; readonly name: string; readonly tone: 'income' | 'operating' | 'taxes' | 'owner-pay' }[] = [
  { part: 'kept', name: 'Kept', tone: 'income' },
  { part: 'operating', name: 'Operating', tone: 'operating' },
  { part: 'taxes', name: 'Taxes', tone: 'taxes' },
  { part: 'ownerPay', name: 'Owner pay', tone: 'owner-pay' },
]

/** A segment label only where it fits inside the segment. */
const SMALLEST_LABELLED_SHARE = 0.2

/**
 * One 100% bar per window, each segment a share of what came in. A window in a loss has no kept
 * segment: its bar splits what went out, and the description says so.
 */
export function euroSplitChart(windows: readonly LabelledSplit[], tokens: ChartTokens): DrillChart {
  const rows = [...windows].reverse()
  const lastPart = SPLIT_PARTS[SPLIT_PARTS.length - 1]
  const series: BarSeries[] = SPLIT_PARTS.map(({ part, name, tone }) => ({
    type: 'bar',
    name,
    stack: 'euro',
    barWidth: 22,
    color: tokens.buckets[tone],
    itemStyle: { ...stackGap(tokens), borderRadius: part === lastPart?.part ? BAR_END_RIGHT : 0 },
    label: {
      show: true,
      color: tokens.onFill,
      fontSize: 11,
      fontWeight: 600,
      formatter: ({ value }: { value: unknown }) => (typeof value === 'number' && value >= SMALLEST_LABELLED_SHARE ? formatPercent(value) : ''),
    },
    data: rows.map(({ split }) => split.slices.find((slice) => slice.part === part)?.share ?? null),
  }))
  return {
    option: {
      grid: { top: 4, right: 8 },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: axisTooltip({ tokens, formatAmount: (share) => formatPercent(share) }),
      },
      xAxis: { type: 'value', max: 1, interval: 0.25, axisLabel: { formatter: (share: number) => formatPercent(share) } },
      yAxis: {
        type: 'category',
        data: rows.map(({ label, split }) => (split.basis === 'cost' ? `${label}, a loss` : label)),
        axisLine: { show: false },
        axisLabel: { color: tokens.inkSecondary, fontSize: 12 },
      },
      series,
    },
    description: windows
      .map(({ label, split }) => {
        const shares = split.slices.map((slice) => `${partName(slice.part)} ${formatPercent(slice.share)}`).join(', ')
        return split.basis === 'income'
          ? `${label}: of every euro earned, ${shares}.`
          : `${label}: costs exceeded income by ${formatWholeEuros(split.shortfall?.perMonth ?? 0)} a month, so the bar splits every euro spent: ${shares}.`
      })
      .join(' '),
    drillAt: ({ seriesName, dataIndex }) => {
      const part = SPLIT_PARTS.find((candidate) => candidate.name === seriesName)?.part
      return rows[dataIndex]?.split.slices.find((slice) => slice.part === part)?.drill ?? null
    },
  }
}

/** Horizontal bars, largest on top, each in its bucket's colour, with the amount at the bar end. */
export function categoryBarsChart(categories: readonly CategoryTotal[], tokens: ChartTokens, subject: string): DrillChart {
  const rows = [...categories].reverse()
  return {
    option: {
      grid: { top: 4, right: 64 },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: axisTooltip({ tokens, formatAmount: (amount) => formatWholeEuros(amount) }) },
      xAxis: { type: 'value', axisLabel: { ...moneyAxisLabel(tokens), hideOverlap: true } },
      yAxis: {
        type: 'category',
        data: rows.map((total) => total.category),
        axisLine: { show: false },
        axisLabel: { color: tokens.inkSecondary, fontSize: 12 },
      },
      series: [
        {
          type: 'bar',
          name: subject,
          barWidth: 12,
          itemStyle: { borderRadius: BAR_END_RIGHT },
          label: {
            show: true,
            position: 'right',
            distance: 8,
            color: tokens.inkSecondary,
            fontSize: 11,
            formatter: ({ value }: { value: unknown }) => (typeof value === 'number' ? formatCompactEuros(value) : ''),
          },
          data: rows.map((total) => ({ value: total.amount.amount, itemStyle: { color: tokens.buckets[bucketTone(total.bucket)] } })),
        },
      ],
    },
    description:
      categories.length === 0
        ? `No ${subject.toLowerCase()} in this period.`
        : `${subject} by category. ${categories
            .slice(0, 5)
            .map((total) => `${total.category} ${formatWholeEuros(total.amount.amount)}`)
            .join(', ')}${categories.length > 5 ? `, and ${categories.length - 5} more` : ''}.`,
    drillAt: ({ dataIndex }) => rows[dataIndex]?.amount.drill ?? null,
  }
}

function partName(part: EuroSplitPart): string {
  return SPLIT_PARTS.find((candidate) => candidate.part === part)?.name.toLowerCase() ?? part
}
