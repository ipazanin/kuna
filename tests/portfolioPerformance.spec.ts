import { describe, expect, it } from 'vitest'

import type { PortfolioSources } from '../src/apps/investments/holdings/domain/holding'
import { periodSpan } from '../src/apps/investments/performance/domain/performancePeriod'
import type { PerformancePeriod } from '../src/apps/investments/performance/domain/performancePeriod'
import { portfolioFigures } from '../src/apps/investments/holdings/domain/portfolioFigures'
import { performanceByYear, portfolioPerformance } from '../src/apps/investments/performance/domain/portfolioPerformance'
import type { PeriodPerformance } from '../src/apps/investments/performance/domain/portfolioPerformance'
import { largestFall, yearlyVolatility } from '../src/apps/investments/performance/domain/riskFigures'
import type { Instrument } from '../src/apps/investments/workbook/domain/instrument'
import type { InvestmentBook } from '../src/apps/investments/workbook/domain/investmentBook'
import type { CivilDate } from '../src/shared/calendar/civilDate'
import { addMonths, dayMonthsLater, lastDayOf, monthOf } from '../src/shared/calendar/monthKey'
import { decimalText, timesDecimal } from '../src/shared/money/decimal'
import { BROKER, STOCK_B, USD, WORKED_RATES, WORLD_ETF, book, cashMovement, decimal, instrument, priceBookOf, rateBookOf, split, trade, workedPortfolio } from './fixtures/investments'
import type { CloseRow } from './fixtures/investments'
import { civil, euros } from './fixtures/ledger'

const BENCHMARK = instrument('world-index', { name: 'World index' })
const FUND = instrument('fund-x', { name: 'Fund X' })
const LATE_FUND = instrument('fund-y', { name: 'Fund Y' })
const NO_RATES = rateBookOf(new Map())

function sourcesOf(records: InvestmentBook, closes: ReadonlyMap<Instrument, readonly CloseRow[]>, today: string): PortfolioSources {
  return { book: records, prices: priceBookOf(closes), rates: NO_RATES, today: civil(today) }
}

function figuresOf(sources: PortfolioSources, benchmark: Instrument | null = BENCHMARK, period: PerformancePeriod = { kind: 'all' }): PeriodPerformance {
  const performance = portfolioPerformance(sources, benchmark, period)
  if (performance.kind !== 'figures') {
    throw new Error(`Expected figures, got ${performance.kind}.`)
  }
  return performance
}

function rounded(share: number | null): number | null {
  return share === null ? null : Math.round(share * 1e9) / 1e9
}

describe('the benchmark', () => {
  it('shows a difference of zero for a portfolio holding only the benchmark', () => {
    const records = book({
      accounts: [BROKER],
      instruments: [BENCHMARK],
      cashMovements: [cashMovement('deposit', BROKER, '2025-01-02', '1000'), cashMovement('deposit', BROKER, '2025-02-14', '550'), cashMovement('withdrawal', BROKER, '2025-03-14', '600')],
      trades: [
        trade('buy', BROKER, BENCHMARK, '2025-01-02', '10', '100', '0'),
        trade('buy', BROKER, BENCHMARK, '2025-02-14', '5', '110', '0'),
        trade('sell', BROKER, BENCHMARK, '2025-03-14', '5', '120', '0'),
      ],
    })
    const closes = new Map<Instrument, readonly CloseRow[]>([
      [
        BENCHMARK,
        [
          ['2025-01-02', '100'],
          ['2025-01-31', '104'],
          ['2025-02-14', '110'],
          ['2025-02-28', '105'],
          ['2025-03-14', '120'],
          ['2025-03-31', '118'],
        ],
      ],
    ])
    const performance = figuresOf(sourcesOf(records, closes, '2025-03-31'))

    // 1.04 × 1,100 ÷ 1,040 × 1,575 ÷ 1,650 × 1,800 ÷ 1,575 × 1,180 ÷ 1,200 = 1.18, the index's own 118 ÷ 100.
    expect(performance.portfolio.timeWeighted.total).toBeCloseTo(0.18, 12)
    expect(performance.benchmark?.priceReturn.total).toBeCloseTo(0.18, 12)
    expect(performance.benchmark?.difference).toBeCloseTo(0, 12)
    // The replay buys 10 units, 5 more for the 550.00 and sells 5 for the 600.00, so it holds what the portfolio holds.
    expect(performance.benchmark?.replay.value).toBe(euros(1180))
    expect(performance.benchmark?.replay.unpaid).toEqual([])
    expect(performance.benchmark?.valueDifference).toBe(euros(0))
    expect(performance.growth.map((point) => [point.date, rounded(point.portfolio), rounded(point.benchmark)])).toEqual([
      ['2025-01-02', 100, 100],
      ['2025-01-31', 104, 104],
      ['2025-02-28', 105, 105],
      ['2025-03-31', 118, 118],
    ])
  })

  it("compares the index's own +32% with the portfolio, though the replay sold all of it for a withdrawal larger than it held", () => {
    const records = book({
      accounts: [BROKER],
      instruments: [FUND],
      cashMovements: [cashMovement('deposit', BROKER, '2025-01-02', '10000'), cashMovement('withdrawal', BROKER, '2025-06-02', '16000'), cashMovement('deposit', BROKER, '2025-09-01', '5000')],
      trades: [
        trade('buy', BROKER, FUND, '2025-01-02', '100', '100', '0'),
        trade('sell', BROKER, FUND, '2025-06-02', '100', '160', '0'),
        trade('buy', BROKER, FUND, '2025-09-01', '31.25', '160', '0'),
      ],
    })
    const closes = new Map<Instrument, readonly CloseRow[]>([
      [
        FUND,
        [
          ['2025-01-02', '100'],
          ['2025-06-02', '160'],
          ['2025-12-31', '176'],
        ],
      ],
      [
        BENCHMARK,
        [
          ['2025-01-02', '100'],
          ['2025-06-02', '130'],
          ['2025-09-01', '120'],
          ['2025-12-31', '132'],
        ],
      ],
    ])
    const performance = figuresOf(sourcesOf(records, closes, '2025-12-31'))

    // Portfolio 16,000 ÷ 10,000 × 5,500 ÷ 5,000 − 1 = 76% against the index's 132 ÷ 100 − 1 = 32%, 44 points ahead. The
    // replay's own chain, 1.30 × 1.10 − 1 = 43%, stood still while it held nothing, so it is not the index's return.
    expect(performance.portfolio.timeWeighted.total).toBeCloseTo(0.76, 9)
    expect(performance.benchmark?.priceReturn.total).toBeCloseTo(0.32, 12)
    expect(performance.benchmark?.difference).toBeCloseTo(0.44, 9)
    expect(performance.growth.filter((point) => point.date >= '2025-05-31' && point.date <= '2025-09-30').map((point) => rounded(point.benchmark))).toEqual([100, 130, 130, 130, 120])
    // The benchmark's 100 units are worth 13,000.00 on 2 Jun, so the 16,000.00 sells all of them and 3,000.00 stays unpaid.
    // It holds nothing until 5,000.00 buys 41.67 units at 120.00, worth 5,500.00 at 132.00, against the portfolio's 5,500.00.
    expect(performance.benchmark?.replay.unpaid).toEqual([{ date: '2025-06-02', amount: euros(3000) }])
    expect(performance.benchmark?.replay.value).toBe(euros(5500))
    expect(performance.portfolio.value).toBe(euros(5500))
  })

  it("opens a later period with the portfolio's value of its first day", () => {
    const records = book({
      accounts: [BROKER],
      instruments: [FUND],
      cashMovements: [cashMovement('deposit', BROKER, '2024-01-02', '1000')],
      trades: [trade('buy', BROKER, FUND, '2024-01-02', '10', '100', '0')],
    })
    const closes = new Map<Instrument, readonly CloseRow[]>([
      [
        FUND,
        [
          ['2024-01-02', '100'],
          ['2025-03-31', '150'],
          ['2026-03-31', '180'],
        ],
      ],
      [
        BENCHMARK,
        [
          ['2024-01-02', '40'],
          ['2025-03-31', '50'],
          ['2026-03-31', '55'],
        ],
      ],
    ])
    const performance = figuresOf(sourcesOf(records, closes, '2026-03-31'), BENCHMARK, { kind: 'years', years: 1 })

    // On 31 Mar 2025 the portfolio is worth 1,500.00, which buys 30 benchmark units at 50.00, worth 1,650.00 at 55.00.
    expect(performance.from).toBe('2025-03-31')
    expect(performance.benchmark?.replay.value).toBe(euros(1650))
    expect(performance.portfolio.value).toBe(euros(1800))
    expect(performance.benchmark?.valueDifference).toBe(euros(150))
    // 1,800 ÷ 1,500 − 1 = 20% against 55 ÷ 50 − 1 = 10%, and with no flow in the 365 days the same a year.
    expect(performance.portfolio.timeWeighted).toEqual({ total: expect.closeTo(0.2, 12), yearly: expect.closeTo(0.2, 12) })
    expect(performance.benchmark?.priceReturn).toEqual({ total: expect.closeTo(0.1, 12), yearly: expect.closeTo(0.1, 12) })
    expect(rounded(performance.benchmark?.difference ?? null)).toBe(0.1)
    expect(performance.portfolio.moneyWeighted).toEqual({ kind: 'rate', rate: expect.closeTo(0.2, 9) })
    expect(performance.benchmark?.replay.moneyWeighted).toEqual({ kind: 'rate', rate: expect.closeTo(0.1, 9) })
  })

  it('counts its units across a split, so a 2-for-1 split is no fall', () => {
    const records = book({
      accounts: [BROKER],
      instruments: [BENCHMARK],
      cashMovements: [cashMovement('deposit', BROKER, '2025-01-02', '1000'), cashMovement('deposit', BROKER, '2025-02-14', '510')],
      trades: [trade('buy', BROKER, BENCHMARK, '2025-01-02', '10', '100', '0'), trade('buy', BROKER, BENCHMARK, '2025-02-14', '10', '51', '0')],
      splits: [split(BENCHMARK, '2025-01-20', 2, 1)],
    })
    const closes = new Map<Instrument, readonly CloseRow[]>([
      [
        BENCHMARK,
        [
          ['2025-01-02', '100'],
          ['2025-02-14', '51'],
          ['2025-02-28', '51'],
        ],
      ],
    ])
    const performance = figuresOf(sourcesOf(records, closes, '2025-02-28'))

    // The close of 2 Jan is 100.00 ÷ 2 = 50.00 in today's units, so the index went from 50.00 to 51.00, +2%. The replay's
    // 1,000.00 buys 20 units at 50.00 and the 510.00 another 10 at 51.00, as the portfolio did.
    expect(performance.growth.map((point) => [point.date, rounded(point.benchmark)])).toEqual([
      ['2025-01-02', 100],
      ['2025-01-31', 100],
      ['2025-02-28', 102],
    ])
    expect(performance.benchmark?.replay.value).toBe(euros(1530))
    expect(performance.portfolio.value).toBe(euros(1530))
    expect(rounded(performance.benchmark?.difference ?? null)).toBe(0)
  })

  it('converts a benchmark quoted in dollars at the rate of its close', () => {
    const dollarIndex = instrument('us-index', { name: 'US index', currency: USD })
    const records = book({ accounts: [BROKER], cashMovements: [cashMovement('deposit', BROKER, '2025-01-02', '1000')] })
    const sources: PortfolioSources = {
      ...sourcesOf(
        records,
        new Map<Instrument, readonly CloseRow[]>([
          [
            dollarIndex,
            [
              ['2025-01-02', '100'],
              ['2025-01-31', '110'],
            ],
          ],
        ]),
        '2025-01-31',
      ),
      rates: rateBookOf(
        new Map([
          [
            USD,
            [
              ['2025-01-02', '1.04'],
              ['2025-01-31', '1.10'],
            ],
          ],
        ]),
      ),
    }
    const performance = figuresOf(sources, dollarIndex)

    // $100.00 at 1.04 is €96.15 and $110.00 at 1.10 is €100.00: +4.0% in euros, though +10% in dollars. The replay's
    // €1,000.00 is $1,040.00, 10.4 units, worth $1,144.00 or €1,040.00. The portfolio kept the euros as cash.
    expect(performance.benchmark?.priceReturn.total).toBeCloseTo(0.04, 12)
    expect(performance.benchmark?.replay.value).toBe(euros(1040))
    expect(performance.portfolio.timeWeighted.total).toBe(0)
  })
})

describe('the same money in the benchmark', () => {
  // Lane 3's worked portfolio with its closes on the days the records need them, and a benchmark from 100.00 to 118.00.
  const workedCloses = new Map<Instrument, readonly CloseRow[]>([
    [
      WORLD_ETF,
      [
        ['2025-01-02', '100'],
        ['2026-10-28', '124'],
        ['2026-10-29', '125'],
      ],
    ],
    [
      STOCK_B,
      [
        ['2025-03-03', '50'],
        ['2026-10-28', '57.5'],
        ['2026-10-29', '58'],
      ],
    ],
    [
      BENCHMARK,
      [
        ['2025-01-02', '100'],
        ['2026-10-29', '118'],
      ],
    ],
  ])
  const sources: PortfolioSources = { book: workedPortfolio(), prices: priceBookOf(workedCloses), rates: WORKED_RATES, today: civil('2026-10-29') }

  it("is lane 3's €125.25 behind, 7.37% against 9.51% a year, with the €2.00 fee of the first buy inside the period", () => {
    const performance = figuresOf(sources)
    const overview = portfolioFigures(sources)

    // The period opens with the €3,000.00 put in, before the buy and its fee, so the money-weighted rate is the
    // Overview's: (3,414.75 ÷ 3,000.00) ^ (365 ÷ 665) − 1 = 7.3661%. From the 2,998.00 left after the fee it would be 7.4054%.
    expect(performance.from).toBe('2025-01-02')
    expect(performance.portfolio.value).toBe(euros(3414.75))
    expect(performance.portfolio.moneyWeighted).toEqual({ kind: 'rate', rate: expect.closeTo(0.0736613, 6) })
    expect(overview.yearlyReturn).toEqual({ kind: 'rate', rate: expect.closeTo(0.0736613, 6) })
    // The €3,000.00 buys 30 units at €100.00, worth €3,540.00 at €118.00: 1.18 ^ (365 ÷ 665) − 1 = 9.51% a year.
    expect(performance.benchmark?.replay.value).toBe(euros(3540))
    expect(performance.benchmark?.replay.moneyWeighted).toEqual({ kind: 'rate', rate: expect.closeTo(0.095101, 6) })
    expect(performance.benchmark?.valueDifference).toBe(euros(-125.25))
    // The fee counts against the first month: 2,998.00 ÷ 3,000.00 on 31 Jan, after €100 on the first day.
    expect(performance.growth.slice(0, 2).map((point) => [point.date, rounded(point.portfolio)])).toEqual([
      ['2025-01-02', 100],
      ['2025-01-31', 99.933333333],
    ])
  })

  it('opens every period that starts on the first deposit day the same way, such as 5Y and the first calendar year', () => {
    const firstYear = figuresOf(sources, BENCHMARK, { kind: 'year', year: 2025 })

    expect(figuresOf(sources, BENCHMARK, { kind: 'years', years: 5 })).toEqual(figuresOf(sources))
    // 30 units at the 2 Jan close of €100.00, the latest on 31 Dec 2025.
    expect(firstYear.from).toBe('2025-01-02')
    expect(firstYear.benchmark?.replay.value).toBe(euros(3000))
  })
})

describe('the time-weighted return a year', () => {
  const records = book({
    accounts: [BROKER],
    instruments: [FUND],
    cashMovements: [cashMovement('deposit', BROKER, '2022-01-03', '1000')],
    trades: [trade('buy', BROKER, FUND, '2022-01-03', '10', '100', '0')],
  })
  const closes = new Map<Instrument, readonly CloseRow[]>([
    [
      FUND,
      [
        ['2022-01-03', '100'],
        ['2024-01-03', '110'],
      ],
    ],
    [
      BENCHMARK,
      [
        ['2022-01-03', '100'],
        ['2024-01-03', '121'],
      ],
    ],
  ])
  const sources = sourcesOf(records, closes, '2024-01-03')

  it("is lane 3's 4.88% a year for 10% over two years, for the benchmark too", () => {
    const performance = figuresOf(sources)

    // 730 days: 1.10 ^ (365 ÷ 730) − 1 = 4.88% and 1.21 ^ (365 ÷ 730) − 1 = 10%.
    expect(performance.portfolio.timeWeighted).toEqual({ total: expect.closeTo(0.1, 12), yearly: expect.closeTo(0.0488088, 6) })
    expect(performance.benchmark?.priceReturn).toEqual({ total: expect.closeTo(0.21, 12), yearly: expect.closeTo(0.1, 12) })
  })

  it('gives only the total under a year', () => {
    const thisYear = figuresOf(sources, BENCHMARK, { kind: 'year', year: 2024 })

    // From the close of 31 Dec 2023 to 3 Jan 2024 the closes of 3 Jan 2022 and 3 Jan 2024 give 10% for each.
    expect(thisYear.portfolio.timeWeighted).toEqual({ total: expect.closeTo(0.1, 12), yearly: null })
    expect(thisYear.benchmark?.priceReturn).toEqual({ total: expect.closeTo(0.21, 12), yearly: null })
  })
})

describe('the money-weighted rate', () => {
  it("takes a deposit on the period's last day out of its end value", () => {
    const records = book({
      accounts: [BROKER],
      instruments: [FUND],
      cashMovements: [cashMovement('deposit', BROKER, '2024-01-02', '1000'), cashMovement('deposit', BROKER, '2025-01-02', '1000')],
      trades: [trade('buy', BROKER, FUND, '2024-01-02', '10', '100', '0')],
    })
    const closes = new Map<Instrument, readonly CloseRow[]>([
      [
        FUND,
        [
          ['2024-01-02', '100'],
          ['2025-01-02', '110'],
        ],
      ],
      [
        BENCHMARK,
        [
          ['2024-01-02', '50'],
          ['2025-01-02', '55'],
        ],
      ],
    ])
    const performance = figuresOf(sourcesOf(records, closes, '2025-01-02'))

    // 1,000.00 grew to 1,100.00 over the 366 days of 2024, and the last day's 1,000.00 is cash: 1.1^(365 ÷ 366) − 1.
    // The benchmark buys 20 units, then 18.18 more with the 1,000.00, and grew the same 10%.
    expect(performance.portfolio.value).toBe(euros(2100))
    expect(performance.portfolio.moneyWeighted).toEqual({ kind: 'rate', rate: expect.closeTo(0.099714, 6) })
    expect(performance.benchmark?.replay.value).toBe(euros(2100))
    expect(performance.benchmark?.replay.moneyWeighted).toEqual({ kind: 'rate', rate: expect.closeTo(0.099714, 6) })
  })
})

describe('days without a close', () => {
  it('values a day with no close at the latest close before it', () => {
    const records = book({
      accounts: [BROKER],
      instruments: [FUND],
      cashMovements: [cashMovement('deposit', BROKER, '2025-04-30', '1000')],
      trades: [trade('buy', BROKER, FUND, '2025-04-30', '10', '100', '0')],
    })
    const closes = new Map<Instrument, readonly CloseRow[]>([
      [
        FUND,
        [
          ['2025-04-30', '100'],
          ['2025-05-30', '106'],
        ],
      ],
      [
        BENCHMARK,
        [
          ['2025-04-30', '100'],
          ['2025-05-30', '107'],
        ],
      ],
    ])
    const performance = figuresOf(sourcesOf(records, closes, '2025-05-31'))

    // Saturday 31 May takes Friday's closes, which are not late a day on.
    expect(performance.growth.map((point) => [point.date, rounded(point.portfolio), rounded(point.benchmark)])).toEqual([
      ['2025-04-30', 100, 100],
      ['2025-05-31', 106, 107],
    ])
    expect(performance.lateCloses).toEqual([])
  })

  it('names a holding valued at a close that was late by then', () => {
    const records = book({
      accounts: [BROKER],
      instruments: [FUND],
      cashMovements: [cashMovement('deposit', BROKER, '2025-04-01', '1000')],
      trades: [trade('buy', BROKER, FUND, '2025-04-01', '10', '100', '0')],
    })
    const closes = new Map<Instrument, readonly CloseRow[]>([
      [
        FUND,
        [
          ['2025-04-01', '100'],
          ['2025-05-30', '106'],
        ],
      ],
      [
        BENCHMARK,
        [
          ['2025-04-01', '100'],
          ['2025-04-30', '101'],
          ['2025-05-30', '107'],
        ],
      ],
    ])

    // On 30 Apr the fund's latest close is 1 Apr's, 20 weekdays old.
    expect(figuresOf(sourcesOf(records, closes, '2025-05-31')).lateCloses).toEqual([FUND])
  })

  it('starts after the last day a holding or the benchmark had no close, and names them', () => {
    const records = book({
      accounts: [BROKER],
      instruments: [FUND, LATE_FUND],
      cashMovements: [cashMovement('deposit', BROKER, '2025-01-02', '1000'), cashMovement('deposit', BROKER, '2025-02-28', '1000')],
      trades: [trade('buy', BROKER, FUND, '2025-01-02', '10', '100', '0'), trade('buy', BROKER, LATE_FUND, '2025-02-28', '10', '100', '0')],
    })
    const closes = new Map<Instrument, readonly CloseRow[]>([
      [
        FUND,
        [
          ['2025-02-10', '100'],
          ['2025-04-30', '110'],
        ],
      ],
      [
        LATE_FUND,
        [
          ['2025-03-03', '100'],
          ['2025-04-30', '110'],
        ],
      ],
      [
        BENCHMARK,
        [
          ['2025-03-03', '50'],
          ['2025-04-30', '52'],
        ],
      ],
    ])
    const performance = figuresOf(sourcesOf(records, closes, '2025-04-30'))

    // The fund has no close on 2 Jan or 31 Jan, the fund bought on 28 Feb and the benchmark none before 3 Mar. The next
    // valuation day is 30 Mar, a month before the last day, so the period starts there.
    expect(performance.from).toBe('2025-03-30')
    expect(performance.heldBack).toEqual({ instruments: [FUND, BENCHMARK, LATE_FUND], currencies: [] })
    expect(performance.portfolio.timeWeighted.total).toBeCloseTo(0.1, 12)
    expect(performance.benchmark?.priceReturn.total).toBeCloseTo(0.04, 12)
  })

  it('ends on the last day it can value, before a buy that has no close yet', () => {
    const records = book({
      accounts: [BROKER],
      instruments: [FUND, LATE_FUND],
      cashMovements: [cashMovement('deposit', BROKER, '2025-01-31', '1000'), cashMovement('deposit', BROKER, '2025-03-14', '500')],
      trades: [trade('buy', BROKER, FUND, '2025-01-31', '10', '100', '0'), trade('buy', BROKER, LATE_FUND, '2025-03-14', '5', '100', '0')],
    })
    const closes = new Map<Instrument, readonly CloseRow[]>([
      [
        FUND,
        [
          ['2025-01-31', '100'],
          ['2025-02-28', '105'],
          ['2025-03-13', '108'],
        ],
      ],
      [
        BENCHMARK,
        [
          ['2025-01-31', '100'],
          ['2025-02-28', '102'],
          ['2025-03-13', '103'],
        ],
      ],
    ])
    const performance = figuresOf(sourcesOf(records, closes, '2025-03-14'))

    // Today's buy has no close yet, so the figures end on 28 Feb, the valuation day before: 1,050.00 ÷ 1,000.00 − 1.
    expect(performance.from).toBe('2025-01-31')
    expect(performance.to).toBe('2025-02-28')
    expect(performance.heldBack).toEqual({ instruments: [LATE_FUND], currencies: [] })
    expect(performance.growth.map((point) => point.date)).toEqual(['2025-01-31', '2025-02-28'])
    expect(performance.portfolio.timeWeighted.total).toBeCloseTo(0.05, 12)
    expect(performance.benchmark?.priceReturn.total).toBeCloseTo(0.02, 12)
  })

  it('has no figures when no day can be valued', () => {
    const records = book({
      accounts: [BROKER],
      instruments: [FUND],
      cashMovements: [cashMovement('deposit', BROKER, '2025-01-02', '1000')],
      trades: [trade('buy', BROKER, FUND, '2025-01-02', '10', '100', '0')],
    })

    expect(portfolioPerformance(sourcesOf(records, new Map(), '2025-01-31'), null, { kind: 'all' })).toEqual({ kind: 'held-back', heldBack: { instruments: [FUND], currencies: [] } })
  })
})

describe('the periods', () => {
  const firstDeposit = civil('2023-06-15')
  const today = civil('2026-10-29')

  it('starts a period that would begin before the first deposit on it', () => {
    expect(periodSpan({ kind: 'all' }, firstDeposit, today)).toEqual({ from: '2023-06-15', to: '2026-10-29' })
    expect(periodSpan({ kind: 'years', years: 1 }, firstDeposit, today)).toEqual({ from: '2025-10-29', to: '2026-10-29' })
    expect(periodSpan({ kind: 'years', years: 3 }, firstDeposit, today)).toEqual({ from: '2023-10-29', to: '2026-10-29' })
    expect(periodSpan({ kind: 'years', years: 5 }, firstDeposit, today)).toEqual({ from: '2023-06-15', to: '2026-10-29' })
  })

  it('runs a year from the close of the 31st of December before it, and this year to today', () => {
    expect(periodSpan({ kind: 'year', year: 2023 }, firstDeposit, today)).toEqual({ from: '2023-06-15', to: '2023-12-31' })
    expect(periodSpan({ kind: 'year', year: 2024 }, firstDeposit, today)).toEqual({ from: '2023-12-31', to: '2024-12-31' })
    expect(periodSpan({ kind: 'year', year: 2026 }, firstDeposit, today)).toEqual({ from: '2025-12-31', to: '2026-10-29' })
    expect(periodSpan({ kind: 'year', year: 2022 }, firstDeposit, today)).toBeNull()
    expect(periodSpan({ kind: 'year', year: 2027 }, firstDeposit, today)).toBeNull()
  })

  it('has nothing to show before the first deposit, or without one', () => {
    const sources = sourcesOf(book({ accounts: [BROKER], cashMovements: [cashMovement('deposit', BROKER, '2025-03-03', '100')] }), new Map(), '2025-12-31')

    expect(portfolioPerformance(sources, null, { kind: 'year', year: 2024 })).toEqual({ kind: 'empty' })
    expect(portfolioPerformance({ ...sources, book: book({}) }, null, { kind: 'all' })).toEqual({ kind: 'empty' })
  })
})

describe('the largest fall', () => {
  it('is −25% for 100, 120, 90, 110, 130, 104', () => {
    // 120 to 90 is −25%, 130 to 104 is −20%.
    expect(largestFall([100, 120, 90, 110, 130, 104])).toBeCloseTo(-0.25, 12)
    expect(largestFall([100, 101, 102])).toBe(0)
    expect(largestFall([100])).toBeNull()
  })

  it("reads the time-weighted index at month ends, so a withdrawal is no fall, and gives each year's return", () => {
    const monthEnds: readonly CloseRow[] = [
      ['2025-01-31', '100'],
      ['2025-02-28', '120'],
      ['2025-03-31', '90'],
      ['2025-04-30', '110'],
      ['2025-05-31', '130'],
      ['2025-06-30', '104'],
      ['2025-12-31', '104'],
      ['2026-06-30', '117'],
    ]
    const records = book({
      accounts: [BROKER],
      instruments: [FUND],
      cashMovements: [cashMovement('deposit', BROKER, '2025-01-31', '1000'), cashMovement('withdrawal', BROKER, '2025-04-30', '550')],
      trades: [trade('buy', BROKER, FUND, '2025-01-31', '10', '100', '0'), trade('sell', BROKER, FUND, '2025-04-30', '5', '110', '0')],
    })
    const sources = sourcesOf(records, new Map([[FUND, monthEnds]]), '2026-06-30')
    const performance = figuresOf(sources, null, { kind: 'year', year: 2025 })

    // Half the holding leaves on 30 Apr, but the index carries on at 110 → 130 → 104.
    expect(performance.growth.slice(0, 6).map((point) => rounded(point.portfolio))).toEqual([100, 120, 90, 110, 130, 104])
    expect(performance.largestFall).toBeCloseTo(-0.25, 12)

    const years = performanceByYear(sources, null).map(({ year, performance: figures }) => [year, figures.kind === 'figures' ? rounded(figures.portfolio.timeWeighted.total) : figures.kind])
    // 2025: 104 ÷ 100 − 1 = 4%. 2026: 117 ÷ 104 − 1 = 12.5%.
    expect(years).toEqual([
      [2025, 0.04],
      [2026, 0.125],
    ])
  })

  it('leaves a dip on a deposit day inside a month off the line and out of the largest fall, though the day still splits the return', () => {
    const records = book({
      accounts: [BROKER],
      instruments: [FUND],
      cashMovements: [cashMovement('deposit', BROKER, '2025-01-31', '1000'), cashMovement('deposit', BROKER, '2025-02-14', '500')],
      trades: [trade('buy', BROKER, FUND, '2025-01-31', '10', '100', '0'), trade('buy', BROKER, FUND, '2025-02-14', '10', '50', '0')],
    })
    const closes = new Map<Instrument, readonly CloseRow[]>([
      [
        FUND,
        [
          ['2025-01-31', '100'],
          ['2025-02-14', '50'],
          ['2025-02-28', '100'],
        ],
      ],
    ])
    const performance = figuresOf(sourcesOf(records, closes, '2025-02-28'), null)

    // The index halves on 14 Feb, (1,000.00 − 500.00) ÷ 1,000.00, and doubles back by 28 Feb, 2,000.00 ÷ 1,000.00, so the
    // return is 0%. Without the split on 14 Feb it would be (2,000.00 − 500.00) ÷ 1,000.00 − 1 = +50%.
    expect(performance.growth.map((point) => [point.date, rounded(point.portfolio)])).toEqual([
      ['2025-01-31', 100],
      ['2025-02-28', 100],
    ])
    expect(performance.largestFall).toBe(0)
    expect(performance.portfolio.timeWeighted.total).toBeCloseTo(0, 12)
  })
})

describe('volatility', () => {
  const cycle = ['1.02', '0.99', '1.03', '0.98', '1.01', '1']

  /** A close on each of the days, from 100.00, each the one before times the next step of the cycle. */
  function cycleCloses(days: readonly CivilDate[]): CloseRow[] {
    let price = decimal('100')
    return days.map((date, step) => {
      const close: CloseRow = [date, decimalText(price)]
      price = timesDecimal(price, decimal(cycle[step % cycle.length]!))
      return close
    })
  }

  it('is 6.5% a year for monthly returns of +2%, −1%, +3%, −2%, +1% and 0%', () => {
    // The mean is 0.5%. The squared deviations add up to 2.25 + 2.25 + 6.25 + 6.25 + 0.25 + 0.25 = 17.5, over n − 1 = 5
    // that is 3.5, so σ = 1.87% a month and 1.87% × √12 = 6.48% a year.
    expect(yearlyVolatility([0.02, -0.01, 0.03, -0.02, 0.01, 0])).toBeCloseTo(0.0648074, 6)
    expect(yearlyVolatility([0.02])).toBeNull()
  })

  it('shows on a complete year, with its 12 monthly returns, and not on a year with 11', () => {
    const monthEnds = Array.from({ length: 24 }, (_, offset) => lastDayOf(addMonths(monthOf(civil('2022-12-31')), offset)))
    const records = book({
      accounts: [BROKER],
      instruments: [FUND],
      cashMovements: [cashMovement('deposit', BROKER, '2022-12-31', '100000'), cashMovement('deposit', BROKER, '2023-02-14', '1020')],
      trades: [trade('buy', BROKER, FUND, '2022-12-31', '1000', '100', '0'), trade('buy', BROKER, FUND, '2023-02-14', '10', '102', '0')],
    })
    const sources = sourcesOf(records, new Map([[FUND, cycleCloses(monthEnds)]]), '2024-12-30')
    const volatility = performanceByYear(sources, null).map(({ year, performance }) => [year, performance.kind === 'figures' ? performance.volatility : performance.kind])

    // 2023 runs from the close of 31 Dec 2022 through 12 month ends, two turns of the cycle: the mean is 0.5%, the squared
    // deviations 2 × 17.5 = 35 over n − 1 = 11, so σ = 1.7838% a month and 6.18% a year. The deposit on 14 Feb adds no
    // return. 2022 is its last day only. 2024 to 30 Dec has 11, from 30 Jan, since 30 Dec 2023 is before the year.
    expect(volatility).toEqual([
      [2022, null],
      [2023, expect.closeTo(0.0617914, 6)],
      [2024, null],
    ])
  })

  it('shows on 1Y, from the same day of each month back from its last day', () => {
    const twentyNinths = Array.from({ length: 14 }, (_, offset) => dayMonthsLater(civil('2023-09-29'), offset))
    const records = book({
      accounts: [BROKER],
      instruments: [FUND],
      cashMovements: [cashMovement('deposit', BROKER, '2023-09-29', '100000')],
      trades: [trade('buy', BROKER, FUND, '2023-09-29', '1000', '100', '0')],
    })
    const performance = figuresOf(sourcesOf(records, new Map([[FUND, cycleCloses(twentyNinths)]]), '2024-10-29'), null, { kind: 'years', years: 1 })

    // 29 Oct 2023 to 29 Oct 2024 is 12 monthly returns, again two turns of the cycle. It holds only 11 whole calendar
    // months, November to September.
    expect(performance.from).toBe('2023-10-29')
    expect(performance.volatility).toBeCloseTo(0.0617914, 6)
  })
})
