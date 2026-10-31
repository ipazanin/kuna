import { describe, expect, it } from 'vitest'

import { holdingReturn, priceInTodaysUnits } from '../src/apps/investments/holdings/domain/holding'
import { holdingRecords } from '../src/apps/investments/holdings/domain/holdingRecords'
import { latestRecords } from '../src/apps/investments/holdings/domain/latestRecords'
import { lotIsTaxFree, taxFreeUnits } from '../src/apps/investments/holdings/domain/lots'
import { portfolioFigures } from '../src/apps/investments/holdings/domain/portfolioFigures'
import type { PortfolioFigures } from '../src/apps/investments/holdings/domain/portfolioFigures'
import { priceHistory } from '../src/apps/investments/holdings/domain/priceHistory'
import type { Instrument } from '../src/apps/investments/workbook/domain/instrument'
import type { InvestmentBook } from '../src/apps/investments/workbook/domain/investmentBook'
import { decimalText } from '../src/shared/money/decimal'
import { BROKER, STOCK_B, WORKED_PRICES, WORKED_RATES, WORLD_ETF, book, cashMovement, decimal, instrument, priceBookOf, spinOff, split, trade, workedPortfolio } from './fixtures/investments'
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

  it('marks the buy at 100 as 50 in today’s units and the sale after the split as it was', () => {
    expect(priceHistory(holding, sources).marks.map((mark) => [mark.trade.side, decimalText(mark.price)])).toEqual([
      ['buy', '50'],
      ['sell', '53'],
    ])
    // A split counts before the trades of its own day, so a price of that day is already in the new units.
    expect(decimalText(priceInTodaysUnits(records, splitCo, civil('2025-03-09'), decimal('100')))).toBe('50')
    expect(decimalText(priceInTodaysUnits(records, splitCo, civil('2025-03-10'), decimal('100')))).toBe('100')
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
