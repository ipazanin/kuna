import { BAR_END_RIGHT, moneyAxisLabel, stackGap } from '../../../shared/charts/chartTheme'
import type { ChartTokens } from '../../../shared/charts/chartTokens'
import { axisTooltip } from '../../../shared/charts/chartTooltip'
import type { BarSeries, ChartOption } from '../../../shared/charts/echarts'
import { sumMoney } from '../../../shared/money/money'
import { formatWholeMoney } from '../../../shared/money/moneyFormat'
import type { LegendEntry } from '../../../shared/ui/ChartLegend.vue'
import type { YearItems } from '../domain/itemStatistics'

/** The categorical slots before the rest fold into one grey series. */
const SLOTS = 8

const OTHER_ITEMS = 'Other items'

/**
 * A colour per item kind from its place in the whole plan's list, largest first, so picking another
 * year never repaints an item. Past the eighth slot the rest share one grey rather than a made-up hue.
 */
export function itemColours(items: readonly string[], tokens: ChartTokens): ReadonlyMap<string, string> {
  return new Map(items.map((item, index) => [item, index < SLOTS - 1 || items.length <= SLOTS ? (tokens.series[index] ?? tokens.ink) : tokens.deemphasis]))
}

/** The name a series of the item chart goes by: the item, or the fold past the eighth slot. */
function seriesNameOf(item: string, items: readonly string[]): string {
  return items.length > SLOTS && items.indexOf(item) >= SLOTS - 1 ? OTHER_ITEMS : item
}

export interface ItemYearsChart {
  readonly option: ChartOption
  readonly description: string
  readonly legend: readonly LegendEntry[]
}

/** Each year's plan as one bar, its items stacked in their colours, largest item of the whole plan first. */
export function itemYearsChart(years: readonly YearItems[], items: readonly string[], tokens: ChartTokens): ItemYearsChart {
  const colours = itemColours(items, tokens)
  const names = [...new Set(items.map((item) => seriesNameOf(item, items)))]
  const amountOf = (year: YearItems, name: string): number =>
    sumMoney(year.items.filter((entry) => seriesNameOf(entry.item, items) === name).map((entry) => entry.amount))
  const series: BarSeries[] = names.map((name) => ({
    type: 'bar',
    name,
    stack: 'items',
    color: name === OTHER_ITEMS ? tokens.deemphasis : (colours.get(name) ?? tokens.ink),
    itemStyle: stackGap(tokens),
    data: years.map((year) => ({ value: amountOf(year, name), itemStyle: { borderRadius: lastName(year, names, amountOf) === name ? BAR_END_RIGHT : 0 } })),
  }))
  return {
    option: {
      grid: { top: 8, right: 16 },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: axisTooltip({ tokens, formatAmount: (amount) => formatWholeMoney(amount) }) },
      xAxis: { type: 'value', axisLabel: moneyAxisLabel(tokens) },
      yAxis: { type: 'category', inverse: true, data: years.map((year) => String(year.year)), axisLabel: { color: tokens.inkSecondary } },
      series,
    },
    description: years
      .map((year) => `${year.year}: ${formatWholeMoney(year.total)}, of it ${year.items.map((entry) => `${entry.item} ${formatWholeMoney(entry.amount)}`).join(', ')}.`)
      .join(' '),
    legend: names.map((name) => ({ label: name, colour: name === OTHER_ITEMS ? 'var(--chart-deemphasis)' : (colours.get(name) ?? 'var(--chart-ink)') })),
  }
}

/** The series that ends a year's bar, which takes the rounded end. */
function lastName(year: YearItems, names: readonly string[], amountOf: (year: YearItems, name: string) => number): string | null {
  return names.reduce<string | null>((last, name) => (amountOf(year, name) > 0 ? name : last), null)
}
