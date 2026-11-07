import type { CivilDate } from '../../../../../../shared/calendar/civilDate'
import type { DateRange } from '../../../../../../shared/calendar/dateRange'
import { monthAxisLabel } from '../../../../../../shared/calendar/monthLabel'
import { lastDayOf, monthOf, monthsFrom } from '../../../../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../../../../shared/calendar/monthKey'
import { monthInRange, wholeMonthsSpan } from '../../../../../../shared/charts/chartRange'
import { moneyAxisLabel } from '../../../../../../shared/charts/chartTheme'
import type { ChartTokens } from '../../../../../../shared/charts/chartTokens'
import { axisTooltip } from '../../../../../../shared/charts/chartTooltip'
import type { ChartOption, LineSeries } from '../../../../../../shared/charts/echarts'
import { formatMoney } from '../../../../../../shared/money/moneyFormat'
import type { LegendEntry } from '../../../../../../shared/ui/ChartLegend.vue'
import { bookValueOn } from '../../domain/assets/depreciationSchedule'
import type { DepreciationSchedule } from '../../domain/assets/depreciationSchedule'
import { words } from './words'
import { sumMoney } from '../../../../../../shared/money/money'

/** The categorical slots a chart may use before the rest fold into one series. */
const SLOTS = 8

const AHEAD_LABEL = words.chart.ahead

export interface BookValueChart {
  readonly option: ChartOption
  readonly description: string
  readonly legend: readonly LegendEntry[]
  readonly empty: boolean
}

interface AssetLine {
  readonly name: string
  readonly colour: string
  readonly schedules: readonly DepreciationSchedule[]
}

/** The months the book value chart can show, from the first purchase to the last asset written off or at zero, null with nothing depreciated. */
export function bookValueSpan(schedules: readonly DepreciationSchedule[]): DateRange | null {
  const months = axisMonths(schedules.filter((schedule) => schedule.treatment === 'depreciated'))
  const [first] = months
  const last = months.at(-1)
  return first === undefined || last === undefined ? null : wholeMonthsSpan(first, last)
}

/**
 * Book value of each depreciated asset at the end of every month in the range, from the month it was
 * bought to the month it reaches zero. Small inventory never carries a book value, so it has no line.
 * The months after this one are tinted, since they follow the schedule rather than the ledger.
 */
export function bookValueChart(schedules: readonly DepreciationSchedule[], today: CivilDate, tokens: ChartTokens, range: DateRange | null): BookValueChart {
  const depreciated = schedules.filter((schedule) => schedule.treatment === 'depreciated')
  const months = axisMonths(depreciated).filter((month) => monthInRange(range, month))
  const lines = assetLines(depreciated, tokens)
  const series: LineSeries[] = lines.map((line, index) => ({
    type: 'line',
    name: line.name,
    color: line.colour,
    showSymbol: false,
    lineStyle: { width: 2 },
    emphasis: { focus: 'series' },
    data: valuesOf(line.schedules, months),
    ...(index === 0 ? { markArea: aheadBand(months, today, tokens) } : {}),
  }))
  const tooltip = axisTooltip({ tokens, categoryLabel: monthAxisLabel('long') })
  const option: ChartOption = {
    grid: { top: 16, right: 16 },
    tooltip: {
      trigger: 'axis',
      // An asset already written off or not bought yet has no point in the month, so it stays out of the tooltip.
      formatter: (points: unknown) => tooltip((Array.isArray(points) ? points : [points]).filter((point) => (point as { value?: unknown }).value != null)),
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: months,
      axisLabel: { color: tokens.inkMuted, formatter: monthAxisLabel('short') },
      axisLine: { lineStyle: { color: tokens.axis } },
    },
    yAxis: { type: 'value', axisLabel: moneyAxisLabel(tokens) },
    series,
  }
  const first = months[0]
  const last = months[months.length - 1]
  const todayValue = sumMoney(depreciated.map((schedule) => bookValueOn(schedule, today).amount))
  return {
    option,
    empty: series.length === 0,
    legend: [...lines.map((line): LegendEntry => ({ label: line.name, colour: line.colour, mark: 'line' })), { label: AHEAD_LABEL, colour: 'var(--chart-ghost)', mark: 'ghost' }],
    description: first === undefined || last === undefined ? words.chart.none : words.chart.description(lines.map((line) => line.name).join(', '), first, last, formatMoney(todayValue)),
  }
}

function axisMonths(schedules: readonly DepreciationSchedule[]): MonthKey[] {
  if (schedules.length === 0) {
    return []
  }
  const first = schedules.map((schedule) => monthOf(schedule.asset.bought)).sort()[0]!
  const last = schedules
    .map((schedule) => (schedule.writeOff === null ? (schedule.months.at(-1)?.month ?? monthOf(schedule.asset.inUse)) : monthOf(schedule.writeOff.on)))
    .sort()
    .at(-1)!
  return monthsFrom(first, last)
}

/** One line per asset in the order of the assets tab, and past the eighth slot the rest as one grey line. */
function assetLines(schedules: readonly DepreciationSchedule[], tokens: ChartTokens): AssetLine[] {
  const own = (schedule: DepreciationSchedule, index: number): AssetLine => ({
    name: schedule.asset.name,
    colour: tokens.series[index] ?? tokens.ink,
    schedules: [schedule],
  })
  if (schedules.length <= SLOTS) {
    return schedules.map(own)
  }
  return [...schedules.slice(0, SLOTS - 1).map(own), { name: words.chart.otherAssets, colour: tokens.deemphasis, schedules: schedules.slice(SLOTS - 1) }]
}

/** Each month's book value, null before the first purchase and after the line has reached zero. */
function valuesOf(schedules: readonly DepreciationSchedule[], months: readonly MonthKey[]): (number | null)[] {
  let reachedZero = false
  return months.map((month) => {
    const end = lastDayOf(month)
    const held = schedules.filter((schedule) => schedule.asset.bought <= end)
    if (held.length === 0 || reachedZero) {
      return null
    }
    const value = sumMoney(held.map((schedule) => bookValueOn(schedule, end).amount))
    reachedZero = value === 0 && held.length === schedules.length
    return value
  })
}

function aheadBand(months: readonly MonthKey[], today: CivilDate, tokens: ChartTokens): Record<string, unknown> {
  const thisMonth = monthOf(today)
  const ahead = months.filter((month) => month > thisMonth)
  const from = months.includes(thisMonth) ? thisMonth : ahead[0]
  const to = months[months.length - 1]
  return {
    silent: true,
    itemStyle: { color: tokens.ghost },
    data: from === undefined || to === undefined || ahead.length === 0 ? [] : [[{ xAxis: from }, { xAxis: to }]],
  }
}
