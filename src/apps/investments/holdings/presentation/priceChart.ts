import type { HoldingFigures } from '../domain/holding'
import type { PriceHistory, PricePoint, TradeDot } from '../domain/priceHistory'
import { changeSince } from '../../compare/domain/comparedLine'
import type { ComparedLine } from '../../compare/domain/comparedLine'
import { changeAxisLabel, comparedLegend, comparedSeries } from '../../compare/presentation/comparedSeries'
import { words as compareWords } from '../../compare/presentation/words'
import type { TradeSide } from '../../workbook/domain/trade'
import { QUANTITY_PLACES, averageCostText } from './holdingText'
import { words } from './words'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { monthOf } from '../../../../shared/calendar/monthKey'
import { monthAxisLabel } from '../../../../shared/calendar/monthLabel'
import { tokenColour } from '../../../../shared/charts/chartTokens'
import type { ChartTokens } from '../../../../shared/charts/chartTokens'
import { axisTooltip } from '../../../../shared/charts/chartTooltip'
import { dayAxisLabels, dayOfCategory } from '../../../../shared/charts/dayAxis'
import type { ChartOption, LineSeries, ScatterSeries } from '../../../../shared/charts/echarts'
import { monthAxisLabels, shownPoints } from '../../../../shared/charts/monthAxis'
import type { CurrencyCode } from '../../../../shared/money/currencyCode'
import { DECIMAL_ZERO, decimalOfNumber, decimalText, sumDecimal } from '../../../../shared/money/decimal'
import type { Decimal } from '../../../../shared/money/decimal'
import { ZERO, sumMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import { formatCurrencyAmount, formatMoney, formatPercentChange, formatQuantity, formatUnitPrice } from '../../../../shared/money/moneyFormat'
import { plural } from '../../../../shared/text/translation'
import type { LegendEntry } from '../../../../shared/ui/ChartLegend.vue'

/** A point of the table view: its close, or with a comparison on its change and the compared change, and its buys and its sales as their dots' units at their price and amount. */
export interface PriceRow {
  readonly label: string
  readonly close: string
  readonly compared: string | null
  readonly bought: string | null
  readonly sold: string | null
}

export interface PriceChart {
  readonly option: ChartOption
  readonly description: string
  /** What the line shows: daily or month-end closes as quoted, or the change since the first day, with what the dots mean. */
  readonly subtitle: string
  /** The line, the average cost or the compared line, and the sides of the trades the chart draws. */
  readonly legend: readonly LegendEntry[]
  /** The table view, point by point, with a column for the compared line and for each side the chart draws. */
  readonly table: {
    /** What a row is, a day or a month, for a screen reader. */
    readonly rowHeading: string
    readonly lineHeading: string
    readonly comparedHeading: string | null
    readonly buys: boolean
    readonly sales: boolean
    readonly rows: readonly PriceRow[]
  }
}

/** As many places as a unit price shows, so a chart value written back is the close it came from. */
const PRICE_PLACES = 6

/** The diameter of the dot of the largest amount on a chart, and the least any dot gets, in pixels. */
const LARGEST_DOT = 22
const SMALLEST_DOT = 6

/** The trades of a dot its tooltip names one by one, before a line for the rest. */
const TRADES_NAMED = 3

/** How far from a dot, as a share of a daily line's closes, a tooltip still names its trades: about a large dot's width. */
const REACH = 0.01
const REACH_ON_A_PHONE = 0.04

/**
 * The close at each point as a blue line, the average cost as a dashed grey rule across it, and each point's buys as a
 * filled dot and its sales as a ring, at the price they came to and sized by their amount. A point is a day on a daily
 * line and a month end on a monthly one. With a ticker compared, the line and the dots read as change since the first
 * point, beside the ticker's change as a dashed grey line, and the average cost is left out. A canvas takes plain
 * numbers, so the decimals become numbers here and only for drawing.
 */
export function priceChart(history: PriceHistory, holding: Pick<HoldingFigures, 'instrument' | 'averageCost'>, tokens: ChartTokens, phone: boolean, compared: ComparedLine | null = null): PriceChart {
  const { instrument } = holding
  const { currency } = instrument
  const { daily, points } = history
  const categories: string[] = points.map((point) => (daily ? point.date : monthOf(point.date)))
  const categoryLabel = daily ? dayOfCategory : monthAxisLabel('long')
  const first = points[0]
  const last = points.at(-1)
  const drawn = (price: Decimal): number => Number(decimalText(price))
  const firstPrice = first === undefined ? 0 : drawn(first.price)
  const comparing = compared !== null && first !== undefined && last !== undefined && firstPrice > 0
  const onAxis = (price: Decimal): number => (comparing ? changeSince(firstPrice, drawn(price)) : drawn(price))
  const formatPrice = (price: number): string => formatUnitPrice(decimalOfNumber(price, PRICE_PLACES) ?? DECIMAL_ZERO, currency)
  const averageCost = comparing ? null : holding.averageCost
  const averageText = averageCost === null ? null : averageCostText(holding)
  const lineName = comparing ? instrument.symbol || instrument.name : words.chart.price
  const largest = history.dots.reduce((most, dot) => (dot.amount > most ? dot.amount : most), ZERO)
  const price: LineSeries = {
    type: 'line',
    name: lineName,
    color: tokenColour('--invest-portfolio'),
    showSymbol: points.length === 1,
    lineStyle: { width: 2 },
    data: points.map((point) => onAxis(point.price)),
    ...(averageCost === null
      ? {}
      : {
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { color: tokenColour('--invest-reference'), type: [5, 4], width: 2 },
            label: { show: false },
            data: [{ yAxis: drawn(averageCost) }],
          },
        }),
  }
  const dotSeries = (side: TradeSide): ScatterSeries[] => {
    const dots = new Map(history.dots.filter((dot) => dot.side === side).map((dot) => [dot.date, dot]))
    if (dots.size === 0) return []
    return [
      {
        type: 'scatter',
        name: side === 'buy' ? words.chart.buy : words.chart.sale,
        silent: true,
        symbol: 'circle',
        // A ring is hollow and drawn over the dots, so a buy and a sale of one point both show.
        z: side === 'buy' ? 3 : 4,
        itemStyle:
          side === 'buy' ? { color: tokenColour('--invest-buy'), borderColor: tokens.surface, borderWidth: 1 } : { color: 'transparent', borderColor: tokenColour('--invest-sale'), borderWidth: 2 },
        data: points.map((point) => {
          const dot = dots.get(point.date)
          return dot === undefined ? '-' : { value: onAxis(dot.price), symbolSize: markSize(dot.amount, largest) }
        }),
      },
    ]
  }
  // A day on a long daily line is narrower than a finger, so its tooltip names the trades of the nearest dot within reach, under that dot's day.
  const reach = daily ? Math.ceil(points.length * (phone ? REACH_ON_A_PHONE : REACH)) : 0
  const placeOf = new Map(points.map((point, place) => [point.date, place]))
  const linesOf = (category: string): string[] => {
    const hovered = categories.indexOf(category)
    const distance = (place: number): number => Math.abs(place - hovered)
    const nearest = history.dots
      .map((dot) => placeOf.get(dot.date)!)
      .filter((place) => hovered >= 0 && distance(place) <= reach)
      .sort((one, other) => distance(one) - distance(other))[0]
    if (nearest === undefined) return []
    const day = points[nearest]!.date
    const traded = history.dots.filter((dot) => dot.date === day).flatMap((dot) => dotLines(dot, currency))
    return nearest === hovered ? traded : [dayLabel(day), ...traded]
  }
  const lines = comparing ? [lineName, compared.name] : [lineName]
  const bounds = axisBounds([
    ...points.map((point) => onAxis(point.price)),
    ...history.dots.map((dot) => onAxis(dot.price)),
    ...(averageCost === null ? [] : [drawn(averageCost)]),
    ...(comparing ? compared.change : []),
  ])
  const sides = new Set(history.dots.map((dot) => dot.side))
  const trades = history.dots.reduce((count, dot) => count + dot.marks.length, 0)
  // A dot of one trade shows its price as the tooltip does, and a dot of several the average they came to, to the cent as a cost.
  const dotCell = (point: PricePoint, side: TradeSide): string | null => {
    const dot = history.dots.find((candidate) => candidate.date === point.date && candidate.side === side)
    if (dot === undefined) return null
    const price = dot.marks.length === 1 ? formatUnitPrice(dot.price, currency) : formatCurrencyAmount(dot.price, currency)
    return words.chart.dot(unitsText(dot.units), price, formatMoney(dot.amount))
  }
  const ourChange = comparing ? onAxis(last.price) : 0
  const dotsLine = trades === 0 ? '' : `${plural(words.chart.trades(trades, daily ? words.chart.periods.day : words.chart.periods.month), trades)} ${words.chart.dotSize}`
  return {
    option: {
      grid: { top: 24, right: 16 },
      tooltip: {
        trigger: 'axis',
        // A point with trades has a wider tooltip than its neighbours, and sliding it over from one of them carries it past a phone's edge.
        transitionDuration: 0,
        formatter: (shown: unknown) =>
          axisTooltip({ tokens, categoryLabel, formatAmount: comparing ? formatPercentChange : formatPrice, footnotes: linesOf })(
            (shownPoints(shown) as { seriesName?: string }[]).filter((point) => lines.includes(point.seriesName ?? '')),
          ),
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: categories,
        axisLabel: daily
          ? dayAxisLabels(
              points.map((point) => point.date),
              tokens,
              phone,
            )
          : monthAxisLabels(
              points.map((point) => monthOf(point.date)),
              tokens,
              phone,
            ),
      },
      yAxis: { type: 'value', ...bounds, axisLabel: comparing ? changeAxisLabel(tokens) : { color: tokens.inkMuted, fontSize: 11, formatter: formatPrice } },
      series: [price, ...(comparing ? [comparedSeries(compared)] : []), ...dotSeries('buy'), ...dotSeries('sell')],
    },
    description:
      first === undefined || last === undefined
        ? words.chart.emptyDescription
        : (comparing
            ? compareWords.chartDescription(dayLabel(first.date), dayLabel(last.date), lineName, formatPercentChange(ourChange), compared.name, formatPercentChange(compared.change.at(-1) ?? 0))
            : (daily ? words.chart.dailyDescription : words.chart.description)(
                dayLabel(first.date),
                dayLabel(last.date),
                formatUnitPrice(first.price, currency),
                formatUnitPrice(last.price, currency),
              ) + (averageText === null ? '' : words.chart.averageCostLine(averageText))) + dotsLine,
    subtitle: [
      comparing ? compareWords.sinceAsQuoted(dayLabel(first.date)) : (daily ? words.chart.dailySubtitle : words.chart.subtitle)(currency),
      history.dots.length === 0 ? null : words.chart.dotSize,
    ]
      .filter((part) => part !== null)
      .join(' '),
    legend: [
      { label: lineName, colour: 'var(--invest-portfolio)', mark: 'line' },
      ...(comparing ? [comparedLegend(compared)] : []),
      ...(averageText === null ? [] : [{ label: words.chart.averageCost(averageText), colour: 'var(--invest-reference)', mark: 'dashed' as const }]),
      ...(sides.has('buy') ? [{ label: words.chart.buy, colour: 'var(--invest-buy)', mark: 'dot' as const }] : []),
      ...(sides.has('sell') ? [{ label: words.chart.sale, colour: 'var(--invest-sale)', mark: 'ring' as const }] : []),
    ],
    table: {
      rowHeading: daily ? words.chart.dayHeading : words.chart.monthHeading,
      lineHeading: lineName,
      comparedHeading: comparing ? compared.name : null,
      buys: sides.has('buy'),
      sales: sides.has('sell'),
      rows: points.map((point, place) => ({
        label: categoryLabel(categories[place]!),
        close: comparing ? formatPercentChange(onAxis(point.price)) : formatUnitPrice(point.price, currency),
        compared: comparing ? formatPercentChange(compared.change[place] ?? 0) : null,
        bought: dotCell(point, 'buy'),
        sold: dotCell(point, 'sell'),
      })),
    },
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
