import { describe, expect, it } from 'vitest'

import { portfolioPerformance } from '../src/apps/investments/performance/domain/portfolioPerformance'
import type { PeriodPerformance, Performance } from '../src/apps/investments/performance/domain/portfolioPerformance'
import { moneyWeightedRate, timeWeightedIndex } from '../src/apps/investments/performance/domain/timeWeightedReturn'
import type { ValuedDay } from '../src/apps/investments/performance/domain/timeWeightedReturn'
import type { Instrument } from '../src/apps/investments/workbook/domain/instrument'
import type { InvestmentBook } from '../src/apps/investments/workbook/domain/investmentBook'
import { BROKER, book, cashMovement, instrument, priceBookOf, rateBookOf, trade } from './fixtures/investments'
import type { CloseRow } from './fixtures/investments'
import { civil, euros } from './fixtures/ledger'

const NO_RATES = rateBookOf(new Map())
const FUND_A = instrument('fund-a', { name: 'Fund A' })
const FUND_B = instrument('fund-b', { name: 'Fund B' })

function day(date: string, value: number, flow = 0): ValuedDay {
  return { date: civil(date), value: euros(value), flow: euros(flow) }
}

function performanceOf(records: InvestmentBook, closes: ReadonlyMap<Instrument, readonly CloseRow[]>, today: string): PeriodPerformance {
  const performance: Performance = portfolioPerformance({ book: records, prices: priceBookOf(closes), rates: NO_RATES, today: civil(today) }, null, { kind: 'all' })
  if (performance.kind !== 'figures') {
    throw new Error(`Expected figures, got ${performance.kind}.`)
  }
  return performance
}

describe("lane 3's example: +4.5% time-weighted against −7.4% money-weighted", () => {
  // €1,000.00 in on 1 Jan 2025, grown 10% by 1 Jul, then €10,000.00 more, and everything 5% down by 31 Dec.
  const days = [day('2025-01-01', 1000, 1000), day('2025-07-01', 11100, 10000), day('2025-12-31', 10545)]

  it('chains the two pieces between the deposits', () => {
    // (11,100.00 − 10,000.00) ÷ 1,000.00 = 1.10, then 10,545.00 ÷ 11,100.00 = 0.95, so 1.10 × 0.95 − 1 = +4.5%.
    const index = timeWeightedIndex(days)
    expect(index[1]).toBeCloseTo(1.1, 12)
    expect(index[2]! - 1).toBeCloseTo(0.045, 12)
  })

  it('gives −7.4% a year for the money, which went in just before the fall', () => {
    // −1,000.00 on day 0, −10,000.00 on day 181 and +10,545.00 on day 364 balance at r = −7.4495% a year, which is −7.4%:
    // 10,000.00 × 0.925505^(−181/365) = 10,391.36 and 10,545.00 × 0.925505^(−364/365) = 11,391.36, which less 1,000.00 is the same.
    expect(moneyWeightedRate(days)).toBeCloseTo(-0.074495, 5)
  })

  it('gets the same +4.5% from the records, with the value on every month end', () => {
    const records = book({
      accounts: [BROKER],
      instruments: [FUND_A, FUND_B],
      cashMovements: [cashMovement('deposit', BROKER, '2025-01-01', '1000'), cashMovement('deposit', BROKER, '2025-07-01', '10000')],
      trades: [trade('buy', BROKER, FUND_A, '2025-01-01', '10', '100', '0'), trade('buy', BROKER, FUND_B, '2025-07-01', '100', '100', '0')],
    })
    const closes = new Map<Instrument, readonly CloseRow[]>([
      [
        FUND_A,
        [
          ['2025-01-01', '100'],
          ['2025-07-01', '110'],
          ['2025-12-31', '104.5'],
        ],
      ],
      [
        FUND_B,
        [
          ['2025-07-01', '100'],
          ['2025-12-31', '95'],
        ],
      ],
    ])
    const performance = performanceOf(records, closes, '2025-12-31')

    // 10 × 100.00 until July. Then 10 × 110.00 + 100 × 100.00 = 11,100.00, and at the end 10 × 104.50 + 100 × 95.00 = 10,545.00.
    expect(performance.from).toBe('2025-01-01')
    expect(performance.growth.map((point) => [point.date, Math.round(point.portfolio * 1e6) / 1e6])).toEqual([
      ['2025-01-01', 100],
      ['2025-01-31', 100],
      ['2025-02-28', 100],
      ['2025-03-31', 100],
      ['2025-04-30', 100],
      ['2025-05-31', 100],
      ['2025-06-30', 100],
      ['2025-07-31', 110],
      ['2025-08-31', 110],
      ['2025-09-30', 110],
      ['2025-10-31', 110],
      ['2025-11-30', 110],
      ['2025-12-31', 104.5],
    ])
    expect(performance.portfolio.timeWeighted.total).toBeCloseTo(0.045, 12)
    expect(performance.portfolio.value).toBe(euros(10545))
    // Under a year from the first deposit, so the yearly rate waits, as it does on the Overview.
    expect(performance.portfolio.moneyWeighted).toEqual({ kind: 'under-a-year' })
  })
})

describe('trades inside the portfolio', () => {
  const deposit = cashMovement('deposit', BROKER, '2025-02-28', '1000')
  const bought = trade('buy', BROKER, FUND_A, '2025-02-28', '10', '100', '0')

  it('changes nothing for a sale and a rebuy inside one month', () => {
    const closes = new Map<Instrument, readonly CloseRow[]>([
      [
        FUND_A,
        [
          ['2025-02-28', '100'],
          ['2025-03-03', '100'],
          ['2025-03-12', '93'],
          ['2025-03-20', '100'],
          ['2025-03-31', '101'],
        ],
      ],
    ])
    const held = performanceOf(book({ accounts: [BROKER], instruments: [FUND_A], cashMovements: [deposit], trades: [bought] }), closes, '2025-03-31')
    const roundTrip = performanceOf(
      book({
        accounts: [BROKER],
        instruments: [FUND_A],
        cashMovements: [deposit],
        trades: [bought, trade('sell', BROKER, FUND_A, '2025-03-03', '10', '100', '0'), trade('buy', BROKER, FUND_A, '2025-03-20', '10', '100', '0')],
      }),
      closes,
      '2025-03-31',
    )

    // 1,010.00 ÷ 1,000.00 − 1 = +1.0% either way, since neither trade is a deposit or a withdrawal.
    expect(held.portfolio.timeWeighted.total).toBeCloseTo(0.01, 12)
    expect(roundTrip.portfolio.timeWeighted.total).toBe(held.portfolio.timeWeighted.total)
    expect(roundTrip.growth).toEqual(held.growth)
  })

  it('gives about 1% for a month that switched funds, where monthly Modified Dietz gave 15.5%', () => {
    // The critique's month: €1,000.00 sold on day 1, €1,000.00 of another fund bought on day 30, worth €1,010.00 at the end.
    const performance = performanceOf(
      book({
        accounts: [BROKER],
        instruments: [FUND_A, FUND_B],
        cashMovements: [deposit],
        trades: [bought, trade('sell', BROKER, FUND_A, '2025-03-01', '10', '100', '0'), trade('buy', BROKER, FUND_B, '2025-03-30', '20', '50', '0')],
      }),
      new Map<Instrument, readonly CloseRow[]>([
        [FUND_A, [['2025-02-28', '100']]],
        [
          FUND_B,
          [
            ['2025-03-28', '50'],
            ['2025-03-31', '50.5'],
          ],
        ],
      ]),
      '2025-03-31',
    )

    // 20 × 50.50 = 1,010.00 over 1,000.00.
    expect(performance.portfolio.value).toBe(euros(1010))
    expect(performance.portfolio.timeWeighted.total).toBeCloseTo(0.01, 12)
  })
})

describe('the time-weighted index', () => {
  it('stands still from a day worth nothing, after everything was taken out', () => {
    // 1,000.00 grows to 1,200.00 and all of it leaves. Nothing is held until 500.00 comes in, which grows to 550.00.
    const index = timeWeightedIndex([day('2025-01-01', 1000, 1000), day('2025-02-01', 0, -1200), day('2025-03-01', 0), day('2025-04-01', 500, 500), day('2025-05-01', 550)])

    // 1.20, then 1.20 three times, then 1.20 × 1.10 = 1.32.
    expect(index.map((reached) => Math.round(reached * 1e9) / 1e9)).toEqual([1, 1.2, 1.2, 1.2, 1.32])
  })

  it('counts a withdrawal at the close of its day, so a fall that day still counts', () => {
    // 1,000.00 falls to 900.00 on the day 400.00 is taken out, leaving 500.00: (500.00 + 400.00) ÷ 1,000.00 = 0.90.
    expect(timeWeightedIndex([day('2025-01-01', 1000, 1000), day('2025-01-15', 500, -400)])[1]).toBeCloseTo(0.9, 12)
  })
})
