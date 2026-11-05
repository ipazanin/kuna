import type { MonthTotals } from '../domain/monthTotals'
import type { Category } from '../../workbook/domain/category'
import { words } from './words'
import type { MonthKey } from '../../../../shared/calendar/monthKey'
import { monthAxisLabel, monthLabel } from '../../../../shared/calendar/monthLabel'
import { BAR_END_UP, markIncomplete, moneyAxisLabel, stackGap } from '../../../../shared/charts/chartTheme'
import { tokenColour } from '../../../../shared/charts/chartTokens'
import type { ChartTokens } from '../../../../shared/charts/chartTokens'
import { axisTooltip } from '../../../../shared/charts/chartTooltip'
import { shownPoints } from '../../../../shared/charts/monthAxis'
import type { BarSeries, ChartOption } from '../../../../shared/charts/echarts'
import { ZERO } from '../../../../shared/money/money'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import type { LegendEntry } from '../../../../shared/ui/ChartLegend.vue'

export interface GroupMonthsChart {
  readonly option: ChartOption
  readonly description: string
  readonly legend: readonly LegendEntry[]
  /** The group of the series at its place in the chart, for a click or a table cell to open its rows. */
  readonly groupAt: (seriesName: string) => Category | null
}

/**
 * One stacked bar a month, a part per spending group in the group's colour, lowest first in the groups' order. The
 * month still filling is hatched. Groups with nothing spent in any of the months are left out.
 */
export function groupMonthsChart(months: readonly MonthTotals[], groups: readonly Category[], colourOf: (category: Category) => string, current: MonthKey, tokens: ChartTokens): GroupMonthsChart {
  const spentOn = (month: MonthTotals, group: Category): number => month.byGroup.get(group.id) ?? ZERO
  const shown = groups.filter((group) => months.some((month) => spentOn(month, group) !== 0))
  const incomplete = months.map((month) => month.month === current)
  const topOf = (month: MonthTotals): Category | undefined => shown.filter((group) => spentOn(month, group) > 0).at(-1)
  const bars = shown.map((group): BarSeries => {
    const points = markIncomplete(
      months.map((month) => spentOn(month, group)),
      incomplete,
      tokens,
    )
    return {
      type: 'bar',
      name: group.name,
      stack: 'groups',
      color: tokenColour(colourOf(group)),
      itemStyle: { ...stackGap(tokens), borderRadius: 0 },
      data: points.map((point, index) => {
        const month = months[index]
        if (month === undefined || topOf(month) !== group) return point
        return typeof point === 'object' && point !== null ? { ...point, itemStyle: { ...point.itemStyle, borderRadius: BAR_END_UP } } : { value: point, itemStyle: { borderRadius: BAR_END_UP } }
      }),
    }
  })
  const byName = new Map(shown.map((group) => [group.name, group]))
  return {
    option: {
      grid: { top: 16 },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (points: unknown) =>
          axisTooltip({ tokens, incompleteCategories: [current], categoryLabel: monthAxisLabel('long'), formatAmount: (amount) => formatMoney(amount) })(shownPoints(points)),
      },
      xAxis: { type: 'category', data: months.map((month) => month.month), axisLabel: { color: tokens.inkMuted, formatter: monthAxisLabel('short') } },
      yAxis: { type: 'value', axisLabel: moneyAxisLabel(tokens) },
      series: bars,
    },
    description: describe(months, current),
    legend: shown.map((group) => ({ label: group.name, colour: `var(${colourOf(group)})` })),
    groupAt: (seriesName) => byName.get(seriesName) ?? null,
  }
}

function describe(months: readonly MonthTotals[], current: MonthKey): string {
  const first = months[0]
  const last = months.at(-1)
  if (first === undefined || last === undefined) return words.groups.nothing
  const most = months.reduce((largest, month) => (month.spent > largest.spent ? month : largest), first)
  if (most.spent <= 0) return words.groups.nothing
  return [
    words.groups.span(monthLabel(first.month), monthLabel(last.month)),
    words.groups.most(monthLabel(most.month), formatMoney(most.spent)),
    ...(last.month === current ? [words.groups.running(monthLabel(current))] : []),
  ].join(' ')
}
