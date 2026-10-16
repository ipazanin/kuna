import { BAR_END_RIGHT, moneyAxisLabel } from '../../../shared/charts/chartTheme'
import { bucketTone } from '../../../shared/charts/chartTokens'
import type { ChartTokens } from '../../../shared/charts/chartTokens'
import { axisTooltip } from '../../../shared/charts/chartTooltip'
import { formatCompactEuros, formatWholeEuros } from '../../../shared/money/euroFormat'
import type { Figure } from '../../filters/domain/drillTarget'
import type { DrillChart } from '../../filters/presentation/chartDrill'

export interface ComparedCategory {
  readonly category: string
  readonly bucket: string
  readonly current: Figure | null
  readonly prior: Figure | null
}

const CURRENT_SERIES = 'This period'
export const PRIOR_SERIES = 'Prior period'

/**
 * A thin bar per category for the period, over a wide ghost bar for the equal period before it.
 * The ghost sits on a hidden twin of the category axis, so both centre on the same row.
 */
export function categoryComparisonChart(categories: readonly ComparedCategory[], tokens: ChartTokens, priorLabel: string | null): DrillChart {
  const rows = [...categories].reverse()
  const categoryAxis = (shown: boolean) => ({
    type: 'category' as const,
    data: rows.map((row) => row.category),
    show: shown,
    axisLine: { show: false },
    axisLabel: { color: tokens.inkSecondary, fontSize: 12 },
  })
  const ghost = priorLabel === null
    ? []
    : [
        {
          type: 'bar' as const,
          name: PRIOR_SERIES,
          yAxisIndex: 1,
          barWidth: 18,
          color: tokens.ghost,
          itemStyle: { borderRadius: BAR_END_RIGHT },
          data: rows.map((row) => row.prior?.amount ?? 0),
          z: 1,
        },
      ]
  return {
    option: {
      grid: { top: 4, right: 64 },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: axisTooltip({ tokens, formatAmount: (amount) => formatWholeEuros(amount) }) },
      xAxis: { type: 'value', axisLabel: { ...moneyAxisLabel(tokens), hideOverlap: true } },
      yAxis: [categoryAxis(true), categoryAxis(false)],
      series: [
        ...ghost,
        {
          type: 'bar',
          name: CURRENT_SERIES,
          barWidth: 10,
          itemStyle: { borderRadius: BAR_END_RIGHT },
          label: {
            show: true,
            position: 'right',
            distance: 8,
            color: tokens.inkSecondary,
            fontSize: 11,
            formatter: ({ value }: { value: unknown }) => (typeof value === 'number' ? formatCompactEuros(value) : ''),
          },
          data: rows.map((row) => ({ value: row.current?.amount ?? 0, itemStyle: { color: tokens.buckets[bucketTone(row.bucket)] } })),
          z: 2,
        },
      ],
    },
    description:
      categories.length === 0
        ? 'Nothing was spent in this period.'
        : `Cost by category this period${priorLabel === null ? '' : `, against ${priorLabel}`}. ` +
          categories
            .slice(0, 5)
            .map(
              (row) =>
                `${row.category} ${formatWholeEuros(row.current?.amount ?? 0)}` +
                (priorLabel === null ? '' : `, before ${formatWholeEuros(row.prior?.amount ?? 0)}`),
            )
            .join('. ') +
          '.',
    drillAt: ({ seriesName, dataIndex }) => {
      const row = rows[dataIndex]
      return (seriesName === PRIOR_SERIES ? row?.prior : row?.current)?.drill ?? null
    },
  }
}
