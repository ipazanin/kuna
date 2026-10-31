import type { ValueOverTime } from '../domain/valueOverTime'
import { words } from './words'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { monthOf } from '../../../../shared/calendar/monthKey'
import { monthAxisLabel } from '../../../../shared/calendar/monthLabel'
import { moneyAxisLabel } from '../../../../shared/charts/chartTheme'
import { tokenColour } from '../../../../shared/charts/chartTokens'
import type { ChartTokens } from '../../../../shared/charts/chartTokens'
import { axisTooltip } from '../../../../shared/charts/chartTooltip'
import type { ChartOption, LineSeries } from '../../../../shared/charts/echarts'
import { monthAxisLabels, shownPoints } from '../../../../shared/charts/monthAxis'
import type { Money } from '../../../../shared/money/money'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import { listInWords } from '../../../../shared/text/listInWords'

export interface ValueChart {
  readonly option: ChartOption
  readonly description: string
}

/**
 * The value as a blue line with a wash under it, against a dashed grey step line of what was put in less what was
 * taken out, so the gap between them is the total gain at every month end. The last point is the figures' day.
 */
export function valueChart(over: ValueOverTime, tokens: ChartTokens, phone: boolean): ValueChart {
  const months = over.points.map((point) => monthOf(point.date))
  const portfolio = tokenColour('--invest-portfolio')
  const reference = tokenColour('--invest-reference')
  const gainOf = new Map<string, Money | null>(over.points.map((point) => [monthOf(point.date), point.gain]))
  const value: LineSeries = {
    type: 'line',
    name: words.value.value,
    color: portfolio,
    showSymbol: false,
    lineStyle: { width: 2 },
    areaStyle: { color: portfolio, opacity: 0.1 },
    data: over.points.map((point) => point.value),
  }
  const putIn: LineSeries = {
    type: 'line',
    name: words.value.putIn,
    color: reference,
    showSymbol: false,
    step: 'end',
    lineStyle: { width: 2, type: [5, 4] },
    data: over.points.map((point) => point.putIn),
  }
  const first = over.points[0]
  const last = [...over.points].reverse().find((point) => point.value !== null)
  const heldBack = listInWords(over.heldBack.instruments.map((instrument) => instrument.name))
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
            footnotes: (month) => {
              const gain = gainOf.get(month) ?? null
              return gain === null ? [] : [words.value.gain(formatMoney(gain, 'always'))]
            },
          })(shownPoints(points)),
      },
      xAxis: { type: 'category', boundaryGap: false, data: months, axisLabel: monthAxisLabels(months, tokens, phone) },
      yAxis: { type: 'value', axisLabel: moneyAxisLabel(tokens) },
      series: [value, putIn],
    },
    description:
      first === undefined || last === undefined
        ? words.value.emptyDescription
        : words.value.description(dayLabel(first.date), dayLabel(last.date), formatMoney(last.value ?? 0), formatMoney(last.putIn)) + (heldBack === '' ? '' : words.value.heldBack(heldBack)),
  }
}
