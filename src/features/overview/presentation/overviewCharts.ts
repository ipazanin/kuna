import { BAR_END_RIGHT, moneyAxisLabel, stackGap } from '../../../shared/charts/chartTheme'
import { bucketTone } from '../../../shared/charts/chartTokens'
import type { ChartTokens } from '../../../shared/charts/chartTokens'
import { axisTooltip } from '../../../shared/charts/chartTooltip'
import type { BarSeries } from '../../../shared/charts/echarts'
import { currencyUnitName, formatCompactMoney, formatPercent, formatWholeMoney } from '../../../shared/money/moneyFormat'
import type { LegendEntry } from '../../../shared/ui/ChartLegend.vue'
import type { DrillChart } from '../../filters/presentation/chartDrill'
import { inSentence, lineShown } from '../../settings/domain/profitAndLossLabels'
import type { Settings } from '../../settings/domain/settings'
import type { CategoryTotal } from '../../spending/domain/categoryTotals'
import type { EuroSplit, EuroSplitPart } from '../domain/euroSplit'

export interface LabelledSplit {
  readonly label: string
  readonly split: EuroSplit
}

export interface SplitPart {
  readonly part: EuroSplitPart
  readonly name: string
  readonly tone: 'income' | 'operating' | 'taxes' | 'owner-pay'
}

/** What is kept, then each cost on screen, named by the settings. */
export function splitParts(settings: Settings): SplitPart[] {
  const parts: SplitPart[] = [
    { part: 'kept', name: 'Kept', tone: 'income' },
    { part: 'operating', name: settings.bucketLabels.operating, tone: 'operating' },
    { part: 'taxes', name: settings.bucketLabels.taxes, tone: 'taxes' },
    { part: 'ownerPay', name: settings.bucketLabels['owner-pay'], tone: 'owner-pay' },
  ]
  return parts.filter((part) => part.part !== 'ownerPay' || lineShown(settings, 'ownerPay'))
}

export function splitLegend(parts: readonly SplitPart[]): LegendEntry[] {
  return parts.map((part) => ({ label: part.name, colour: `var(--bucket-${part.tone})` }))
}

/** A segment label only where it fits inside the segment. */
const SMALLEST_LABELLED_SHARE = 0.2

/**
 * One 100% bar per window, each segment a share of what came in. A window in a loss has no kept
 * segment: its bar splits what went out, and the description says so.
 */
export function euroSplitChart(windows: readonly LabelledSplit[], parts: readonly SplitPart[], tokens: ChartTokens): DrillChart {
  const rows = [...windows].reverse()
  const unit = currencyUnitName()
  const lastPart = parts[parts.length - 1]
  const series: BarSeries[] = parts.map(({ part, name, tone }) => ({
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
        const shares = split.slices
          .filter((slice) => parts.some((part) => part.part === slice.part))
          .map((slice) => `${inSentence(parts.find((part) => part.part === slice.part)?.name ?? slice.part)} ${formatPercent(slice.share)}`)
          .join(', ')
        return split.basis === 'income'
          ? `${label}: of every ${unit} earned, ${shares}.`
          : `${label}: costs exceeded income by ${formatWholeMoney(split.shortfall?.perMonth ?? 0)} a month, so the bar splits every ${unit} spent: ${shares}.`
      })
      .join(' '),
    formatValue: (share) => formatPercent(share),
    drillAt: ({ seriesName, dataIndex }) => {
      const part = parts.find((candidate) => candidate.name === seriesName)?.part
      return rows[dataIndex]?.split.slices.find((slice) => slice.part === part)?.drill ?? null
    },
  }
}

/** Horizontal bars, largest on top, each in its bucket's colour, with the amount at the bar end. */
export function categoryBarsChart(
  categories: readonly CategoryTotal[],
  tokens: ChartTokens,
  subject: string,
  categoryName: (slug: string) => string,
): DrillChart {
  const rows = [...categories].reverse()
  return {
    option: {
      grid: { top: 4, right: 64 },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: axisTooltip({ tokens, formatAmount: (amount) => formatWholeMoney(amount) }) },
      xAxis: { type: 'value', axisLabel: { ...moneyAxisLabel(tokens), hideOverlap: true } },
      yAxis: {
        type: 'category',
        data: rows.map((total) => categoryName(total.category)),
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
            formatter: ({ value }: { value: unknown }) => (typeof value === 'number' ? formatCompactMoney(value) : ''),
          },
          data: rows.map((total) => ({ value: total.amount.amount, itemStyle: { color: tokens.buckets[bucketTone(total.bucket)] } })),
        },
      ],
    },
    description:
      categories.length === 0
        ? `No ${inSentence(subject)} in this period.`
        : `${subject} by category. ${categories
            .slice(0, 5)
            .map((total) => `${categoryName(total.category)} ${formatWholeMoney(total.amount.amount)}`)
            .join(', ')}${categories.length > 5 ? `, and ${categories.length - 5} more` : ''}.`,
    drillAt: ({ dataIndex }) => rows[dataIndex]?.amount.drill ?? null,
  }
}
