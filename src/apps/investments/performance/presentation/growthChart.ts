import { GROWTH_START } from '../domain/portfolioPerformance'
import type { GrowthPoint } from '../domain/portfolioPerformance'
import { words } from './words'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { parseCivilDate } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { lastDayOf, monthCountBetween, monthOf, yearOfMonth } from '../../../../shared/calendar/monthKey'
import { shortMonthLabel } from '../../../../shared/calendar/monthLabel'
import { moneyAxisLabel } from '../../../../shared/charts/chartTheme'
import { tokenColour } from '../../../../shared/charts/chartTokens'
import type { ChartTokens } from '../../../../shared/charts/chartTokens'
import { axisTooltip } from '../../../../shared/charts/chartTooltip'
import type { ChartOption, LineSeries } from '../../../../shared/charts/echarts'
import { shownPoints, yearStep } from '../../../../shared/charts/monthAxis'
import { formatMoney } from '../../../../shared/money/moneyFormat'

export interface GrowthChart {
  readonly option: ChartOption
  readonly description: string
  /** The euros the lines start from, as the title writes them. */
  readonly start: string
}

/** Up to this many months an axis labels its month ends, and beyond it its years. */
const MONTHS_ON_A_SHORT_AXIS = 13

/** The most month ends a short axis labels, so that a Croatian month such as `velj 25.` keeps clear of the next. */
const MONTH_LABELS = { phone: 4, wider: 7 }

/** Month steps that divide a year, so the labelled months fall on the same calendar months every year. */
const MONTH_STEPS = [1, 2, 3, 4, 6, 12]

/**
 * €100 grown at the portfolio's time-weighted return as a blue line, against the benchmark's own price as a dashed grey
 * one on the same axis. A canvas takes plain numbers, so each point becomes cents only for drawing.
 */
export function growthChart(growth: readonly GrowthPoint[], benchmarkName: string | null, tokens: ChartTokens, phone: boolean): GrowthChart {
  const dates = growth.map((point) => point.date)
  const cents = (grown: number): number => Math.round(grown * 100)
  const portfolio: LineSeries = {
    type: 'line',
    name: words.growth.portfolio,
    color: tokenColour('--invest-portfolio'),
    showSymbol: false,
    lineStyle: { width: 2 },
    data: growth.map((point) => cents(point.portfolio)),
  }
  const hasBenchmark = benchmarkName !== null && growth.every((point) => point.benchmark !== null)
  const benchmark: LineSeries[] = hasBenchmark
    ? [
        {
          type: 'line',
          name: benchmarkName,
          color: tokenColour('--invest-reference'),
          showSymbol: false,
          lineStyle: { width: 2, type: [5, 4] },
          data: growth.map((point) => cents(point.benchmark!)),
        },
      ]
    : []
  const first = growth[0]
  const last = growth.at(-1)
  const start = formatMoney(cents(GROWTH_START))
  return {
    option: {
      grid: { top: 24, right: 16 },
      tooltip: {
        trigger: 'axis',
        formatter: (points: unknown) => axisTooltip({ tokens, categoryLabel: dayOfCategory, formatAmount: (amount) => formatMoney(amount) })(shownPoints(points)),
      },
      xAxis: { type: 'category', boundaryGap: false, data: dates, axisLabel: dayAxisLabels(dates, tokens, phone) },
      yAxis: { type: 'value', scale: true, minInterval: 100, axisLabel: moneyAxisLabel(tokens) },
      series: [portfolio, ...benchmark],
    },
    description:
      first === undefined || last === undefined
        ? words.growth.emptyDescription
        : words.growth.description(start, dayLabel(first.date), dayLabel(last.date), formatMoney(cents(last.portfolio))) +
          (hasBenchmark && last.benchmark !== null ? words.growth.benchmarkLine(benchmarkName, formatMoney(cents(last.benchmark))) : ''),
    start,
  }
}

/** A day the axis holds as `yyyy-mm-dd`, as a reader writes it. */
export function dayOfCategory(category: string): string {
  const day = parseCivilDate(category)
  return day === null ? category : dayLabel(day)
}

/**
 * The labels of an axis of days: on a short one its month ends, thinned to calendar months a few apart so they fit, and on
 * a long one each January's month end of every year step, as the month axes have it.
 */
function dayAxisLabels(dates: readonly CivilDate[], tokens: ChartTokens, phone: boolean): Record<string, unknown> {
  const first = dates[0]
  const last = dates.at(-1)
  const isMonthEnd = (category: string, index: number): boolean => {
    const day = parseCivilDate(category)
    return index > 0 && day !== null && day === lastDayOf(monthOf(day))
  }
  const monthNumber = (category: string): number => Number(category.slice(5, 7))
  if (first === undefined || last === undefined || monthCountBetween(monthOf(first), monthOf(last)) <= MONTHS_ON_A_SHORT_AXIS) {
    const monthEnds = dates.filter((day, index) => isMonthEnd(day, index)).map(monthNumber)
    const most = phone ? MONTH_LABELS.phone : MONTH_LABELS.wider
    const step = MONTH_STEPS.find((months) => monthEnds.filter((month) => month % months === 0).length <= most) ?? 12
    return {
      color: tokens.inkMuted,
      hideOverlap: true,
      interval: (index: number, category: string) => isMonthEnd(category, index) && monthNumber(category) % step === 0,
      formatter: (category: string) => shortMonthLabel(monthOf(parseCivilDate(category) ?? first)),
    }
  }
  const step = yearStep(yearOfMonth(monthOf(last)) - yearOfMonth(monthOf(first)), phone)
  return {
    color: tokens.inkMuted,
    interval: (index: number, category: string) => isMonthEnd(category, index) && monthNumber(category) === 1 && Number(category.slice(0, 4)) % step === 0,
    formatter: (category: string) => category.slice(0, 4),
  }
}
