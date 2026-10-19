import type { RouteLocationRaw } from 'vue-router'

import { monthAxisLabel, monthLabel } from '../../../shared/calendar/monthLabel'
import type { MonthKey } from '../../../shared/calendar/monthKey'
import { BAR_END_RIGHT, BAR_END_UP, incompleteDecal, moneyAxisLabel, stackGap } from '../../../shared/charts/chartTheme'
import type { ChartTokens } from '../../../shared/charts/chartTokens'
import { axisTooltip } from '../../../shared/charts/chartTooltip'
import type { BarSeries } from '../../../shared/charts/echarts'
import { sumMoney } from '../../../shared/money/money'
import type { Money } from '../../../shared/money/money'
import { formatWholeMoney } from '../../../shared/money/moneyFormat'
import type { LegendEntry } from '../../../shared/ui/ChartLegend.vue'
import type { LinkChart } from '../../filters/presentation/chartDrill'
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

/** One month of the selected year as the chart draws it. */
export interface BillingChartMonth {
  readonly month: MonthKey
  /** The plan rows dated in the month. */
  readonly planned: Money
  /** What invoices billed of those rows. */
  readonly invoiced: Money
  /** What invoices issued in the month billed beyond any plan row. */
  readonly withoutPlan: Money
  /** The month in the list further down, or null for a month with nothing in it. */
  readonly to: RouteLocationRaw | null
}

const PLANNED = 'Planned'
const INVOICED = 'Invoiced'
const WITHOUT_PLAN = 'Invoiced with no plan row'

export interface BillingChart extends LinkChart {
  readonly legend: readonly LegendEntry[]
}

/**
 * Planned beside invoiced for every month of the year. Invoiced counts what the invoices billed of
 * the month's rows, so a shorter bar is work not invoiced yet. What an invoice issued in the month
 * billed with no plan row sits hatched on top of it.
 */
export function billingMonthChart(months: readonly BillingChartMonth[], tokens: ChartTokens): BillingChart {
  const withoutPlan = months.some((month) => month.withoutPlan > 0)
  const series: BarSeries[] = [
    { type: 'bar', name: PLANNED, color: tokens.deemphasis, itemStyle: { borderRadius: BAR_END_UP }, data: months.map((month) => month.planned) },
    {
      type: 'bar',
      name: INVOICED,
      stack: 'invoiced',
      color: tokens.buckets.income,
      itemStyle: stackGap(tokens),
      data: months.map((month) => ({ value: month.invoiced, itemStyle: { borderRadius: month.withoutPlan > 0 ? 0 : BAR_END_UP } })),
    },
    ...(withoutPlan
      ? [
          {
            type: 'bar' as const,
            name: WITHOUT_PLAN,
            stack: 'invoiced',
            color: tokens.buckets.income,
            itemStyle: { ...stackGap(tokens), borderRadius: BAR_END_UP, decal: incompleteDecal(tokens) },
            data: months.map((month) => month.withoutPlan),
          },
        ]
      : []),
  ]
  return {
    option: {
      grid: { top: 16 },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: axisTooltip({ tokens, categoryLabel: monthAxisLabel('long'), formatAmount: (amount) => formatWholeMoney(amount) }),
      },
      xAxis: { type: 'category', data: months.map((month) => month.month), axisLabel: { color: tokens.inkMuted, formatter: monthAxisLabel('short') } },
      yAxis: { type: 'value', axisLabel: moneyAxisLabel(tokens) },
      series,
    },
    description: describeMonths(months),
    legend: [
      { label: PLANNED, colour: 'var(--chart-deemphasis)' },
      { label: INVOICED, colour: 'var(--bucket-income)' },
      ...(withoutPlan ? [{ label: WITHOUT_PLAN, colour: 'var(--bucket-income)', mark: 'hatched' as const }] : []),
    ],
    linkAt: ({ dataIndex }) => months[dataIndex]?.to ?? null,
  }
}

function describeMonths(months: readonly BillingChartMonth[]): string {
  const planned = sumMoney(months.map((month) => month.planned))
  const invoiced = sumMoney(months.map((month) => month.invoiced))
  const open = months.filter((month) => month.invoiced < month.planned).map((month) => monthLabel(month.month))
  return [
    `Planned ${formatWholeMoney(planned)} and invoiced ${formatWholeMoney(invoiced)} of it, by month.`,
    open.length === 0 ? 'Every month is invoiced in full.' : `Not invoiced in full: ${open.join(', ')}.`,
  ].join(' ')
}

/** Each year's plan as one bar, its items stacked in their colours, largest item of the whole plan first. */
export function itemYearsChart(years: readonly YearItems[], items: readonly string[], tokens: ChartTokens): BillingChart {
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
    linkAt: () => null,
  }
}

/** The series that ends a year's bar, which takes the rounded end. */
function lastName(year: YearItems, names: readonly string[], amountOf: (year: YearItems, name: string) => number): string | null {
  return names.reduce<string | null>((last, name) => (amountOf(year, name) > 0 ? name : last), null)
}
