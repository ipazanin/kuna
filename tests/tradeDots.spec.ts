import { describe, expect, it, vi } from 'vitest'

import { portfolioFigures } from '../src/apps/investments/holdings/domain/portfolioFigures'
import { priceHistory } from '../src/apps/investments/holdings/domain/priceHistory'
import { averageCostText } from '../src/apps/investments/holdings/presentation/holdingText'
import { dotLines, priceChart } from '../src/apps/investments/holdings/presentation/priceChart'
import { DOT_SIZE } from '../src/shared/charts/chartDots'
import type { ChartTokens } from '../src/shared/charts/chartTokens'
import { EURO } from '../src/shared/money/currencyCode'
import { monthOf } from '../src/shared/calendar/monthKey'
import { decimalText } from '../src/shared/money/decimal'
import { BROKER, USD, WORKED_RATES, book, cashMovement, decimal, instrument, priceBookOf, trade } from './fixtures/investments'
import { civil, euros } from './fixtures/ledger'

vi.stubGlobal('document', { documentElement: {} })
vi.stubGlobal('getComputedStyle', () => ({ getPropertyValue: (token: string) => token }))

const TOKENS = new Proxy({}, { get: (_target, name) => String(name) }) as unknown as ChartTokens

// Example Dot Fund, bought five times in March 2026 and partly sold in April, every figure made up.
const dotFund = instrument('dot-fund', { name: 'Example Dot Fund' })
const records = book({
  accounts: [BROKER],
  instruments: [dotFund],
  cashMovements: [cashMovement('deposit', BROKER, '2026-03-02', '10000')],
  trades: [
    trade('buy', BROKER, dotFund, '2026-03-02', '3', '517.70', '1.00'),
    trade('buy', BROKER, dotFund, '2026-03-05', '2', '520.00', '1.00'),
    trade('buy', BROKER, dotFund, '2026-03-09', '1', '515.00', '1.00'),
    trade('buy', BROKER, dotFund, '2026-03-16', '4', '518.00', '1.00'),
    trade('buy', BROKER, dotFund, '2026-03-23', '3', '516.00', '1.00'),
    trade('sell', BROKER, dotFund, '2026-04-14', '3.5', '480.58', '1.00'),
  ],
})
const sources = {
  book: records,
  prices: priceBookOf(
    new Map([
      [
        dotFund,
        [
          ['2026-03-02', '517.70'],
          ['2026-03-31', '519.40'],
          ['2026-04-15', '481.25'],
        ],
      ],
    ]),
  ),
  rates: WORKED_RATES,
  today: civil('2026-04-15'),
}
const holding = portfolioFigures(sources).holdings.find((figures) => figures.instrument.id === dotFund.id)!
const history = priceHistory(holding, sources)

interface DrawnDots {
  name: string
  type: string
  symbolSize: number
  itemStyle: { color: string; borderColor: string; borderWidth: number }
  data: ('-' | { value: number; symbolOffset: [number, number] })[]
}

describe("a holding's trade dots", () => {
  it('merges the five March buys into one dot of 13 units and €6,728.10, and the April sale into another', () => {
    // 1,553.10 + 1,040.00 + 515.00 + 2,072.00 + 1,548.00 = 6,728.10, at 6,728.10 ÷ 13 = 517.546153846154 a unit.
    expect(history.dots.map((dot) => [dot.side, monthOf(dot.date), dot.marks.length, decimalText(dot.units), decimalText(dot.price), dot.amount])).toEqual([
      ['buy', '2026-03', 5, '13', '517.546153846154', euros(6728.1)],
      ['sell', '2026-04', 1, '3.5', '480.58', euros(1682.03)],
    ])
  })

  it('names the first three buys in the tooltip and sums the other two in one line', () => {
    expect(dotLines(history.dots[0]!, EURO)).toEqual([
      'Bought 3 units at €517.70 · €1,553.10',
      'Bought 2 units at €520.00 · €1,040.00',
      'Bought 1 unit at €515.00 · €515.00',
      'and 2 more, 7 units, €3,620.00 in all',
    ])
    expect(dotLines(history.dots[1]!, EURO)).toEqual(['Sold 3.5 units at €480.58 · €1,682.03'])
  })

  it('keeps a buy and a sale of one month as two dots, the buys first, each with its own units, price and amount', () => {
    const busyFund = instrument('busy-fund', { name: 'Example Busy Fund' })
    const busyRecords = book({
      accounts: [BROKER],
      instruments: [busyFund],
      cashMovements: [cashMovement('deposit', BROKER, '2026-03-02', '1000')],
      trades: [
        trade('buy', BROKER, busyFund, '2026-03-02', '4', '100.00', '0'),
        trade('sell', BROKER, busyFund, '2026-03-10', '1', '110.00', '0'),
        trade('buy', BROKER, busyFund, '2026-03-20', '1', '90.00', '0'),
      ],
    })
    const busySources = { ...sources, book: busyRecords, prices: priceBookOf(new Map([[busyFund, [['2026-03-02', '100.00']]]])), today: civil('2026-03-31') }
    const busyHolding = portfolioFigures(busySources).holdings.find((figures) => figures.instrument.id === busyFund.id)!
    const busyHistory = priceHistory(busyHolding, busySources)
    const busyDots = busyHistory.dots

    // The two buys are 400.00 + 90.00 = €490.00 for 5 units, €98.00 a unit.
    expect(busyDots.map((dot) => [dot.side, monthOf(dot.date), decimalText(dot.units), decimalText(dot.price), dot.amount])).toEqual([
      ['buy', '2026-03', '5', '98', euros(490)],
      ['sell', '2026-03', '1', '110', euros(110)],
    ])
    // One size is 10 px, so the buy sits 5 px left of the month and the sale 5 px right, edge to edge, and neither hides the other.
    const series = (priceChart(busyHistory, busyHolding, TOKENS, false).option as { series: DrawnDots[] }).series
    expect(series.slice(1).map((drawn) => [drawn.name, drawn.data])).toEqual([
      ['Buy', [{ value: 98, symbolOffset: [-5, 0] }]],
      ['Sale', [{ value: 110, symbolOffset: [5, 0] }]],
    ])
  })

  it('tells a screen reader how many trades the merged dots hold, and says nothing of their size', () => {
    const { description } = priceChart(history, holding, TOKENS, false)
    expect(description).toContain(" Dots show the 6 trades, a month's buys as one dot and its sales as another, each at the average price of its trades.")
    expect(description).not.toContain('size')
  })

  it("writes gold's average cost to the cent, though its close per gram, from dividing the close per ounce, runs to six places", () => {
    const goldBar = instrument('gold-bar', { name: 'Example gold bar', class: 'gold', quoted: { kind: 'gram' }, prices: 'manual', sourceSymbol: '' })
    const goldRecords = book({
      accounts: [BROKER],
      instruments: [goldBar],
      cashMovements: [cashMovement('deposit', BROKER, '2026-03-02', '1000')],
      trades: [trade('buy', BROKER, goldBar, '2026-03-02', '3', '82.40', '1.00')],
    })
    const goldSources = { ...sources, book: goldRecords, prices: priceBookOf(new Map([[goldBar, [['2026-03-02', '2650.00']]]])), today: civil('2026-03-31') }
    const goldHolding = portfolioFigures(goldSources).holdings.find((figures) => figures.instrument.id === goldBar.id)!

    // 2,650.00 ÷ 31.1034768 grams is €85.199... a gram, and the average of (247.20 + 1.00) ÷ 3 = €82.7333... shows as €82.73.
    expect(decimalText(goldHolding.valuation!.price).split('.')[1]!.length).toBeGreaterThanOrEqual(6)
    expect(averageCostText(goldHolding)).toBe('€82.73')
    expect(averageCostText({ ...goldHolding, averageCost: decimal('82.5') })).toBe('€82.50')
  })

  it('writes a dollar trade at its own price and its amount in euros at its rate', () => {
    const dollarCo = instrument('dollar-co', { currency: USD })
    const dollarRecords = book({
      accounts: [BROKER],
      instruments: [dollarCo],
      cashMovements: [cashMovement('deposit', BROKER, '2026-03-02', '1000', USD, '1.10')],
      trades: [trade('buy', BROKER, dollarCo, '2026-03-02', '2', '160.00', '1.00', '1.10')],
    })
    const dollarSources = { ...sources, book: dollarRecords, prices: priceBookOf(new Map([[dollarCo, [['2026-03-02', '160.00']]]])) }
    const dollarHolding = portfolioFigures(dollarSources).holdings.find((figures) => figures.instrument.id === dollarCo.id)!

    // $320.00 at 1.10 dollars to the euro is €290.91.
    expect(dotLines(priceHistory(dollarHolding, dollarSources).dots[0]!, USD)).toEqual(['Bought 2 units at $160.00 · €290.91'])
  })

  it('draws the buys and the sale as filled dots of one size at their months, told apart by colour, which the legend and the table name', () => {
    const chart = priceChart(history, holding, TOKENS, false)
    const series = (chart.option as { series: DrawnDots[] }).series

    expect(series.map((drawn) => [drawn.type, drawn.name])).toEqual([
      ['line', 'Price'],
      ['scatter', 'Buy'],
      ['scatter', 'Sale'],
    ])
    // The €6,728.10 buy and the €1,682.03 sale are one size, each alone on its month.
    expect(series.slice(1).map((drawn) => [drawn.symbolSize, drawn.itemStyle])).toEqual([
      [DOT_SIZE, { color: '--invest-buy', borderColor: 'surface', borderWidth: 1 }],
      [DOT_SIZE, { color: '--invest-sale', borderColor: 'surface', borderWidth: 1 }],
    ])
    expect(series[1]!.data).toEqual([{ value: 517.546153846154, symbolOffset: [0, 0] }, '-'])
    expect(series[2]!.data).toEqual(['-', { value: 480.58, symbolOffset: [0, 0] }])
    expect(chart.legend.map((entry) => [entry.label, entry.colour, entry.mark])).toEqual([
      ['Price', 'var(--invest-portfolio)', 'line'],
      // The sale closes the first buy and half a unit of the second, so 9.5 units cost 780.75 + 516.00 + 2,073.00 + 1,549.00 = €4,918.75 with
      // their fees, €517.763157… a unit, shown to the cent as every cost is.
      ['Average cost €517.76', 'var(--invest-reference)', 'dashed'],
      ['Buy', 'var(--invest-buy)', 'dot'],
      ['Sale', 'var(--invest-sale)', 'dot'],
    ])
  })

  it("gives the table each month's close and each dot's units at its price with its amount, as the tooltip does", () => {
    const chart = priceChart(history, holding, TOKENS, false)

    // The March dot's 13 units came to €6,728.10, €517.546… a unit shown to the cent, and the April sale is one trade at its own price.
    expect(chart.table).toEqual({
      rowHeading: 'Month',
      lineHeading: 'Price',
      comparedHeading: null,
      buys: true,
      sales: true,
      rows: [
        { label: 'Mar 2026', close: '€519.40', compared: null, bought: '13 units at €517.55 · €6,728.10', sold: null },
        { label: 'Apr 2026', close: '€481.25', compared: null, bought: null, sold: '3.5 units at €480.58 · €1,682.03' },
      ],
    })
  })
})

describe("a holding's daily line", () => {
  // Example Daily Fund, with a close on every weekday from 2 to 13 Mar 2026 but Monday 9 Mar, every figure made up.
  const dailyFund = instrument('daily-fund', { name: 'Example Daily Fund' })
  const dailyRecords = book({
    accounts: [BROKER],
    instruments: [dailyFund],
    cashMovements: [cashMovement('deposit', BROKER, '2026-03-02', '1000')],
    trades: [
      trade('buy', BROKER, dailyFund, '2026-03-02', '2', '100.00', '0'),
      trade('buy', BROKER, dailyFund, '2026-03-09', '1', '104.00', '0'),
      trade('sell', BROKER, dailyFund, '2026-03-11', '1', '107.00', '0'),
    ],
  })
  const closeDays = ['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06', '2026-03-10', '2026-03-11', '2026-03-12', '2026-03-13']
  const dailySources = {
    book: dailyRecords,
    prices: priceBookOf(new Map([[dailyFund, closeDays.map((day, place): readonly [string, string] => [day, `${100 + place}.00`])]])),
    rates: WORKED_RATES,
    today: civil('2026-03-13'),
  }
  const dailyHolding = portfolioFigures(dailySources).holdings.find((figures) => figures.instrument.id === dailyFund.id)!
  const daily = priceHistory(dailyHolding, dailySources)

  it('runs close by close once the series has a close on most weekdays, and month end by month end otherwise', () => {
    // 9 closes on the 10 weekdays from 2 to 13 Mar, against 3 closes on the 33 weekdays from 2 Mar to 15 Apr above.
    expect(daily.daily).toBe(true)
    expect(daily.points.map((point) => point.date)).toEqual(closeDays)
    expect(history.daily).toBe(false)
  })

  it("counts a sold holding's weekdays to its last trade, where the fetch stopped its series", () => {
    // Example Sold Fund, bought on 2 Mar 2026 and sold on 13 Mar with a close on each of those 10 weekdays, figures made up on 30 Oct 2026.
    const soldFund = instrument('sold-fund', { name: 'Example Sold Fund' })
    const soldDays = ['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06', '2026-03-09', '2026-03-10', '2026-03-11', '2026-03-12', '2026-03-13']
    const soldSources = {
      book: book({
        accounts: [BROKER],
        instruments: [soldFund],
        cashMovements: [cashMovement('deposit', BROKER, '2026-03-02', '1000')],
        trades: [trade('buy', BROKER, soldFund, '2026-03-02', '2', '100.00', '0'), trade('sell', BROKER, soldFund, '2026-03-13', '2', '109.00', '0')],
      }),
      prices: priceBookOf(new Map([[soldFund, soldDays.map((day, place): readonly [string, string] => [day, `${100 + place}.00`])]])),
      rates: WORKED_RATES,
      today: civil('2026-10-30'),
    }
    const soldHolding = portfolioFigures(soldSources).holdings.find((figures) => figures.instrument.id === soldFund.id)!
    const sold = priceHistory(soldHolding, soldSources)
    // 10 closes on the 10 weekdays to the sale, where 2 Mar to 30 Oct would hold 175 weekdays.
    expect(sold.daily).toBe(true)
    expect(sold.points.map((point) => point.date)).toEqual(soldDays)
    expect(sold.dots.map((dot) => [dot.side, dot.date])).toEqual([
      ['buy', '2026-03-02'],
      ['sell', '2026-03-13'],
    ])
  })

  it('dots each trade on its own day, and a trade on a day with no close on the close before it', () => {
    expect(daily.dots.map((dot) => [dot.side, dot.date, decimalText(dot.units), dot.amount])).toEqual([
      ['buy', '2026-03-02', '2', euros(200)],
      ['buy', '2026-03-06', '1', euros(104)],
      ['sell', '2026-03-11', '1', euros(107)],
    ])
  })

  it("names in a day's tooltip the trades of the nearest dot within reach, under that dot's day when it is not the day's own", () => {
    const tooltip = (priceChart(daily, dailyHolding, TOKENS, false).option as { tooltip: { formatter: (points: unknown) => string } }).tooltip.formatter
    const on = (day: string): string => tooltip([{ seriesName: 'Price', axisValueLabel: day, value: 100, color: 'blue' }])
    // Nine closes reach one close either side, so 3 Mar reaches the dot of 2 Mar, and 4 Mar, two closes from either dot, reaches none.
    expect(on('2026-03-06')).toContain('Bought 1 unit at €104.00 · €104.00')
    expect(on('2026-03-06')).not.toContain('margin-top:6px">6 Mar 2026</div>')
    expect(on('2026-03-03')).toContain('margin-top:6px">2 Mar 2026</div>')
    expect(on('2026-03-03')).toContain('Bought 2 units at €100.00 · €200.00')
    expect(on('2026-03-04')).not.toContain('Bought')
  })

  it('says the line is of daily closes, and gives the table a row a day', () => {
    const chart = priceChart(daily, dailyHolding, TOKENS, false)
    expect(chart.subtitle).toBe('Daily closes in EUR, as quoted. Dashed is your average cost.')
    expect(chart.table.rowHeading).toBe('Day')
    expect(chart.table.rows).toHaveLength(9)
    expect(chart.table.rows[0]).toEqual({ label: '2 Mar 2026', close: '€100.00', compared: null, bought: '2 units at €100.00 · €200.00', sold: null })
    expect(chart.description).toContain(" Dots show the 3 trades, a day's buys as one dot and its sales as another")
  })
})
