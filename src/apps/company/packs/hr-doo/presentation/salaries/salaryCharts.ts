import { monthAxisLabel } from '../../../../../../shared/calendar/monthLabel'
import { BAR_END_UP, markIncomplete, moneyAxisLabel, stackGap } from '../../../../../../shared/charts/chartTheme'
import type { ChartTokens } from '../../../../../../shared/charts/chartTokens'
import { tokenColour } from '../../../../../../shared/charts/chartTokens'
import { axisTooltip } from '../../../../../../shared/charts/chartTooltip'
import type { BarSeries } from '../../../../../../shared/charts/echarts'
import { formatMoney } from '../../../../../../shared/money/moneyFormat'
import type { LegendEntry } from '../../../../../../shared/ui/ChartLegend.vue'
import type { DrillChart } from '../../../../filters/presentation/chartDrill'
import { PAY_PARTS, PAY_PART_COLOURS, PAY_PART_LABELS } from './salariesView'
import type { SalaryMonthRow } from './salariesView'
import { words } from './words'
import { uncapitalised } from '../../../../../../shared/text/capitalised'

/** The cost to the company of each payday, stacked in the ring's five parts. The month still running is hatched. */
export function salaryMonthsChart(rows: readonly SalaryMonthRow[], tokens: ChartTokens): DrillChart & { readonly legend: readonly LegendEntry[] } {
  const incomplete = rows.map((row) => row.unpaid)
  const last = PAY_PARTS[PAY_PARTS.length - 1]
  const bars: BarSeries[] = PAY_PARTS.map((part) => ({
    type: 'bar',
    name: PAY_PART_LABELS[part],
    stack: 'cost',
    color: tokenColour(PAY_PART_COLOURS[part]),
    barMaxWidth: 28,
    itemStyle: { ...stackGap(tokens), borderRadius: part === last ? BAR_END_UP : 0 },
    data: markIncomplete(
      rows.map((row) => row.parts[part]),
      incomplete,
      tokens,
    ),
  }))
  const first = rows[0]
  const final = rows[rows.length - 1]
  const total = rows.reduce((sum, row) => sum + row.cost, 0)
  return {
    option: {
      grid: { top: 16 },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: axisTooltip({
          tokens,
          incompleteCategories: rows.filter((row) => row.unpaid).map((row) => row.payday),
          categoryLabel: monthAxisLabel('long'),
          formatAmount: (amount) => formatMoney(amount),
        }),
      },
      xAxis: {
        type: 'category',
        data: rows.map((row) => row.payday),
        axisLabel: { color: tokens.inkMuted, formatter: monthAxisLabel('short') },
        axisLine: { lineStyle: { color: tokens.axis } },
      },
      yAxis: { type: 'value', axisLabel: moneyAxisLabel(tokens) },
      series: bars,
    },
    description:
      first === undefined || final === undefined
        ? words.chart.none
        : words.chart.description(first.payday, final.payday, PAY_PARTS.map((part) => uncapitalised(PAY_PART_LABELS[part])).join(', '), formatMoney(total)),
    formatValue: (value) => formatMoney(value),
    drillAt: ({ seriesName, dataIndex }) => {
      const part = PAY_PARTS.find((candidate) => PAY_PART_LABELS[candidate] === seriesName)
      return part === undefined ? null : (rows[dataIndex]?.drills[part] ?? null)
    },
    legend: [
      ...PAY_PARTS.map((part): LegendEntry => ({ label: PAY_PART_LABELS[part], colour: `var(${PAY_PART_COLOURS[part]})` })),
      ...(rows.some((row) => row.unpaid) ? [{ label: words.chart.monthSoFar, colour: 'var(--chart-deemphasis)', mark: 'hatched' as const }] : []),
    ],
  }
}
