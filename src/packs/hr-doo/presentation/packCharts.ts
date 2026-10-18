import { monthAxisLabel, monthLabel } from '../../../shared/calendar/monthLabel'
import type { MonthKey } from '../../../shared/calendar/monthKey'
import { BAR_END_DOWN, BAR_END_UP, incompleteBand, markIncomplete, moneyAxisLabel, stackGap } from '../../../shared/charts/chartTheme'
import type { ChartTokens } from '../../../shared/charts/chartTokens'
import { axisTooltip } from '../../../shared/charts/chartTooltip'
import type { BarSeries, ChartOption, LineSeries } from '../../../shared/charts/echarts'
import { formatWholeMoney } from '../../../shared/money/moneyFormat'
import type { LegendEntry } from '../../../shared/ui/ChartLegend.vue'
import { drillToTransactions } from '../../../features/filters/domain/drillTarget'
import type { DrillTarget, Figure } from '../../../features/filters/domain/drillTarget'
import type { DrillChart } from '../../../features/filters/presentation/chartDrill'
import type { LoanMonth } from '../domain/ownerLoans'

/** The categorical slots a chart may use before the rest fold into one series. */
const SLOTS = 8

/** One series of a chart by category: a category, or the categories past the eighth slot together. */
export interface CategorySeries {
  readonly name: string
  readonly categories: readonly string[]
  readonly colour: string
}

/**
 * A colour per category from its place in the tab's list, so a filter that hides one never
 * repaints the others. Past the eighth slot the rest share one grey series rather than a made-up hue.
 */
export function categorySeries(slugs: readonly string[], tokens: ChartTokens, nameOf: (slug: string) => string): CategorySeries[] {
  if (slugs.length <= SLOTS) {
    return slugs.map((slug, index) => ({ name: nameOf(slug), categories: [slug], colour: tokens.series[index] ?? tokens.ink }))
  }
  const named = slugs.slice(0, SLOTS - 1)
  return [
    ...named.map((slug, index) => ({ name: nameOf(slug), categories: [slug], colour: tokens.series[index] ?? tokens.ink })),
    { name: 'Other categories', categories: slugs.slice(SLOTS - 1), colour: tokens.deemphasis },
  ]
}

export function categoryLegend(series: readonly CategorySeries[]): LegendEntry[] {
  return series.map((entry) => ({ label: entry.name, colour: entry.colour }))
}

/** A month of figures by category, as both the tax and the owner charts draw them. */
export interface CategoryMonth {
  readonly month: MonthKey
  readonly complete: boolean
  readonly byCategory: Readonly<Record<string, Figure>>
  readonly total: Figure
}

function amountOf(month: CategoryMonth, series: CategorySeries): number {
  return series.categories.reduce((total, category) => total + (month.byCategory[category]?.amount ?? 0), 0)
}

function drillOf(month: CategoryMonth, series: CategorySeries | undefined): DrillTarget | null {
  if (series === undefined) {
    return month.total.drill
  }
  const [only] = series.categories
  if (series.categories.length === 1 && only !== undefined) {
    return month.byCategory[only]?.drill ?? null
  }
  return drillToTransactions({ ...month.total.drill.filters, categories: series.categories })
}

function monthTooltip(months: readonly { readonly month: MonthKey; readonly complete: boolean }[], tokens: ChartTokens, sign: 'magnitude' | 'negative') {
  return axisTooltip({
    tokens,
    incompleteCategories: months.filter((month) => !month.complete).map((month) => month.month),
    categoryLabel: monthAxisLabel('long'),
    formatAmount: (amount) => formatWholeMoney(amount, sign),
  })
}

function monthAxis(months: readonly { readonly month: MonthKey }[], tokens: ChartTokens, boundaryGap: boolean) {
  return {
    type: 'category' as const,
    boundaryGap,
    data: months.map((month) => month.month),
    axisLabel: { color: tokens.inkMuted, formatter: monthAxisLabel('short') },
    axisLine: { onZero: true, lineStyle: { color: tokens.axis } },
  }
}

function spanOf(months: readonly { readonly month: MonthKey }[]): string {
  const first = months[0]
  const last = months[months.length - 1]
  return first === undefined || last === undefined ? '' : `from ${monthLabel(first.month)} to ${monthLabel(last.month)}`
}

/**
 * Each tax category as a stacked area by month. A category that took more back than it paid, such
 * as refunds, stacks on its own below zero, since an area fills down to the series under it and
 * would otherwise drag the others' fill with it.
 */
export function taxByTypeChart(months: readonly CategoryMonth[], series: readonly CategorySeries[], tokens: ChartTokens): DrillChart {
  const categories = months.map((month) => month.month)
  const incomplete = months.map((month) => !month.complete)
  const areas: LineSeries[] = series.map((entry, index) => ({
    type: 'line',
    name: entry.name,
    stack: months.reduce((sum, month) => sum + amountOf(month, entry), 0) < 0 ? 'refunds' : 'taxes',
    color: entry.colour,
    showSymbol: false,
    lineStyle: { width: 1.5 },
    areaStyle: { color: entry.colour, opacity: 0.28 },
    data: months.map((month) => amountOf(month, entry)),
    ...(index === 0 ? { markArea: incompleteBand(categories, incomplete, tokens) } : {}),
  }))
  const option: ChartOption = {
    grid: { top: 16, right: 16 },
    tooltip: { trigger: 'axis', formatter: monthTooltip(months, tokens, 'negative') },
    xAxis: monthAxis(months, tokens, false),
    yAxis: { type: 'value', axisLabel: moneyAxisLabel(tokens) },
    series: areas,
  }
  const total = months.reduce((sum, month) => sum + month.total.amount, 0)
  return {
    option,
    description:
      months.length === 0
        ? 'No months to show.'
        : `Taxes paid by month ${spanOf(months)}, stacked by ${series.map((entry) => entry.name).join(', ')}. ${formatWholeMoney(total)} in all, net of refunds.`,
    drillAt: ({ seriesName, dataIndex }) => {
      const month = months[dataIndex]
      return month === undefined ? null : drillOf(month, series.find((entry) => entry.name === seriesName))
    },
  }
}

/**
 * Owner pay stacked by category, one bar per month. Money handed back, such as a loan repaid,
 * stacks below zero.
 */
export function ownerDrawsChart(months: readonly CategoryMonth[], series: readonly CategorySeries[], tokens: ChartTokens): DrillChart {
  const incomplete = months.map((month) => !month.complete)
  const last = series[series.length - 1]
  const bars: BarSeries[] = series.map((entry) => ({
    type: 'bar',
    name: entry.name,
    stack: 'draws',
    color: entry.colour,
    itemStyle: { ...stackGap(tokens), borderRadius: entry === last ? BAR_END_UP : 0 },
    data: markIncomplete(
      months.map((month) => amountOf(month, entry)),
      incomplete,
      tokens,
    ),
  }))
  const total = months.reduce((sum, month) => sum + month.total.amount, 0)
  return {
    option: {
      grid: { top: 16 },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: monthTooltip(months, tokens, 'negative') },
      xAxis: monthAxis(months, tokens, true),
      yAxis: { type: 'value', axisLabel: moneyAxisLabel(tokens) },
      series: bars,
    },
    description:
      months.length === 0
        ? 'No months to show.'
        : `Owner pay by month ${spanOf(months)}, stacked by ${series.map((entry) => entry.name).join(', ')}. ${formatWholeMoney(total)} in all.`,
    drillAt: ({ seriesName, dataIndex }) => {
      const month = months[dataIndex]
      return month === undefined ? null : drillOf(month, series.find((entry) => entry.name === seriesName))
    },
  }
}

export const LENT_SERIES = 'Lent'
export const REPAID_SERIES = 'Repaid'
export const OUTSTANDING_SERIES = 'Owed by the owner'

export interface LoanColours {
  readonly lent: string
  readonly repaid: string
}

/** Money lent as bars below zero, repayments as bars above it, and what is still owed as a line. */
export function loanTimelineChart(months: readonly LoanMonth[], colours: LoanColours, tokens: ChartTokens): DrillChart {
  const incomplete = months.map((month) => !month.complete)
  const bars: BarSeries[] = [
    {
      type: 'bar',
      name: LENT_SERIES,
      stack: 'loans',
      color: colours.lent,
      itemStyle: { ...stackGap(tokens), borderRadius: BAR_END_DOWN },
      data: markIncomplete(
        months.map((month) => -month.lent.amount),
        incomplete,
        tokens,
      ),
    },
    {
      type: 'bar',
      name: REPAID_SERIES,
      stack: 'loans',
      color: colours.repaid,
      itemStyle: { ...stackGap(tokens), borderRadius: BAR_END_UP },
      data: markIncomplete(
        months.map((month) => month.repaid.amount),
        incomplete,
        tokens,
      ),
    },
  ]
  const outstanding: LineSeries = {
    type: 'line',
    name: OUTSTANDING_SERIES,
    color: tokens.ink,
    showSymbol: true,
    symbolSize: 6,
    data: months.map((month) => month.outstanding.amount),
    z: 4,
  }
  const last = months[months.length - 1]
  return {
    option: {
      grid: { top: 16 },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: monthTooltip(months, tokens, 'negative') },
      xAxis: monthAxis(months, tokens, true),
      yAxis: { type: 'value', axisLabel: moneyAxisLabel(tokens) },
      series: [...bars, outstanding],
    },
    description:
      last === undefined
        ? 'No months to show.'
        : `Loans to the owner by month ${spanOf(months)}: money lent below zero, repayments above it, and what the owner still owes as a line. ` +
          `${last.complete ? 'At the end of' : 'So far in'} ${monthLabel(last.month)} the owner owed ${formatWholeMoney(last.outstanding.amount)}.`,
    drillAt: ({ seriesName, dataIndex }) => {
      const month = months[dataIndex]
      if (month === undefined) {
        return null
      }
      if (seriesName === LENT_SERIES) return month.lent.drill
      if (seriesName === REPAID_SERIES) return month.repaid.drill
      return month.outstanding.drill
    },
  }
}
