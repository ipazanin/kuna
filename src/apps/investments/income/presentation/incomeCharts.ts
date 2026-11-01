import type { MonthIncome } from '../domain/incomeHistory'
import type { IncomeForecast } from '../domain/incomeForecast'
import { words } from './words'
import { firstDayOf, lastDayOf } from '../../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../../shared/calendar/monthKey'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { monthCase } from '../../../../shared/calendar/monthCase'
import { monthAxisLabel, monthLabel } from '../../../../shared/calendar/monthLabel'
import { moneyAxisLabel, stripeDecal } from '../../../../shared/charts/chartTheme'
import { tokenColour } from '../../../../shared/charts/chartTokens'
import type { ChartTokens } from '../../../../shared/charts/chartTokens'
import { axisTooltip } from '../../../../shared/charts/chartTooltip'
import type { BarSeries, ChartOption } from '../../../../shared/charts/echarts'
import { monthAxisLabels, shownPoints } from '../../../../shared/charts/monthAxis'
import { sumMoney } from '../../../../shared/money/money'
import { formatMoney } from '../../../../shared/money/moneyFormat'

export interface IncomeChart {
  readonly option: ChartOption
  readonly description: string
}

/** One bar a month of what was received after the tax withheld, from the first payment's month to this one. */
export function incomeByMonthChart(months: readonly MonthIncome[], tokens: ChartTokens, phone: boolean): IncomeChart {
  const keys = months.map((entry) => entry.month)
  const received: BarSeries = { type: 'bar', name: words.amounts.received, color: tokenColour('--invest-portfolio'), data: months.map((entry) => entry.received) }
  const first = months[0]
  const last = months.at(-1)
  const largest = months.reduce<MonthIncome | null>((most, entry) => (most === null || entry.received > most.received ? entry : most), null)
  return {
    option: monthBars(keys, [received], tokens, phone),
    description:
      first === undefined || last === undefined || largest === null
        ? ''
        : words.byMonth.description(formatMoney(sumMoney(months.map((entry) => entry.received))), dayLabel(firstDayOf(first.month)), dayLabel(lastDayOf(last.month))) +
          words.byMonth.largest(monthCase(monthLabel(largest.month), 'accusative'), formatMoney(largest.received)),
  }
}

/** One striped bar a month for the twelve months from this one, since every figure is a copy of last year's. */
export function comingChart(forecast: IncomeForecast, tokens: ChartTokens, phone: boolean): IncomeChart {
  const keys = forecast.months.map((entry) => entry.month)
  const expected: BarSeries = {
    type: 'bar',
    name: words.coming.fromLastYear,
    color: tokenColour('--invest-portfolio'),
    itemStyle: { decal: stripeDecal(tokens) },
    data: forecast.months.map((entry) => entry.received),
  }
  const first = keys[0]
  const last = keys.at(-1)
  return {
    option: monthBars(keys, [expected], tokens, phone),
    description: first === undefined || last === undefined ? '' : words.coming.description(formatMoney(forecast.received), dayLabel(firstDayOf(first)), dayLabel(lastDayOf(last))),
  }
}

function monthBars(months: readonly MonthKey[], series: readonly BarSeries[], tokens: ChartTokens, phone: boolean): ChartOption {
  return {
    grid: { top: 16, right: 16 },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (points: unknown) => axisTooltip({ tokens, categoryLabel: monthAxisLabel('long') })(shownPoints(points)),
    },
    xAxis: { type: 'category', data: [...months], axisLabel: monthAxisLabels(months, tokens, phone) },
    yAxis: { type: 'value', axisLabel: moneyAxisLabel(tokens) },
    series: [...series],
  }
}
