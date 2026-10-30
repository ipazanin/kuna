import { words } from './words'
import { monthAxisLabel, monthLabel } from '../../../../shared/calendar/monthLabel'
import { yearOfMonth } from '../../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../../shared/calendar/monthKey'
import { moneyAxisLabel } from '../../../../shared/charts/chartTheme'
import { tokenColour } from '../../../../shared/charts/chartTokens'
import type { ChartTokens } from '../../../../shared/charts/chartTokens'
import { axisTooltip } from '../../../../shared/charts/chartTooltip'
import type { ChartOption, LineSeries } from '../../../../shared/charts/echarts'
import type { Money } from '../../../../shared/money/money'
import { formatMoney } from '../../../../shared/money/moneyFormat'

/** What a loan owes at the end of a month. */
export interface MonthBalance {
  readonly month: MonthKey
  readonly owed: Money
}

export interface BalanceChart {
  readonly option: ChartOption
  readonly description: string
}

export interface BalanceMarks {
  /** Months with an extra payment, each marked with a hollow dot. */
  readonly extraPayments?: readonly MonthKey[]
  /** The first month the plan works out at a variable rate. A wide screen marks it on the chart and every width notes it in the tooltip. */
  readonly estimateFrom?: MonthKey | null
}

/** Every year on a short axis, every other or every fifth on a long one, fewer on a phone. */
export function yearStep(years: number, phone: boolean): number {
  if (phone) return years > 10 ? 5 : years > 4 ? 2 : 1
  return years > 12 ? 2 : 1
}

/** The labels of a month axis: every January of every year step on a long axis, as `yearStep` sets it, and each month on one of a year or less. */
export function monthAxisLabels(months: readonly MonthKey[], tokens: ChartTokens, phone: boolean): Record<string, unknown> {
  const first = months[0]
  const last = months.at(-1)
  if (first === undefined || last === undefined || months.length <= 12) return { color: tokens.inkMuted, formatter: monthAxisLabel('short') }
  const step = yearStep(yearOfMonth(last) - yearOfMonth(first), phone)
  return {
    color: tokens.inkMuted,
    interval: (_index: number, month: string) => month.endsWith('-01') && Number(month.slice(0, 4)) % step === 0,
    formatter: (month: string) => month.slice(0, 4),
  }
}

/** Keeps the tooltip to the named series that have a figure at the hovered month. */
export function shownPoints(points: unknown): unknown {
  return (Array.isArray(points) ? points : [points]).filter((point: { seriesName?: string; value?: unknown }) => point.seriesName !== '' && typeof point.value === 'number')
}

/**
 * The month-end balance as a line, green and solid up to the month on the day and brass and dashed
 * after it, where the figures are the plan's. The two lines share the month on the day, so they join.
 * A dashed rule marks today, with a dot on today's balance, and a hollow dot marks each extra payment.
 * The axis names years, not months.
 */
export function balanceChart(months: readonly MonthBalance[], current: MonthKey, tokens: ChartTokens, phone: boolean, marks: BalanceMarks = {}): BalanceChart {
  const categories: string[] = months.map((entry) => entry.month)
  const hasPlan = months.some((entry) => entry.month > current)
  const past = tokenColour('--loan-principal')
  const ahead = tokenColour('--loan-ahead')
  const first = months[0]
  const last = months.at(-1)
  const now = months.find((entry) => entry.month === current) ?? last
  const extras = months.filter((entry) => marks.extraPayments?.includes(entry.month))
  const line = (name: string, colour: string, shown: (month: MonthKey) => boolean, dashed: boolean, wash: number): LineSeries => ({
    type: 'line',
    name,
    color: colour,
    showSymbol: false,
    lineStyle: { width: 2, ...(dashed ? { type: [5, 4] } : {}) },
    areaStyle: { color: colour, opacity: wash },
    data: months.map((entry) => (shown(entry.month) ? entry.owed : null)),
  })
  const owedSoFar: LineSeries = {
    ...line(words.owedSoFar, past, (month) => month <= current, false, 0.1),
    markLine: {
      silent: true,
      symbol: 'none',
      lineStyle: { color: tokens.axis, type: 'dashed', width: 1 },
      label: { formatter: words.today, position: 'end', color: tokens.inkSecondary, fontSize: 11 },
      data: now === undefined || now.month !== current ? [] : [{ xAxis: current }],
    },
    markPoint: {
      silent: true,
      symbol: 'circle',
      label: { show: false },
      data: [
        ...extras.map((entry) => ({ name: '', coord: [entry.month, entry.owed], symbolSize: 8, itemStyle: { color: tokens.surface, borderColor: past, borderWidth: 2 } })),
        ...(now === undefined || now.month !== current ? [] : [{ name: '', coord: [current, now.owed], symbolSize: 8, itemStyle: { color: past, borderColor: tokens.surface, borderWidth: 2 } }]),
      ],
    },
  }
  const estimateFrom = marks.estimateFrom ?? null
  const stillToCome: LineSeries = {
    ...line(words.stillToCome, ahead, (month) => month >= current, true, 0.08),
    // A mark area carries the note, since a mark line turns its label along the line.
    ...(phone || estimateFrom === null || last === undefined
      ? {}
      : {
          markLine: { silent: true, symbol: 'none', lineStyle: { color: tokens.axis, type: 'dotted', width: 1 }, label: { show: false }, data: [{ xAxis: estimateFrom }] },
          markArea: {
            silent: true,
            itemStyle: { color: 'transparent' },
            label: { formatter: words.variableFrom, position: 'insideBottomLeft', color: tokens.inkMuted, fontSize: 11 },
            data: [[{ xAxis: estimateFrom }, { xAxis: last.month }]],
          },
        }),
  }
  return {
    option: {
      grid: { top: 24, right: 16 },
      tooltip: {
        trigger: 'axis',
        formatter: (points: unknown) =>
          axisTooltip({
            tokens,
            categoryLabel: monthAxisLabel('long'),
            formatAmount: (amount) => formatMoney(amount),
            footnotes: (month) => (estimateFrom !== null && month >= estimateFrom ? [words.estimate] : []),
          })(shownPoints(points)),
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: categories,
        axisLabel: monthAxisLabels(
          months.map((entry) => entry.month),
          tokens,
          phone,
        ),
      },
      yAxis: { type: 'value', axisLabel: moneyAxisLabel(tokens) },
      series: [owedSoFar, ...(hasPlan ? [stillToCome] : [])],
    },
    description:
      first === undefined || last === undefined || now === undefined
        ? words.noMonths
        : words.description(monthLabel(first.month), monthLabel(last.month), monthLabel(now.month), formatMoney(now.owed)) +
          (hasPlan ? words.planDescription(formatMoney(last.owed), monthLabel(last.month)) : ''),
  }
}
