import { describe, expect, it, vi } from 'vitest'

import { changeAsQuoted, changeInEuros, comparedInstrument, comparedSourceOf, comparedSources, percentChange, tickerNamed } from '../src/apps/investments/compare/domain/comparedLine'
import { portfolioFigures } from '../src/apps/investments/holdings/domain/portfolioFigures'
import { priceHistory } from '../src/apps/investments/holdings/domain/priceHistory'
import { priceChart } from '../src/apps/investments/holdings/presentation/priceChart'
import { growthChart } from '../src/apps/investments/performance/presentation/growthChart'
import type { ChartTokens } from '../src/shared/charts/chartTokens'
import { formatPercentChange } from '../src/shared/money/moneyFormat'
import { BROKER, USD, book, cashMovement, priceBookOf, rateBookOf, split, trade, instrument } from './fixtures/investments'
import { civil } from './fixtures/ledger'
import { shareFromRatio } from '../src/shared/money/percent'

vi.stubGlobal('document', { documentElement: {} })
vi.stubGlobal('getComputedStyle', () => ({ getPropertyValue: (token: string) => token }))

const TOKENS = new Proxy({}, { get: (_target, name) => String(name) }) as unknown as ChartTokens

interface DrawnLine {
  name: string
  data: number[]
}

/** A made-up dollar ticker that closes at $1.10 and then $1.20, on days the dollar is 1.10 and then 1.20 to the euro. */
const ticker = comparedInstrument({ source: 'twelvedata', symbol: 'EXQ' }, USD)
const tickerSources = {
  book: book({}),
  prices: priceBookOf(
    new Map([
      [
        ticker,
        [
          ['2026-01-30', '1.10'],
          ['2026-02-27', '1.20'],
        ],
      ],
    ]),
  ),
  rates: rateBookOf(
    new Map([
      [
        USD,
        [
          ['2026-01-30', '1.10'],
          ['2026-02-27', '1.20'],
        ],
      ],
    ]),
  ),
  today: civil('2026-02-27'),
}
const DAYS = [civil('2026-01-30'), civil('2026-02-27')]

describe('the change since the first day', () => {
  it('reads lines from 100.00 to 110.00 and from 50.00 to 60.00 as +10.00% and +20.00%, to two places as every change', () => {
    expect(percentChange([100, 110]).map(formatPercentChange)).toEqual(['0.00%', '+10.00%'])
    expect(percentChange([50, 60]).map(formatPercentChange)).toEqual(['0.00%', '+20.00%'])
  })

  it('draws no change from a first point that is not above zero', () => {
    expect(percentChange([0, 10])).toEqual([])
    expect(percentChange([])).toEqual([])
  })

  it('reads a dollar ticker at $1.10 and $1.20 in euros on Performance, and as quoted on a holding', () => {
    // $1.10 ÷ 1.10 and $1.20 ÷ 1.20 are €1.00 both days, so nothing changed in euros, while 1.20 ÷ 1.10 − 1 is +9.09% in dollars.
    expect(changeInEuros(ticker, DAYS, tickerSources)?.map(formatPercentChange)).toEqual(['0.00%', '0.00%'])
    expect(changeAsQuoted(ticker, DAYS, tickerSources)?.map(formatPercentChange)).toEqual(['0.00%', '+9.09%'])
  })

  it('has no line while the first day has no close, and none in euros while a day has no rate', () => {
    expect(changeAsQuoted(ticker, [civil('2026-01-29'), ...DAYS], tickerSources)).toBeNull()
    expect(changeInEuros(ticker, DAYS, { ...tickerSources, rates: rateBookOf(new Map()) })).toBeNull()
  })

  it("counts the ticker's closes in today's units by the splits its vendor reported", () => {
    // A 2 for 1 split on 2 Feb makes the $1.10 of 30 Jan $0.55 today, so $1.20 is +118.18% on it.
    const notes = [{ series: 'twelvedata:EXQ', date: '2026-02-02', newUnits: '2', oldUnits: '1' }]
    expect(changeAsQuoted(ticker, DAYS, comparedSources(tickerSources, ticker, notes))?.map(formatPercentChange)).toEqual(['0.00%', '+118.18%'])
  })

  it('counts them by the split records of a holding priced by the same series, which win over what its vendor reported', () => {
    const held = instrument('held-exq', { symbol: 'EXQ', currency: USD, sourceSymbol: 'EXQ' })
    const recorded = { ...tickerSources, book: book({ instruments: [held], splits: [split(held, '2026-02-02', 2, 1)] }) }
    // The record's 2 for 1 gives +118.18% as above, and the vendor's noted 4 for 1 is left aside.
    const notes = [{ series: 'twelvedata:EXQ', date: '2026-02-02', newUnits: '4', oldUnits: '1' }]
    expect(changeAsQuoted(ticker, DAYS, comparedSources(recorded, ticker, notes))?.map(formatPercentChange)).toEqual(['0.00%', '+118.18%'])
  })
})

describe('the ticker Compare with names', () => {
  it('reads the address as a source and a symbol, and nothing else', () => {
    expect(tickerNamed('twelvedata:QQQ')).toEqual({ source: 'twelvedata', symbol: 'QQQ' })
    expect(tickerNamed('alphavantage:EXQ.DEX')).toEqual({ source: 'alphavantage', symbol: 'EXQ.DEX' })
    expect(tickerNamed('manual:QQQ')).toBeNull()
    expect(tickerNamed('finnhub:QQQ')).toBeNull()
    expect(tickerNamed('QQQ')).toBeNull()
    expect(tickerNamed('twelvedata:')).toBeNull()
    expect(tickerNamed(['twelvedata:QQQ'])).toBeNull()
  })

  it('prices a found listing by the first vendor that gives its closes, and none without one or a currency Kuna knows', () => {
    expect(comparedSourceOf({ sources: ['twelvedata', 'alphavantage'], currency: 'USD' })).toBe('twelvedata')
    expect(comparedSourceOf({ sources: [], currency: 'USD' })).toBeNull()
    expect(comparedSourceOf({ sources: ['twelvedata'], currency: null })).toBeNull()
    expect(comparedSourceOf({ sources: ['twelvedata'], currency: 'XXQ' })).toBeNull()
  })
})

describe("Performance's growth chart compared with a ticker", () => {
  const growth = [
    { date: civil('2026-01-30'), portfolio: 100, benchmark: 100 },
    { date: civil('2026-02-27'), portfolio: 110, benchmark: 104 },
  ]

  it('turns the portfolio from €100 into change and draws the ticker beside it in place of the benchmark', () => {
    const chart = growthChart(growth, 'Example Index Fund', TOKENS, false, { name: 'EXQ', change: [0, 0.2].map(shareFromRatio) })
    const series = (chart.option as { series: DrawnLine[] }).series
    expect(series.map((line) => line.name)).toEqual(['Your portfolio', 'EXQ'])
    expect(series[0]!.data.map((share) => formatPercentChange(shareFromRatio(share)))).toEqual(['0.00%', '+10.00%'])
    expect(chart.title).toBe('Change since 30 Jan 2026')
    expect(chart.formatValue(0.2)).toBe('+20.00%')
    expect(chart.description).toBe('From 30 Jan 2026 to 27 Feb 2026, your portfolio changed +10.00% and EXQ +20.00%.')
  })

  it('keeps €100 and the benchmark with nothing compared', () => {
    const chart = growthChart(growth, 'Example Index Fund', TOKENS, false)
    expect((chart.option as { series: DrawnLine[] }).series.map((line) => [line.name, line.data])).toEqual([
      ['Your portfolio', [10000, 11000]],
      ['Example Index Fund', [10000, 10400]],
    ])
    expect(chart.title).toBe('Growth of €100.00')
  })
})

describe("a holding's price chart compared with a ticker", () => {
  const fund = instrument('compare-fund', { name: 'Example Compare Fund', symbol: 'ECF' })
  const records = book({
    accounts: [BROKER],
    instruments: [fund],
    cashMovements: [cashMovement('deposit', BROKER, '2026-01-30', '1000')],
    trades: [trade('buy', BROKER, fund, '2026-01-30', '5', '100.00', '0')],
  })
  const sources = {
    book: records,
    prices: priceBookOf(
      new Map([
        [
          fund,
          [
            ['2026-01-30', '100.00'],
            ['2026-02-27', '110.00'],
          ],
        ],
      ]),
    ),
    rates: rateBookOf(new Map()),
    today: civil('2026-02-27'),
  }
  const holding = portfolioFigures(sources).holdings.find((figures) => figures.instrument.id === fund.id)!
  const chart = priceChart(priceHistory(holding, sources), holding, TOKENS, false, { name: 'EXQ', change: [0, 0.2].map(shareFromRatio) })

  it('reads the holding and the ticker as change since its first month end, with the buy on its line and no average cost', () => {
    const series = (chart.option as { series: { name: string; data: unknown[] }[] }).series
    expect(series.map((line) => line.name)).toEqual(['ECF', 'EXQ', 'Buy'])
    expect(series[0]!.data).toEqual([0, 0.10000000000000009])
    expect(chart.legend.map((entry) => entry.label)).toEqual(['ECF', 'EXQ', 'Buy'])
    expect(chart.subtitle).toBe('Change since 31 Jan 2026, each line as quoted.')
  })

  it('gives the table both changes beside the trades', () => {
    expect(chart.table.lineHeading).toBe('ECF')
    expect(chart.table.comparedHeading).toBe('EXQ')
    expect(chart.table.rows.map((row) => [row.label, row.close, row.compared])).toEqual([
      ['Jan 2026', '0.00%', '0.00%'],
      ['Feb 2026', '+10.00%', '+20.00%'],
    ])
  })
})
