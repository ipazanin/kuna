import type { PriceHistory, TradeMark } from '../domain/priceHistory'
import { WORKED_OUT_PRICE_PLACES } from './holdingText'
import { words } from './words'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { monthOf } from '../../../../shared/calendar/monthKey'
import { monthAxisLabel } from '../../../../shared/calendar/monthLabel'
import { tokenColour } from '../../../../shared/charts/chartTokens'
import type { ChartTokens } from '../../../../shared/charts/chartTokens'
import { axisTooltip } from '../../../../shared/charts/chartTooltip'
import type { ChartOption, LineSeries } from '../../../../shared/charts/echarts'
import { monthAxisLabels, shownPoints } from '../../../../shared/charts/monthAxis'
import type { CurrencyCode } from '../../../../shared/money/currencyCode'
import { DECIMAL_ZERO, decimalOfNumber, decimalText } from '../../../../shared/money/decimal'
import type { Decimal } from '../../../../shared/money/decimal'
import { formatUnitPrice } from '../../../../shared/money/moneyFormat'
import { plural } from '../../../../shared/text/translation'

export interface PriceChart {
  readonly option: ChartOption
  readonly description: string
  /** How the table view and the axis write a close, in the quote currency. */
  readonly formatPrice: (price: number) => string
  /** The trades the chart draws, which leaves out a trade in a month before the first close. */
  readonly marks: readonly TradeMark[]
}

/** As many places as a unit price shows, so a chart value written back is the close it came from. */
const PRICE_PLACES = 6

/**
 * The close at each month end as a blue line, the average cost as a dashed grey rule across it, a dot on each buy
 * and a hollow dot on each sale, at the trade's month and price. A canvas takes plain numbers, so the decimals become
 * numbers here and only for drawing.
 */
export function priceChart(history: PriceHistory, averageCost: Decimal | null, currency: CurrencyCode, tokens: ChartTokens, phone: boolean): PriceChart {
  const months = history.points.map((point) => monthOf(point.date))
  const portfolio = tokenColour('--invest-portfolio')
  const reference = tokenColour('--invest-reference')
  const drawn = (price: Decimal): number => Number(decimalText(price))
  const formatPrice = (price: number): string => formatUnitPrice(decimalOfNumber(price, PRICE_PLACES) ?? DECIMAL_ZERO, currency)
  const shown = new Set(months)
  const marks = history.marks.filter((mark) => shown.has(monthOf(mark.trade.date)))
  const price: LineSeries = {
    type: 'line',
    name: words.chart.price,
    color: portfolio,
    showSymbol: history.points.length === 1,
    lineStyle: { width: 2 },
    data: history.points.map((point) => drawn(point.price)),
    ...(averageCost === null
      ? {}
      : { markLine: { silent: true, symbol: 'none', lineStyle: { color: reference, type: [5, 4], width: 2 }, label: { show: false }, data: [{ yAxis: drawn(averageCost) }] } }),
    markPoint: {
      silent: true,
      symbol: 'circle',
      symbolSize: 8,
      label: { show: false },
      data: marks.map((mark) => ({
        name: '',
        coord: [monthOf(mark.trade.date), drawn(mark.price)],
        itemStyle: mark.trade.side === 'buy' ? { color: portfolio, borderColor: tokens.surface, borderWidth: 2 } : { color: tokens.surface, borderColor: portfolio, borderWidth: 2 },
      })),
    },
  }
  const bounds = axisBounds([...history.points.map((point) => drawn(point.price)), ...marks.map((mark) => drawn(mark.price)), ...(averageCost === null ? [] : [drawn(averageCost)])])
  const first = history.points[0]
  const last = history.points.at(-1)
  return {
    option: {
      grid: { top: 24, right: 16 },
      tooltip: {
        trigger: 'axis',
        formatter: (points: unknown) => axisTooltip({ tokens, categoryLabel: monthAxisLabel('long'), formatAmount: formatPrice })(shownPoints(points)),
      },
      xAxis: { type: 'category', boundaryGap: false, data: months, axisLabel: monthAxisLabels(months, tokens, phone) },
      yAxis: {
        type: 'value',
        ...bounds,
        axisLabel: { color: tokens.inkMuted, fontSize: 11, formatter: formatPrice },
      },
      series: [price],
    },
    description:
      first === undefined || last === undefined
        ? words.chart.emptyDescription
        : words.chart.description(dayLabel(first.date), dayLabel(last.date), formatUnitPrice(first.price, currency), formatUnitPrice(last.price, currency)) +
          (averageCost === null ? '' : words.chart.averageCostLine(formatUnitPrice(averageCost, currency, WORKED_OUT_PRICE_PLACES))) +
          (marks.length === 0 ? '' : plural(words.chart.trades(marks.length), marks.length)),
    formatPrice,
    marks,
  }
}

/** Round bounds a whole step apart that hold the closes, the marks and the rule, which an axis left to itself fits to the closes alone. */
function axisBounds(values: readonly number[]): { min: number; max: number; interval: number } | { scale: true } {
  if (values.length === 0) {
    return { scale: true }
  }
  const lowest = Math.min(...values)
  const highest = Math.max(...values)
  const rough = (highest - lowest || Math.abs(highest) || 1) / 4
  const power = 10 ** Math.floor(Math.log10(rough))
  const step = [1, 2, 5, 10].map((factor) => factor * power).find((candidate) => candidate >= rough) ?? 10 * power
  return { min: Math.floor(lowest / step) * step, max: Math.ceil(highest / step) * step, interval: step }
}
