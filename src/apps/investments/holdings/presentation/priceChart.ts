import type { HoldingFigures } from '../domain/holding'
import type { PriceHistory, TradeDot } from '../domain/priceHistory'
import type { TradeSide } from '../../workbook/domain/trade'
import { QUANTITY_PLACES, averageCostText } from './holdingText'
import { words } from './words'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { monthOf } from '../../../../shared/calendar/monthKey'
import { monthAxisLabel } from '../../../../shared/calendar/monthLabel'
import { tokenColour } from '../../../../shared/charts/chartTokens'
import type { ChartTokens } from '../../../../shared/charts/chartTokens'
import { axisTooltip } from '../../../../shared/charts/chartTooltip'
import type { ChartOption, LineSeries, ScatterSeries } from '../../../../shared/charts/echarts'
import { monthAxisLabels, shownPoints } from '../../../../shared/charts/monthAxis'
import type { CurrencyCode } from '../../../../shared/money/currencyCode'
import { DECIMAL_ZERO, decimalOfNumber, decimalText, sumDecimal } from '../../../../shared/money/decimal'
import type { Decimal } from '../../../../shared/money/decimal'
import { ZERO, sumMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import { formatMoney, formatQuantity, formatUnitPrice } from '../../../../shared/money/moneyFormat'
import { plural } from '../../../../shared/text/translation'
import type { LegendEntry } from '../../../../shared/ui/ChartLegend.vue'

export interface PriceChart {
  readonly option: ChartOption
  readonly description: string
  /** How the table view and the axis write a close, in the quote currency. */
  readonly formatPrice: (price: number) => string
  /** The line, the average cost and the sides of the trades the chart draws. */
  readonly legend: readonly LegendEntry[]
}

/** As many places as a unit price shows, so a chart value written back is the close it came from. */
const PRICE_PLACES = 6

/** The diameter of the dot of the largest amount on a chart, and the least any dot gets, in pixels. */
const LARGEST_DOT = 22
const SMALLEST_DOT = 6

/** The trades of a dot its tooltip names one by one, before a line for the rest. */
const TRADES_NAMED = 3

/**
 * The close at each month end as a blue line, the average cost as a dashed grey rule across it, and each month's buys
 * as a filled dot and its sales as a ring, at the price they came to and sized by their amount. A canvas takes plain
 * numbers, so the decimals become numbers here and only for drawing.
 */
export function priceChart(history: PriceHistory, holding: Pick<HoldingFigures, 'instrument' | 'averageCost' | 'valuation'>, tokens: ChartTokens, phone: boolean): PriceChart {
  const { averageCost } = holding
  const { currency } = holding.instrument
  const months = history.points.map((point) => monthOf(point.date))
  const portfolio = tokenColour('--invest-portfolio')
  const reference = tokenColour('--invest-reference')
  const drawn = (price: Decimal): number => Number(decimalText(price))
  const formatPrice = (price: number): string => formatUnitPrice(decimalOfNumber(price, PRICE_PLACES) ?? DECIMAL_ZERO, currency)
  const averageText = averageCostText(holding)
  const largest = history.dots.reduce((most, dot) => (dot.amount > most ? dot.amount : most), ZERO)
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
  }
  const dotSeries = (side: TradeSide): ScatterSeries[] => {
    const dots = new Map(history.dots.filter((dot) => dot.side === side).map((dot) => [dot.month, dot]))
    if (dots.size === 0) return []
    return [
      {
        type: 'scatter',
        name: side === 'buy' ? words.chart.buy : words.chart.sale,
        silent: true,
        symbol: 'circle',
        // A ring is hollow and drawn over the dots, so a buy and a sale of one month both show.
        z: side === 'buy' ? 3 : 4,
        itemStyle:
          side === 'buy' ? { color: tokenColour('--invest-buy'), borderColor: tokens.surface, borderWidth: 1 } : { color: 'transparent', borderColor: tokenColour('--invest-sale'), borderWidth: 2 },
        data: months.map((month) => {
          const dot = dots.get(month)
          return dot === undefined ? '-' : { value: drawn(dot.price), symbolSize: markSize(dot.amount, largest) }
        }),
      },
    ]
  }
  const linesOf = (month: string): string[] => history.dots.filter((dot) => dot.month === month).flatMap((dot) => dotLines(dot, currency))
  const bounds = axisBounds([...history.points.map((point) => drawn(point.price)), ...history.dots.map((dot) => drawn(dot.price)), ...(averageCost === null ? [] : [drawn(averageCost)])])
  const sides = new Set(history.dots.map((dot) => dot.side))
  const trades = history.dots.reduce((count, dot) => count + dot.marks.length, 0)
  const first = history.points[0]
  const last = history.points.at(-1)
  return {
    option: {
      grid: { top: 24, right: 16 },
      tooltip: {
        trigger: 'axis',
        // A month with trades has a wider tooltip than its neighbours, and sliding it over from one of them carries it past a phone's edge.
        transitionDuration: 0,
        formatter: (points: unknown) =>
          axisTooltip({ tokens, categoryLabel: monthAxisLabel('long'), formatAmount: formatPrice, footnotes: linesOf })(
            (shownPoints(points) as { seriesName?: string }[]).filter((point) => point.seriesName === words.chart.price),
          ),
      },
      xAxis: { type: 'category', boundaryGap: false, data: months, axisLabel: monthAxisLabels(months, tokens, phone) },
      yAxis: {
        type: 'value',
        ...bounds,
        axisLabel: { color: tokens.inkMuted, fontSize: 11, formatter: formatPrice },
      },
      series: [price, ...dotSeries('buy'), ...dotSeries('sell')],
    },
    description:
      first === undefined || last === undefined
        ? words.chart.emptyDescription
        : words.chart.description(dayLabel(first.date), dayLabel(last.date), formatUnitPrice(first.price, currency), formatUnitPrice(last.price, currency)) +
          (averageText === null ? '' : words.chart.averageCostLine(averageText)) +
          (trades === 0 ? '' : `${plural(words.chart.trades(trades), trades)} ${words.chart.dotSize}`),
    formatPrice,
    legend: [
      { label: words.chart.price, colour: 'var(--invest-portfolio)', mark: 'line' },
      ...(averageText === null ? [] : [{ label: words.chart.averageCost(averageText), colour: 'var(--invest-reference)', mark: 'dashed' as const }]),
      ...(sides.has('buy') ? [{ label: words.chart.buy, colour: 'var(--invest-buy)', mark: 'dot' as const }] : []),
      ...(sides.has('sell') ? [{ label: words.chart.sale, colour: 'var(--invest-sale)', mark: 'ring' as const }] : []),
    ],
  }
}

/** A dot's diameter in pixels: its area grows with its amount against the largest on the chart, and it never shrinks out of sight. */
export function markSize(amount: Money, largest: Money): number {
  return largest <= 0 ? SMALLEST_DOT : Math.max(SMALLEST_DOT, LARGEST_DOT * Math.sqrt(amount / largest))
}

/** What the tooltip says of a dot: its first trades a line each, and the rest in one line, so a month of many buys stays short. */
export function dotLines(dot: TradeDot, currency: CurrencyCode): string[] {
  const named = dot.marks.slice(0, TRADES_NAMED)
  const rest = dot.marks.slice(TRADES_NAMED)
  const line = dot.side === 'buy' ? words.chart.bought : words.chart.sold
  return [
    ...named.map((mark) => line(unitsText(mark.units), formatUnitPrice(mark.price, currency), formatMoney(mark.amount))),
    ...(rest.length === 0 ? [] : [words.chart.more(rest.length, unitsText(sumDecimal(rest.map((mark) => mark.units))), formatMoney(sumMoney(rest.map((mark) => mark.amount))))]),
  ]
}

function unitsText(units: Decimal): string {
  const count = Number(decimalText(units))
  return plural(words.chart.units(count, formatQuantity(units, QUANTITY_PLACES)), count)
}

/** Round bounds a whole step apart that hold the closes, the dots and the rule, which an axis left to itself fits to the closes alone. */
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
