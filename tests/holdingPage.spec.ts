import { describe, expect, it } from 'vitest'

import { holdingReturn, priceInTodaysUnits, quantityInTodaysUnits } from '../src/apps/investments/holdings/domain/holding'
import { holdingRecords } from '../src/apps/investments/holdings/domain/holdingRecords'
import { latestRecords } from '../src/apps/investments/holdings/domain/latestRecords'
import { lotIsTaxFree, taxFreeUnits } from '../src/apps/investments/holdings/domain/lots'
import { portfolioFigures } from '../src/apps/investments/holdings/domain/portfolioFigures'
import type { PortfolioFigures } from '../src/apps/investments/holdings/domain/portfolioFigures'
import { priceHistory, yearRange } from '../src/apps/investments/holdings/domain/priceHistory'
import type { Instrument } from '../src/apps/investments/workbook/domain/instrument'
import type { InvestmentBook } from '../src/apps/investments/workbook/domain/investmentBook'
import { addDays, weekdaysBetween } from '../src/shared/calendar/civilDate'
import { monthOf } from '../src/shared/calendar/monthKey'
import { decimalText } from '../src/shared/money/decimal'
import {
  BROKER,
  STOCK_B,
  WORKED_PRICES,
  WORKED_RATES,
  WORLD_ETF,
  book,
  cashMovement,
  decimal,
  instrument,
  priceBookOf,
  rateBookOf,
  spinOff,
  split,
  trade,
  workedPortfolio,
} from './fixtures/investments'
import type { CloseRow } from './fixtures/investments'
import { civil, euros } from './fixtures/ledger'

const TODAY = civil('2026-10-29')

function figuresOf(records: InvestmentBook): PortfolioFigures {
  return portfolioFigures({ book: records, prices: WORKED_PRICES, rates: WORKED_RATES, today: TODAY })
}

function holdingOf(figures: PortfolioFigures, what: Instrument) {
  const found = figures.holdings.find((holding) => holding.instrument.id === what.id)
  if (found === undefined) throw new Error(`${what.name} is not in the figures.`)
  return found
}

describe("a holding's total return", () => {
  it("splits Stock B's +€82.83 into price, currency, its sale and its dividend, on the €953.33 it all cost", () => {
    // 61.79 held (+106.47 from the price, −44.68 from the dollar) + 15.06 realised + 5.98 of income = 82.83.
    // The open lot's 715.00 and the 238.33 the sale closed make the 953.33 paid.
    const returns = holdingReturn(holdingOf(figuresOf(workedPortfolio()), STOCK_B))

    expect(returns).toMatchObject({ total: euros(82.83), price: euros(106.47), currency: euros(-44.68), realised: euros(15.06), income: euros(5.98) })
    expect(returns.share).toBeCloseTo(82.83 / 953.33, 6)
  })

  it('has no currency part for a holding in euros', () => {
    const returns = holdingReturn(holdingOf(figuresOf(workedPortfolio()), WORLD_ETF))

    expect(returns).toMatchObject({ total: euros(321), price: euros(321), currency: euros(0), realised: euros(0), income: euros(0) })
  })

  it('keeps what a holding sold whole realised, with no price or currency part', () => {
    const soldCo = instrument('sold-co', { name: 'Sold Co' })
    const records = book({
      accounts: [BROKER],
      instruments: [soldCo],
      cashMovements: [cashMovement('deposit', BROKER, '2025-05-05', '100')],
      trades: [trade('buy', BROKER, soldCo, '2025-05-05', '10', '10', '0'), trade('sell', BROKER, soldCo, '2025-06-02', '10', '12', '0')],
    })

    expect(holdingReturn(holdingOf(figuresOf(records), soldCo))).toEqual({ total: euros(20), share: 0.2, price: null, currency: null, realised: euros(20), income: euros(0) })
  })

  it('waits while what is held has no price', () => {
    const unpriced = instrument('unpriced', { prices: 'manual', sourceSymbol: '' })
    const records = book({
      accounts: [BROKER],
      instruments: [unpriced],
      cashMovements: [cashMovement('deposit', BROKER, '2025-05-05', '100')],
      trades: [trade('buy', BROKER, unpriced, '2025-05-05', '10', '10', '0')],
    })

    expect(holdingReturn(holdingOf(figuresOf(records), unpriced))).toMatchObject({ total: null, share: null, price: null, currency: null })
  })
})

describe("how a holding's first units came", () => {
  it('names the buy for a parent and the spin-off day for the units it gave', () => {
    // Parent Co bought on 1 Feb 2023 and Spun Co received from it on 20 Sep 2024, every figure made up.
    const parent = instrument('parent-co', { name: 'Parent Co' })
    const spun = instrument('spun-co', { name: 'Spun Co' })
    const figures = figuresOf(
      book({
        accounts: [BROKER],
        instruments: [parent, spun],
        cashMovements: [cashMovement('deposit', BROKER, '2023-02-01', '1000')],
        trades: [trade('buy', BROKER, parent, '2023-02-01', '10', '50', '0')],
        spinOffs: [spinOff(parent, spun, '2024-09-20', '5', '0.2')],
      }),
    )
    expect(holdingOf(figures, parent).firstAcquired).toEqual({ date: '2023-02-01', by: 'buy' })
    expect(holdingOf(figures, spun).firstAcquired).toEqual({ date: '2024-09-20', by: 'spin-off' })
  })
})

describe('the units past two years', () => {
  const lots = holdingOf(figuresOf(workedPortfolio()), WORLD_ETF).lots

  it('counts none of the World ETF on 29 Oct 2026, with the first lot free from 3 Jan 2027', () => {
    expect(taxFreeUnits(lots, TODAY)).toEqual({ taxFree: 0n, held: 15n * 10n ** 12n, next: '2027-01-03' })
  })

  it('counts the first lot on its day and both once the second is past two years too', () => {
    expect(lotIsTaxFree(lots[0]!, civil('2027-01-02'))).toBe(false)
    expect(lotIsTaxFree(lots[0]!, civil('2027-01-03'))).toBe(true)
    expect(decimalText(taxFreeUnits(lots, civil('2027-03-01')).taxFree)).toBe('10')
    expect(taxFreeUnits(lots, civil('2027-03-01')).next).toBe('2027-07-02')
    expect(taxFreeUnits(lots, civil('2027-08-01'))).toMatchObject({ taxFree: 15n * 10n ** 12n, next: null })
  })
})

describe("a holding's price history", () => {
  // Bought on 15 Jan, split two for one on 10 Mar, partly sold on 1 Apr, every figure made up.
  const splitCo = instrument('split-co', { name: 'Split Co' })
  const records = book({
    accounts: [BROKER],
    instruments: [splitCo],
    cashMovements: [cashMovement('deposit', BROKER, '2025-01-15', '1000')],
    trades: [trade('buy', BROKER, splitCo, '2025-01-15', '10', '100', '0'), trade('sell', BROKER, splitCo, '2025-04-01', '4', '53', '0')],
    splits: [split(splitCo, '2025-03-10', 2, 1)],
  })
  const prices = priceBookOf(
    new Map([
      [
        splitCo,
        [
          ['2025-02-03', '102'],
          ['2025-02-28', '104'],
          ['2025-03-31', '54'],
          ['2025-04-14', '55'],
        ],
      ],
    ]),
  )
  const today = civil('2025-04-15')
  const sources = { book: records, prices, rates: WORKED_RATES, today }
  const holding = holdingOf(portfolioFigures(sources), splitCo)

  it('gives each month end from the first close and the day, in the units held today', () => {
    // 31 Jan has no close yet. 104 before the split is 52 a unit today.
    expect(priceHistory(holding, sources).points.map((point) => [point.date, decimalText(point.price)])).toEqual([
      ['2025-02-28', '52'],
      ['2025-03-31', '54'],
      ['2025-04-15', '55'],
    ])
  })

  it('leaves out the January buy, before the first close, and dots the sale after the split as it was', () => {
    expect(priceHistory(holding, sources).dots.map((dot) => [dot.side, monthOf(dot.date), decimalText(dot.units), decimalText(dot.price), dot.amount])).toEqual([
      ['sell', '2025-04', '4', '53', euros(212)],
    ])
  })

  it('takes a price and a quantity of before the split into today’s units', () => {
    // A split counts before the trades of its own day, so a price of that day is already in the new units.
    expect(decimalText(priceInTodaysUnits(records, splitCo, civil('2025-03-09'), decimal('100')))).toBe('50')
    expect(decimalText(priceInTodaysUnits(records, splitCo, civil('2025-03-10'), decimal('100')))).toBe('100')
    expect(decimalText(quantityInTodaysUnits(records, splitCo, civil('2025-01-15'), decimal('10')))).toBe('20')
    expect(decimalText(quantityInTodaysUnits(records, splitCo, civil('2025-03-10'), decimal('10')))).toBe('10')
  })
})

describe("a holding's 52-week range", () => {
  const TECH = instrument('tech', { name: 'Example Tech' })

  /** A close of 100 on every weekday from the first day to 29 October 2026, with the closes given in their place. */
  function weekdayCloses(first: string, given: Readonly<Record<string, string>>): CloseRow[] {
    const rows: CloseRow[] = []
    for (let day = civil(first); day <= TODAY; day = addDays(day, 1)) {
      if (weekdaysBetween(day, day) === 1) rows.push([day, given[day] ?? '100'])
    }
    return rows
  }

  function rangeOf(rows: readonly CloseRow[]) {
    const sources = { book: book({ instruments: [TECH] }), prices: priceBookOf(new Map([[TECH, rows]])), rates: rateBookOf(new Map()), today: TODAY }
    return yearRange(TECH, sources)
  }

  it('takes the lowest and highest close of the year to the day, leaving out a close from before it', () => {
    const range = rangeOf([['2025-10-01', '50'], ...weekdayCloses('2025-10-30', { '2026-02-03': '80.5', '2026-08-12': '130.25' })])

    expect(range).toEqual({
      low: { date: civil('2026-02-03'), price: decimal('80.5') },
      high: { date: civil('2026-08-12'), price: decimal('130.25') },
      from: civil('2025-10-30'),
      to: TODAY,
      ended: false,
      wholeYear: true,
      daily: true,
    })
  })

  it('says the closes do not cover the year when the first falls well inside it', () => {
    expect(rangeOf(weekdayCloses('2026-03-02', {}))).toMatchObject({ from: civil('2026-03-02'), wholeYear: false, daily: true })
    expect(rangeOf(weekdayCloses('2025-11-05', {}))).toMatchObject({ wholeYear: true })
  })

  it('says a range of month-end closes is not daily', () => {
    const monthEnds: CloseRow[] = [
      ['2025-11-28', '90'],
      ['2025-12-31', '95'],
      ['2026-01-30', '99'],
      ['2026-02-27', '101'],
    ]

    expect(rangeOf(monthEnds)).toMatchObject({ low: { date: civil('2025-11-28'), price: decimal('90') }, daily: false })
  })

  it('ends the range of a holding sold in the year at its last close, and has none with no close in the year', () => {
    const untilSale = weekdayCloses('2025-10-30', {}).filter(([day]) => day <= '2026-06-15')

    expect(rangeOf(untilSale)).toMatchObject({ from: civil('2025-10-30'), to: civil('2026-06-15'), ended: true, wholeYear: false, daily: true })
    expect(rangeOf([['2025-09-30', '100']])).toBeNull()
  })
})

describe("a holding's records", () => {
  it("keeps Stock B's buy, sale and dividend and drops the deposit, the exchange and the World ETF", () => {
    const records = holdingRecords(workedPortfolio(), STOCK_B.id)
    const listed = latestRecords(records, WORKED_RATES)

    expect(listed.map((entry) => [entry.kind, entry.record.date])).toEqual([
      ['trade', '2026-02-02'],
      ['income', '2025-09-15'],
      ['trade', '2025-03-03'],
    ])
    expect(records.instruments).toEqual(workedPortfolio().instruments)
  })
})
