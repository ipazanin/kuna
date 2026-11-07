import type { HoldingFigures } from '../domain/holding'
import type { PriceHistory, PricePoint, TradeDot } from '../domain/priceHistory'
import { changeSince } from '../../compare/domain/comparedLine'
import type { ComparedLine } from '../../compare/domain/comparedLine'
import { changeAxisLabel, comparedLegend, comparedSeries, formatChartChange } from '../../compare/presentation/comparedSeries'
import { words as compareWords } from '../../compare/presentation/words'
import type { TradeSide } from '../../workbook/domain/trade'
import { QUANTITY_PLACES, averageCostText } from './holdingText'
import { words } from './words'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { monthOf } from '../../../../shared/calendar/monthKey'
import { monthAxisLabel } from '../../../../shared/calendar/monthLabel'
import { DOT_SIZE, dotLinesAt, dotOffset, namedFirst } from '../../../../shared/charts/chartDots'
import { tokenColour } from '../../../../shared/charts/chartTokens'
import type { ChartTokens } from '../../../../shared/charts/chartTokens'
import { axisTooltip } from '../../../../shared/charts/chartTooltip'
import { dayAxisLabels, dayOfCategory } from '../../../../shared/charts/dayAxis'
import type { ChartOption, LineSeries, ScatterSeries } from '../../../../shared/charts/echarts'
import { monthAxisLabels, shownPoints } from '../../../../shared/charts/monthAxis'
import type { CurrencyCode } from '../../../../shared/money/currencyCode'
import { DECIMAL_ZERO, decimalOfNumber, decimalText, sumDecimal } from '../../../../shared/money/decimal'
import type { Decimal } from '../../../../shared/money/decimal'
import { sumMoney } from '../../../../shared/money/money'
import { formatCurrencyAmount, formatMoney, formatPercentChange, formatQuantity, formatUnitPrice } from '../../../../shared/money/moneyFormat'
import { plural } from '../../../../shared/text/translation'
import type { LegendEntry } from '../../../../shared/ui/ChartLegend.vue'
import { shareFromRatio, ZERO_SHARE } from '../../../../shared/money/percent'

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

/**
 * The close at each point as a blue line, the average cost as a dashed grey rule across it, and each point's buys as one
 * dot and its sales as another of one size, told apart by colour, at the price they came to. A point is a day on a daily
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
  const bought = new Set(history.dots.filter((dot) => dot.side === 'buy').map((dot) => dot.date))
  const bothSides = new Set(history.dots.filter((dot) => dot.side === 'sell' && bought.has(dot.date)).map((dot) => dot.date))
  const dotSeries = (side: TradeSide): ScatterSeries[] => {
    const dots = new Map(history.dots.filter((dot) => dot.side === side).map((dot) => [dot.date, dot]))
    if (dots.size === 0) return []
    return [
      {
        type: 'scatter',
        name: side === 'buy' ? words.chart.buy : words.chart.sale,
        silent: true,
        symbol: 'circle',
        symbolSize: DOT_SIZE,
        z: 3,
        itemStyle: { color: tokenColour(side === 'buy' ? '--invest-buy' : '--invest-sale'), borderColor: tokens.surface, borderWidth: 1 },
        data: points.map((point) => {
          const dot = dots.get(point.date)
          return dot === undefined ? '-' : { value: onAxis(dot.price), symbolOffset: dotOffset(bothSides.has(point.date), side === 'buy') }
        }),
      },
    ]
  }
  const placeOf = new Map(points.map((point, place) => [point.date, place]))
  const linesOf = dotLinesAt(
    categories,
    history.dots.map((dot) => ({ place: placeOf.get(dot.date)!, lines: dotLines(dot, currency) })),
  )
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
  const ourChange = shareFromRatio(comparing ? onAxis(last.price) : 0)
  const dotsLine = trades === 0 ? '' : plural(words.chart.trades(trades, daily ? words.chart.periods.day : words.chart.periods.month), trades)
  return {
    option: {
      grid: { top: 24, right: 16 },
      tooltip: {
        trigger: 'axis',
        // A point with trades has a wider tooltip than its neighbours, and sliding it over from one of them carries it past a phone's edge.
        transitionDuration: 0,
        formatter: (shown: unknown) =>
          axisTooltip({ tokens, categoryLabel, formatAmount: comparing ? formatChartChange : formatPrice, footnotes: linesOf })(
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
            ? compareWords.chartDescription(
                dayLabel(first.date),
                dayLabel(last.date),
                lineName,
                formatPercentChange(ourChange),
                compared.name,
                formatPercentChange(compared.change.at(-1) ?? ZERO_SHARE),
              )
            : (daily ? words.chart.dailyDescription : words.chart.description)(
                dayLabel(first.date),
                dayLabel(last.date),
                formatUnitPrice(first.price, currency),
                formatUnitPrice(last.price, currency),
              ) + (averageText === null ? '' : words.chart.averageCostLine(averageText))) + dotsLine,
    subtitle: comparing ? compareWords.sinceAsQuoted(dayLabel(first.date)) : (daily ? words.chart.dailySubtitle : words.chart.subtitle)(currency),
    legend: [
      { label: lineName, colour: 'var(--invest-portfolio)', mark: 'line' },
      ...(comparing ? [comparedLegend(compared)] : []),
      ...(averageText === null ? [] : [{ label: words.chart.averageCost(averageText), colour: 'var(--invest-reference)', mark: 'dashed' as const }]),
      ...(sides.has('buy') ? [{ label: words.chart.buy, colour: 'var(--invest-buy)', mark: 'dot' as const }] : []),
      ...(sides.has('sell') ? [{ label: words.chart.sale, colour: 'var(--invest-sale)', mark: 'dot' as const }] : []),
    ],
    table: {
      rowHeading: daily ? words.chart.dayHeading : words.chart.monthHeading,
      lineHeading: lineName,
      comparedHeading: comparing ? compared.name : null,
      buys: sides.has('buy'),
      sales: sides.has('sell'),
      rows: points.map((point, place) => ({
        label: categoryLabel(categories[place]!),
        close: comparing ? formatPercentChange(shareFromRatio(onAxis(point.price))) : formatUnitPrice(point.price, currency),
        compared: comparing ? formatPercentChange(compared.change[place] ?? ZERO_SHARE) : null,
        bought: dotCell(point, 'buy'),
        sold: dotCell(point, 'sell'),
      })),
    },
  }
}

/** What the tooltip says of a dot: its first trades a line each, and the rest in one line, so a month of many buys stays short. */
export function dotLines(dot: TradeDot, currency: CurrencyCode): string[] {
  const line = dot.side === 'buy' ? words.chart.bought : words.chart.sold
  return namedFirst(
    dot.marks,
    (mark) => line(unitsText(mark.units), formatUnitPrice(mark.price, currency), formatMoney(mark.amount)),
    (rest) => words.chart.more(rest.length, unitsText(sumDecimal(rest.map((mark) => mark.units))), formatMoney(sumMoney(rest.map((mark) => mark.amount)))),
  )
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
