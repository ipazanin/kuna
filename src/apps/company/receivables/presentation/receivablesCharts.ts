import { BAR_END_RIGHT, moneyAxisLabel, stackGap } from '../../../../shared/charts/chartTheme'
import type { ChartTokens } from '../../../../shared/charts/chartTokens'
import { axisTooltip } from '../../../../shared/charts/chartTooltip'
import type { BarSeries } from '../../../../shared/charts/echarts'
import type { Money } from '../../../../shared/money/money'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import type { LegendEntry } from '../../../../shared/ui/ChartLegend.vue'
import type { DrillTarget } from '../../filters/domain/drillTarget'
import type { DrillChart } from '../../filters/presentation/chartDrill'
import { AGEING_BUCKETS } from '../domain/ageing'
import type { AgeingBucket } from '../domain/ageing'
import { words as domainWords } from '../domain/words'
import { words } from './words'

/** One client's money still owed, by how late it is. */
export interface ClientAgeing {
  readonly name: string
  readonly byBucket: Readonly<Record<AgeingBucket, Money>>
  /** The rows the client paid from, since what is owed has no row of its own yet. */
  readonly drill: DrillTarget | null
}

export function ageingLegend(tokens: ChartTokens): LegendEntry[] {
  return AGEING_BUCKETS.map((bucket, step) => ({ label: domainWords.ageing[bucket], colour: tokens.ageing[step] ?? tokens.ink }))
}

/** One horizontal bar per client, its segments from not due yet to over 90 days late, left to right. */
export function ageingChart(clients: readonly ClientAgeing[], tokens: ChartTokens): DrillChart {
  const bars: BarSeries[] = AGEING_BUCKETS.map((bucket, step) => ({
    type: 'bar',
    name: domainWords.ageing[bucket],
    stack: 'owed',
    color: tokens.ageing[step] ?? tokens.ink,
    // The rounded end goes on whichever segment ends each bar, so a bar ending early keeps its shape.
    itemStyle: stackGap(tokens),
    data: clients.map((client) => ({ value: client.byBucket[bucket], itemStyle: { borderRadius: step === lastFilledStep(client) ? BAR_END_RIGHT : 0 } })),
  }))
  const total = clients.reduce((sum, client) => sum + AGEING_BUCKETS.reduce((owed, bucket) => owed + client.byBucket[bucket], 0), 0)
  return {
    option: {
      grid: { top: 8, right: 16 },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: axisTooltip({ tokens, formatAmount: (amount) => formatMoney(amount) }),
      },
      xAxis: { type: 'value', axisLabel: { ...moneyAxisLabel(tokens), hideOverlap: true } },
      yAxis: { type: 'category', inverse: true, data: clients.map((client) => client.name), axisLabel: { color: tokens.inkSecondary } },
      series: bars,
    },
    description:
      total === 0
        ? words.chart.nothingOwed
        : words.chart.owed(
            formatMoney(total),
            clients
              .map(
                (client) =>
                  `${client.name}: ${AGEING_BUCKETS.filter((bucket) => client.byBucket[bucket] > 0)
                    .map((bucket) => `${formatMoney(client.byBucket[bucket])} ${domainWords.ageing[bucket].toLowerCase()}`)
                    .join(', ')}`,
              )
              .join('. '),
          ),
    drillAt: ({ dataIndex }) => clients[dataIndex]?.drill ?? null,
  }
}

function lastFilledStep(client: ClientAgeing): number {
  return AGEING_BUCKETS.reduce((last, bucket, step) => (client.byBucket[bucket] > 0 ? step : last), -1)
}
