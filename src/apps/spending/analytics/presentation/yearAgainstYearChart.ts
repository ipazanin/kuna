import type { YearAgainstYear } from '../domain/yearAgainstYear'
import { words } from './words'
import type { MonthKey } from '../../../../shared/calendar/monthKey'
import { monthName, shortMonthName } from '../../../../shared/calendar/monthLabel'
import { markIncomplete, moneyAxisLabel } from '../../../../shared/charts/chartTheme'
import { tokenColour } from '../../../../shared/charts/chartTokens'
import type { ChartTokens } from '../../../../shared/charts/chartTokens'
import { axisTooltip } from '../../../../shared/charts/chartTooltip'
import { shownPoints } from '../../../../shared/charts/monthAxis'
import type { BarSeries, ChartOption } from '../../../../shared/charts/echarts'
import { parseMonthKey } from '../../../../shared/calendar/monthKey'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import type { LegendEntry } from '../../../../shared/ui/ChartLegend.vue'

export interface YearAgainstYearChart {
  readonly option: ChartOption
  readonly description: string
  readonly legend: readonly LegendEntry[]
  /** How a month of the axis reads, by its name alone since each bar names its year. */
  readonly categoryLabel: (category: string) => string
}

const nameOf =
  (form: (month: MonthKey) => string) =>
  (category: string): string => {
    const month = parseMonthKey(category)
    return month === null ? category : form(month)
  }

/**
 * Two bars a month: the year's in the colour the token names, the month still filling hatched, and last year's beside it in
 * the faded grey, or in muted ink when the year itself is faded grey.
 */
export function yearAgainstYearChart(figures: YearAgainstYear, name: string, colourToken: string, current: MonthKey, tokens: ChartTokens): YearAgainstYearChart {
  const { year, months } = figures
  const lastYearToken = colourToken === '--chart-deemphasis' ? '--chart-ink-muted' : '--chart-deemphasis'
  const thisYear: BarSeries = {
    type: 'bar',
    name: String(year),
    color: tokenColour(colourToken),
    data: markIncomplete(
      months.map((month) => month.counted),
      months.map((month) => month.month === current),
      tokens,
    ),
  }
  const lastYear: BarSeries = { type: 'bar', name: String(year - 1), color: tokenColour(lastYearToken), data: months.map((month) => month.lastYear) }
  return {
    option: {
      grid: { top: 16 },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (points: unknown) => axisTooltip({ tokens, incompleteCategories: [current], categoryLabel: nameOf(monthName) })(shownPoints(points)),
      },
      xAxis: { type: 'category', data: months.map((month) => month.month), axisLabel: { color: tokens.inkMuted, formatter: nameOf(shortMonthName) } },
      yAxis: { type: 'value', axisLabel: moneyAxisLabel(tokens) },
      series: [thisYear, lastYear],
    },
    description: words.analysis.year.describe(name, year, formatMoney(figures.toDate.counted), formatMoney(figures.lastYearToDate.counted)),
    legend: [
      { label: String(year), colour: `var(${colourToken})` },
      { label: String(year - 1), colour: `var(${lastYearToken})` },
    ],
    categoryLabel: nameOf(monthName),
  }
}
