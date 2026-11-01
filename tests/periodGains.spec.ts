import { describe, expect, it } from 'vitest'

import type { PortfolioSources } from '../src/apps/investments/holdings/domain/holding'
import { portfolioFigures } from '../src/apps/investments/holdings/domain/portfolioFigures'
import { gainSources } from '../src/apps/investments/overview/domain/overviewFigures'
import { gainSteps, periodGains } from '../src/apps/investments/performance/domain/periodGains'
import { periodDrivers } from '../src/apps/investments/performance/presentation/driversChart'
import type { PeriodGains } from '../src/apps/investments/performance/domain/periodGains'
import type { PerformancePeriod } from '../src/apps/investments/performance/domain/performancePeriod'
import { dayValuer, portfolioPerformance } from '../src/apps/investments/performance/domain/portfolioPerformance'
import type { Instrument } from '../src/apps/investments/workbook/domain/instrument'
import type { InvestmentBook } from '../src/apps/investments/workbook/domain/investmentBook'
import { EURO } from '../src/shared/money/currencyCode'
import { sumMoney } from '../src/shared/money/money'
import {
  BROKER,
  STOCK_B,
  USD,
  WORKED_RATES,
  WORLD_ETF,
  account,
  book,
  cashMovement,
  decimal,
  exchange,
  instrument,
  priceBookOf,
  rateBookOf,
  split,
  trade,
  unitTransfer,
  workedPortfolio,
} from './fixtures/investments'
import type { CloseRow } from './fixtures/investments'
import { civil, euros } from './fixtures/ledger'

const FUND = instrument('euro-fund', { name: 'Euro fund' })
const DOLLAR_SHARE = instrument('dollar-share', { name: 'Dollar share', currency: USD })
const SECOND = account('second', 'Second broker')
const YEAR_2026: PerformancePeriod = { kind: 'year', year: 2026 }

function gainsOver(sources: PortfolioSources, period: PerformancePeriod): PeriodGains {
  const valuedOn = dayValuer(sources)
  const performance = portfolioPerformance(sources, null, period, valuedOn)
  if (performance.kind !== 'figures') {
    throw new Error(`Expected figures, got ${performance.kind}.`)
  }
  return periodGains(sources, performance, valuedOn)
}

function sourcesOf(records: InvestmentBook, closes: ReadonlyMap<Instrument, readonly CloseRow[]>, today: string, rates = rateBookOf(new Map())): PortfolioSources {
  return { book: records, prices: priceBookOf(closes), rates, today: civil(today) }
}

/** The worked portfolio with a close on each buy's day as well, so every day from the first deposit can be valued. */
function workedSources(): PortfolioSources {
  const closes = new Map<Instrument, readonly CloseRow[]>([
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
  ])
  return { book: workedPortfolio(), prices: priceBookOf(closes), rates: WORKED_RATES, today: civil('2026-10-29') }
}

function endOfSteps(gains: PeriodGains): number {
  return sumMoney([gains.start, ...gainSteps(gains).map((step) => step.amount)])
}

describe('the gain of a period', () => {
  it("splits the worked portfolio's gain over everything into the Overview's €414.75", () => {
    const sources = workedSources()
    const gains = gainsOver(sources, { kind: 'all' })

    expect(Object.fromEntries(gainSteps(gains).map((step) => [step.step, step.amount]))).toEqual({
      'put-in': euros(3000),
      'taken-out': euros(0),
      price: euros(427.47),
      // −44.68 on Stock B's rate and +10.92 on the dollars held.
      currency: euros(-33.76),
      realised: euros(15.06),
      income: euros(8.55),
      withheld: euros(-2.57),
      fees: euros(0),
    })
    expect([gains.from, gains.to]).toEqual([civil('2025-01-02'), civil('2026-10-29')])
    expect(gains.start).toBe(euros(0))
    expect(gains.end).toBe(euros(3414.75))
    expect(endOfSteps(gains)).toBe(gains.end)
    expect(
      sumMoney(
        gainSteps(gains)
          .slice(2)
          .map((step) => step.amount),
      ),
    ).toBe(gainSources(portfolioFigures(sources)).total)
  })

  it('names what drove the worked portfolio: World ETF, Stock B and the currency on cash', () => {
    const gains = gainsOver(workedSources(), { kind: 'all' })

    expect(gains.holdings.map((holding) => [holding.instrument.name, holding.total])).toEqual([
      [WORLD_ETF.name, euros(321)],
      // 61.79 on the 15 held + 15.06 realised + 5.98 received.
      [STOCK_B.name, euros(82.83)],
    ])
    expect(gains.currencyOnCash).toBe(euros(10.92))
    expect(gains.incomeOnCash).toBe(euros(0))
    // €2.00, $1.00 at 1.05, €2.00 and $1.00 at 1.18.
    expect(gains.tradingFees).toBe(euros(5.8))
  })

  it('counts units held at the start from their value then, and units bought inside from their cost', () => {
    const records = book({
      accounts: [BROKER],
      instruments: [FUND],
      cashMovements: [cashMovement('deposit', BROKER, '2025-01-02', '2000'), cashMovement('fee', BROKER, '2026-03-02', '5')],
      trades: [trade('buy', BROKER, FUND, '2025-01-02', '10', '90', '0'), trade('buy', BROKER, FUND, '2026-01-15', '5', '110', '2'), trade('sell', BROKER, FUND, '2026-02-16', '3', '120', '1')],
    })
    const closes = new Map([
      [
        FUND,
        [
          ['2025-01-02', '90'],
          ['2025-12-31', '100'],
          ['2026-03-31', '125'],
        ] as const,
      ],
    ])
    const gains = gainsOver(sourcesOf(records, closes, '2026-03-31'), YEAR_2026)

    // €1,000.00 of units and €1,100.00 of cash at the start.
    expect(gains.start).toBe(euros(2100))
    // 12 units at €125.00 against 7 × €100.00 + €552.00.
    expect(gains.price).toBe(euros(248))
    // 3 × €120.00 − €1.00 against 3 × €100.00.
    expect(gains.realised).toBe(euros(59))
    expect(gains.fees).toBe(euros(-5))
    expect(sumMoney(gainSteps(gains).map((step) => step.amount))).toBe(euros(302))
    expect(gains.end).toBe(euros(2402))
    expect(endOfSteps(gains)).toBe(gains.end)
    expect(gains.tradingFees).toBe(euros(3))
  })

  it("counts the first day's records in the start, and only the period's own trades in the trading fees", () => {
    const records = book({
      accounts: [BROKER],
      instruments: [FUND],
      cashMovements: [cashMovement('deposit', BROKER, '2025-01-02', '1000'), cashMovement('deposit', BROKER, '2025-12-31', '500'), cashMovement('deposit', BROKER, '2026-02-02', '300')],
      trades: [trade('buy', BROKER, FUND, '2025-01-02', '10', '90', '4'), trade('buy', BROKER, FUND, '2025-12-31', '4', '100', '1'), trade('buy', BROKER, FUND, '2026-02-02', '2', '105', '2')],
    })
    const closes = new Map([
      [
        FUND,
        [
          ['2025-01-02', '90'],
          ['2025-12-31', '100'],
          ['2026-02-02', '105'],
          ['2026-03-31', '110'],
        ] as const,
      ],
    ])
    const sources = sourcesOf(records, closes, '2026-03-31')
    const gains = gainsOver(sources, YEAR_2026)

    // 14 units at €100.00 and €195.00 of cash at the close of 31 Dec 2025, with that day's deposit and buy.
    expect(gains.start).toBe(euros(1595))
    expect(gains.start).toBe(dayValuer(sources)(gains.from).value)
    expect(gains.putIn).toBe(euros(300))
    // 14 × €10.00 on the units held at the start, and 2 × €110.00 against the €212.00 they cost.
    expect(gains.price).toBe(euros(148))
    expect(gains.end).toBe(dayValuer(sources)(gains.to).value)
    expect(endOfSteps(gains)).toBe(gains.end)
    expect(gains.tradingFees).toBe(euros(2))
  })

  it('starts from cash below zero as money owed, not as money in', () => {
    const records = book({
      accounts: [BROKER],
      instruments: [FUND],
      cashMovements: [cashMovement('deposit', BROKER, '2025-01-02', '1000'), cashMovement('deposit', BROKER, '2026-01-15', '200')],
      trades: [trade('buy', BROKER, FUND, '2025-01-02', '11', '100', '0')],
    })
    const closes = new Map([
      [
        FUND,
        [
          ['2025-01-02', '100'],
          ['2025-12-31', '110'],
          ['2026-03-31', '120'],
        ] as const,
      ],
    ])
    const sources = sourcesOf(records, closes, '2026-03-31')
    const gains = gainsOver(sources, YEAR_2026)

    // 11 units at €110.00 less the €100.00 the cash is below zero.
    expect(gains.start).toBe(euros(1110))
    expect(gains.putIn).toBe(euros(200))
    expect(gains.price).toBe(euros(110))
    expect(gains.end).toBe(euros(1420))
    expect(gains.end).toBe(dayValuer(sources)(gains.to).value)
    expect(endOfSteps(gains)).toBe(gains.end)
  })

  it('prices a close from before a split before the start in the units held since', () => {
    const records = book({
      accounts: [BROKER],
      instruments: [FUND],
      cashMovements: [cashMovement('deposit', BROKER, '2025-01-02', '1000')],
      trades: [trade('buy', BROKER, FUND, '2025-01-02', '10', '100', '0')],
      splits: [split(FUND, '2025-06-02', 2, 1)],
    })
    const sources = sourcesOf(records, new Map([[FUND, [['2025-01-02', '100']] as const]]), '2026-03-31')
    const gains = gainsOver(sources, YEAR_2026)

    // 20 units at the €100.00 close halved by the split, at the start and at the end.
    expect(gains.start).toBe(euros(1000))
    expect(gains.price).toBe(euros(0))
    expect(gains.end).toBe(euros(1000))
    expect(gains.end).toBe(dayValuer(sources)(gains.to).value)
  })

  it('splits a dollar holding into its price at the end rate and the rest as currency', () => {
    const records = book({
      accounts: [BROKER],
      instruments: [DOLLAR_SHARE],
      cashMovements: [cashMovement('deposit', BROKER, '2025-06-02', '500', USD, '1.10')],
      trades: [trade('buy', BROKER, DOLLAR_SHARE, '2025-06-02', '10', '50', '0', '1.10')],
    })
    const closes = new Map([
      [
        DOLLAR_SHARE,
        [
          ['2025-06-02', '50'],
          ['2026-03-31', '55'],
        ] as const,
      ],
    ])
    const rates = rateBookOf(
      new Map([
        [
          USD,
          [
            ['2025-06-02', '1.10'],
            ['2026-03-31', '1.20'],
          ],
        ],
      ]),
    )
    const gains = gainsOver(sourcesOf(records, closes, '2026-03-31', rates), YEAR_2026)

    expect(gains.start).toBe(euros(454.55))
    expect(gains.price).toBe(euros(41.67))
    expect(gains.currency).toBe(euros(-37.89))
    expect(gains.end).toBe(euros(458.33))
  })

  it('keeps the units of each account at the start, so a sale from the second account still counts', () => {
    const records = book({
      accounts: [BROKER, SECOND],
      instruments: [FUND],
      cashMovements: [cashMovement('deposit', BROKER, '2025-01-02', '1000')],
      trades: [trade('buy', BROKER, FUND, '2025-01-02', '10', '100', '0'), trade('sell', SECOND, FUND, '2026-02-16', '4', '120', '0')],
      transfers: [unitTransfer(BROKER, SECOND, '2025-06-02', FUND, '4')],
    })
    const closes = new Map([
      [
        FUND,
        [
          ['2025-01-02', '100'],
          ['2025-12-31', '110'],
          ['2026-03-31', '115'],
        ] as const,
      ],
    ])
    const gains = gainsOver(sourcesOf(records, closes, '2026-03-31'), YEAR_2026)

    expect(gains.realised).toBe(euros(40))
    expect(gains.price).toBe(euros(30))
    expect(endOfSteps(gains)).toBe(gains.end)
  })

  it('moves exchange fees out of the currency on cash into the fees', () => {
    const records = book({
      accounts: [BROKER],
      cashMovements: [cashMovement('deposit', BROKER, '2025-01-02', '1000')],
      exchanges: [exchange(BROKER, '2026-01-15', '505', EURO, '550', USD, { amount: decimal('5'), currency: EURO })],
    })
    const rates = rateBookOf(new Map([[USD, [['2025-01-02', '1.10']]]]))
    const gains = gainsOver(sourcesOf(records, new Map(), '2026-03-31', rates), YEAR_2026)

    // $550.00 at 1.10 is €500.00 against the €505.00 sold, all of it the fee.
    expect(gains.currencyOnCash).toBe(euros(0))
    expect(gains.currency).toBe(euros(0))
    expect(gains.fees).toBe(euros(-5))
    expect(gains.end).toBe(euros(995))
    expect(endOfSteps(gains)).toBe(gains.end)
  })

  it('draws eight holdings by how far they moved and puts the rest in Others', () => {
    const funds = Array.from({ length: 10 }, (_, index) => instrument(`fund-${index + 1}`, { name: `Fund ${index + 1}` }))
    const records = book({
      accounts: [BROKER],
      instruments: funds,
      cashMovements: [cashMovement('deposit', BROKER, '2025-01-02', '1000')],
      trades: funds.map((fund) => trade('buy', BROKER, fund, '2025-01-02', '1', '100', '0')),
    })
    // Fund 1 ends at €101.00, Fund 2 at €102.00 and so on, so Fund 10 moved most.
    const closes = new Map(funds.map((fund, index) => [fund, [['2025-01-02', '100'] as const, ['2025-03-31', String(101 + index)] as const]]))
    const gains = gainsOver(sourcesOf(records, closes, '2025-03-31'), { kind: 'all' })

    expect(periodDrivers(gains).map((driver) => [driver.label, driver.amount])).toEqual([...[10, 9, 8, 7, 6, 5, 4, 3].map((number) => [`Fund ${number}`, euros(number)]), ['Others', euros(3)]])
  })

  it('keeps a large loss among the eight holdings drawn, out of Others', () => {
    const funds = Array.from({ length: 10 }, (_, index) => instrument(`fund-${index + 1}`, { name: `Fund ${index + 1}` }))
    const records = book({
      accounts: [BROKER],
      instruments: funds,
      cashMovements: [cashMovement('deposit', BROKER, '2025-01-02', '1000')],
      trades: funds.map((fund) => trade('buy', BROKER, fund, '2025-01-02', '1', '100', '0')),
    })
    // Funds 1 to 9 end €1.00 to €9.00 up, and Fund 10 ends €50.00 down.
    const closes = new Map(funds.map((fund, index) => [fund, [['2025-01-02', '100'] as const, ['2025-03-31', String(index === 9 ? 50 : 101 + index)] as const]]))
    const gains = gainsOver(sourcesOf(records, closes, '2025-03-31'), { kind: 'all' })

    expect(periodDrivers(gains).map((driver) => [driver.label, driver.amount])).toEqual([
      ...[9, 8, 7, 6, 5, 4, 3].map((number) => [`Fund ${number}`, euros(number)]),
      ['Fund 10', euros(-50)],
      ['Others', euros(3)],
    ])
  })

  it("names the worked portfolio's drivers in the order they added", () => {
    const gains = gainsOver(workedSources(), { kind: 'all' })

    expect(periodDrivers(gains).map((driver) => [driver.label, driver.amount])).toEqual([
      [WORLD_ETF.name, euros(321)],
      [STOCK_B.name, euros(82.83)],
      ['Currency on cash', euros(10.92)],
    ])
  })
})
