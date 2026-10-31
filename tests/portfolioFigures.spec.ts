import { describe, expect, it } from 'vitest'

import type { HoldingFigures } from '../src/apps/investments/holdings/domain/holding'
import { portfolioFigures } from '../src/apps/investments/holdings/domain/portfolioFigures'
import type { PortfolioFigures } from '../src/apps/investments/holdings/domain/portfolioFigures'
import { closeIsLate } from '../src/apps/investments/prices/domain/priceBook'
import type { PriceBook } from '../src/apps/investments/prices/domain/priceBook'
import type { RateBook } from '../src/apps/investments/prices/domain/rateBook'
import type { Instrument } from '../src/apps/investments/workbook/domain/instrument'
import type { InvestmentBook } from '../src/apps/investments/workbook/domain/investmentBook'
import { decimalText } from '../src/shared/money/decimal'
import { EURO } from '../src/shared/money/currencyCode'
import {
  BROKER,
  STOCK_B,
  USD,
  WORKED_PRICES,
  WORKED_RATES,
  WORLD_ETF,
  book,
  cashMovement,
  decimal,
  dividend,
  exchange,
  instrument,
  priceBookOf,
  rateBookOf,
  split,
  trade,
  workedPortfolio,
} from './fixtures/investments'
import type { CloseRow } from './fixtures/investments'
import { civil, euros } from './fixtures/ledger'

const TODAY = civil('2026-10-29')

function figuresOf(records: InvestmentBook, prices: PriceBook = WORKED_PRICES, rates: RateBook = WORKED_RATES): PortfolioFigures {
  return portfolioFigures({ book: records, prices, rates, today: TODAY })
}

/** The five sources of the total gain added up. */
function gainFromSources(figures: PortfolioFigures): number {
  return figures.unrealised + figures.realised + figures.income.received - figures.accountFees + figures.currencyOnCash
}

function holdingOf(figures: PortfolioFigures, what: Instrument): HoldingFigures {
  return figures.holdings.find((holding) => holding.instrument.id === what.id)!
}

/** The worked closes plus another instrument's. */
function pricesWith(what: Instrument, rows: readonly CloseRow[]): PriceBook {
  const extra = priceBookOf(new Map([[what, rows]]))
  return { closeOnOrBefore: (asked, day) => (asked.id === what.id ? extra.closeOnOrBefore(asked, day) : WORKED_PRICES.closeOnOrBefore(asked, day)) }
}

describe("the worked portfolio's figures on 29 Oct 2026", () => {
  const figures = figuresOf(workedPortfolio())

  it('values the holdings at their closes and the cash at the rate of the day', () => {
    // World ETF 15 × 125.00 = 1,875.00. Stock B 15 × $58.00 = $870.00 at 1.12 = 776.79. Dollar cash $355.00 at 1.12 = 316.96.
    // 1,875.00 + 776.79 + 446.00 + 316.96 = 3,414.75.
    expect(figures.holdings.map((holding) => holding.valuation?.value)).toEqual([euros(1875), euros(776.79)])
    expect(figures.cash.map((balance) => balance.value)).toEqual([euros(446), euros(316.96)])
    expect(figures.value).toBe(euros(3414.75))
    expect(figures.unpriced).toEqual([])
    expect(figures.unratedCash).toEqual([])
  })

  it('makes up the total gain of €414.75 from its five sources, 13.8% on the €3,000.00 put in', () => {
    // Unrealised: World ETF 1,875.00 − 1,554.00 = 321.00, Stock B 776.79 − 715.00 = 61.79.
    // Realised: 254.24 − 0.85 of fees − 238.33, the quarter of the 953.33 lot the sale closed = 15.06.
    // Income: $7.00 at 1.17 = 5.98. Currency on cash: 316.96 − 306.04 = 10.92.
    expect(figures.putIn).toBe(euros(3000))
    expect(figures.cost).toBe(euros(2269))
    expect(figures.unrealised).toBe(euros(382.79))
    expect(figures.realised).toBe(euros(15.06))
    expect(figures.income).toEqual({ gross: euros(8.55), withheld: euros(2.56), received: euros(5.98) })
    expect(figures.accountFees).toBe(euros(0))
    expect(figures.currencyOnCash).toBe(euros(10.92))
    // 382.79 + 15.06 + 5.98 − 0.00 + 10.92 = 414.75 = 3,414.75 − 3,000.00.
    expect(figures.totalGain).toBe(euros(414.75))
    expect(gainFromSources(figures)).toBe(figures.totalGain)
    expect(figures.totalGainShare).toBeCloseTo(0.13825, 10)
  })

  it('gives a yearly return of 7.4% over the 665 days since the deposit', () => {
    // (3,414.75 ÷ 3,000.00) ^ (365 ÷ 665) − 1 = 0.0736613.
    expect(figures.yearlyReturn.kind).toBe('rate')
    expect(figures.yearlyReturn.kind === 'rate' && figures.yearlyReturn.rate).toBeCloseTo(0.0736613, 6)
  })

  it('gives +€16.82 on the last day, from the close of 28 Oct to that of 29 Oct', () => {
    // World ETF 15 × (125.00 − 124.00) = +15.00. Stock B 776.79 − $862.50 at 1.115 (773.54) = +3.25.
    // Dollar cash 316.96 − $355.00 at 1.115 (318.39) = −1.43. Over the 3,397.93 of 28 Oct that is +0.495%.
    expect(figures.lastDay).toMatchObject({ from: '2026-10-28', to: '2026-10-29', earlier: euros(3397.93), later: euros(3414.75), change: euros(16.82) })
    expect(figures.lastDay!.share).toBeCloseTo(0.00495007, 8)
    expect(figures.holdings.map((holding) => holding.lastDay?.change)).toEqual([euros(15), euros(3.25)])
    expect(figures.cash.map((balance) => balance.lastDay?.change)).toEqual([euros(0), euros(-1.43)])
  })

  it("splits Stock B's unrealised €61.79 into +€106.47 from the price and −€44.68 from the dollar", () => {
    const stock = holdingOf(figures, STOCK_B)

    // The open 15 shares cost $750.75 with fees. ($870.00 − $750.75) at 1.12 = 106.47, and 61.79 − 106.47 = −44.68.
    expect(decimalText(stock.costInCurrency)).toBe('750.75')
    expect(stock.pricePart).toBe(euros(106.47))
    expect(stock.currencyPart).toBe(euros(-44.68))
    expect(holdingOf(figures, WORLD_ETF).pricePart).toBe(euros(321))
    expect(holdingOf(figures, WORLD_ETF).currencyPart).toBe(euros(0))
  })

  it("shows a holding's average cost, weight, fees, first buy and the day each open lot turns tax-free", () => {
    const etf = holdingOf(figures, WORLD_ETF)
    const stock = holdingOf(figures, STOCK_B)

    // World ETF: 1,554.00 ÷ 15 = 103.60 a unit, 1,875.00 of 3,414.75 is 54.9%. Stock B: $750.75 ÷ 15 = $50.05, 776.79 of 3,414.75 is 22.7%.
    expect([decimalText(etf.averageCost!), decimalText(stock.averageCost!)]).toEqual(['103.6', '50.05'])
    expect(etf.weight).toBeCloseTo(0.5490885, 6)
    expect(stock.weight).toBeCloseTo(0.2274808, 6)
    // Stock B's fees: $1.00 at 1.05 = 0.95 and $1.00 at 1.18 = 0.85. In all, 2.00 + 2.00 + 0.95 + 0.85 = 5.80.
    expect([etf.feesPaid, stock.feesPaid, figures.feesPaid]).toEqual([euros(4), euros(1.8), euros(5.8)])
    expect([etf.firstAcquired, stock.firstAcquired]).toEqual([
      { date: '2025-01-02', by: 'buy' },
      { date: '2025-03-03', by: 'buy' },
    ])
    expect(etf.lots.map((lot) => [lot.opened, lot.taxFreeFrom])).toEqual([
      ['2025-01-02', '2027-01-03'],
      ['2025-07-01', '2027-07-02'],
    ])
    expect([stock.realised, stock.income]).toEqual([euros(15.06), euros(5.98)])
    expect([etf.feesMissing, etf.late]).toEqual([false, false])
  })
})

describe('portfolio figures', () => {
  it('adds nothing to the last day for a holding whose price is stale, and says it is late', () => {
    const fund = instrument('fund-c', { prices: 'alphavantage' })
    const records = workedPortfolio()
    const figures = figuresOf(
      {
        ...records,
        instruments: [...records.instruments, fund],
        cashMovements: [...records.cashMovements, cashMovement('deposit', BROKER, '2025-05-05', '200')],
        trades: [...records.trades, trade('buy', BROKER, fund, '2025-05-05', '20', '10', '0')],
      },
      pricesWith(fund, [['2026-10-20', '10.5']]),
    )

    // Its close of Tuesday 20 Oct values it at 210.00 on both 28 and 29 Oct, six weekdays late.
    const stale = holdingOf(figures, fund)
    expect(stale.valuation?.value).toBe(euros(210))
    expect(stale.late).toBe(true)
    expect(stale.lastDay?.change).toBe(euros(0))
    expect(figures.value).toBe(euros(3624.75))
    expect(figures.lastDay).toMatchObject({ from: '2026-10-28', to: '2026-10-29', change: euros(16.82) })
  })

  it('names a held instrument with no close and leaves it out of the value', () => {
    const fund = instrument('fund-d', { prices: 'manual' })
    const records = workedPortfolio()
    const figures = figuresOf({
      ...records,
      instruments: [...records.instruments, fund],
      cashMovements: [...records.cashMovements, cashMovement('deposit', BROKER, '2025-05-05', '100')],
      trades: [...records.trades, trade('buy', BROKER, fund, '2025-05-05', '2', '50', '0')],
    })

    expect(figures.unpriced).toEqual([fund])
    expect(figures.value).toBe(euros(3414.75))
    expect(holdingOf(figures, fund).unrealised).toBeNull()
    expect(holdingOf(figures, fund).cost).toBe(euros(100))
  })

  it("values a close from before a split in today's units", () => {
    const records = book({ accounts: [BROKER], instruments: [WORLD_ETF], trades: [trade('buy', BROKER, WORLD_ETF, '2025-01-02', '10', '1000', '0')], splits: [split(WORLD_ETF, '2026-10-29', 10, 1)] })

    // The newest close, 1,010.00 on 28 Oct, is before the 10-for-1 split, so it counts as 101.00 for each of today's 100 units.
    const etf = holdingOf(figuresOf(records, priceBookOf(new Map([[WORLD_ETF, [['2026-10-28', '1010']] as const]]))), WORLD_ETF)
    expect(decimalText(etf.valuation!.price)).toBe('101')
    expect(etf.valuation!.value).toBe(euros(10100))

    // A close on the split's own day is already in the new units, so 101.00 stays 101.00.
    const onSplitDay = holdingOf(figuresOf(records, priceBookOf(new Map([[WORLD_ETF, [['2026-10-29', '101']] as const]]))), WORLD_ETF)
    expect(decimalText(onSplitDay.valuation!.price)).toBe('101')
    expect(onSplitDay.valuation!.value).toBe(euros(10100))
  })

  it('counts the income of the last twelve months in the dividend yield, and leaves out a dividend exactly twelve months old', () => {
    const records = workedPortfolio()
    const figures = figuresOf({ ...records, income: [...records.income, dividend(BROKER, STOCK_B, '2025-10-29', '12', '3.6', '1.17'), dividend(BROKER, STOCK_B, '2026-09-15', '12', '3.6', '1.17')] })

    // $8.40 received at 1.17 = 7.18 over the 776.79 Stock B is worth. The dividends of 15 Sep 2025 and 29 Oct 2025 are a
    // year old or more. All three count in its income: 5.98 + 7.18 + 7.18 = 20.34.
    expect(holdingOf(figures, STOCK_B).dividendYield).toBeCloseTo(0.0092432, 6)
    expect(holdingOf(figures, STOCK_B).income).toBe(euros(20.34))
  })

  it('holds the yearly return back until the first deposit is a year old', () => {
    const records = book({ accounts: [BROKER], cashMovements: [cashMovement('deposit', BROKER, '2025-10-30', '1000')] })

    expect(figuresOf(records).yearlyReturn).toEqual({ kind: 'under-a-year' })
    expect(figuresOf(book({ accounts: [BROKER] })).yearlyReturn).toEqual({ kind: 'none' })
  })

  it('gives a yearly return once the first deposit is exactly twelve months old', () => {
    const records = book({ accounts: [BROKER], cashMovements: [cashMovement('deposit', BROKER, '2025-10-29', '1000')] })

    // €1,000.00 in and €1,000.00 of cash a year later is a return of zero.
    expect(figuresOf(records).yearlyReturn).toEqual({ kind: 'rate', rate: 0 })
  })

  it('hides the total gain % once more was taken out than put in, and keeps the yearly return', () => {
    const records = book({
      accounts: [BROKER],
      instruments: [WORLD_ETF],
      cashMovements: [cashMovement('deposit', BROKER, '2024-01-02', '1000'), cashMovement('withdrawal', BROKER, '2025-02-03', '1800')],
      trades: [trade('buy', BROKER, WORLD_ETF, '2024-01-02', '10', '100', '0'), trade('sell', BROKER, WORLD_ETF, '2025-01-02', '10', '200', '0')],
    })

    // 1,000.00 in, 1,800.00 out and 200.00 of cash left: put in −800.00, a gain of 1,000.00.
    const figures = figuresOf(records)
    expect([figures.putIn, figures.value, figures.totalGain]).toEqual([euros(-800), euros(200), euros(1000)])
    expect(figures.totalGainShare).toBeNull()
    expect(figures.yearlyReturn.kind).toBe('rate')
  })

  it('keeps a refused sale out of the cash as well as the lots, so the total gain still adds up from its sources', () => {
    const records = book({
      accounts: [BROKER],
      instruments: [WORLD_ETF],
      cashMovements: [cashMovement('deposit', BROKER, '2025-01-02', '1000')],
      trades: [trade('buy', BROKER, WORLD_ETF, '2025-01-02', '10', '100', '0'), trade('sell', BROKER, WORLD_ETF, '2026-01-05', '12', '110', '0')],
    })

    // The 10 units are still held at 125.00, 1,250.00, and the euro cash stays at 0.00, so the gain is 250.00, all unrealised.
    const figures = figuresOf(records, priceBookOf(new Map([[WORLD_ETF, [['2026-10-29', '125']] as const]])))
    expect(holdingOf(figures, WORLD_ETF).refused).toEqual([records.trades[1]])
    expect([figures.value, figures.totalGain, figures.unrealised]).toEqual([euros(1250), euros(250), euros(250)])
    expect(gainFromSources(figures)).toBe(figures.totalGain)
  })

  it("books a dollar sale's proceeds as the cash it brought in, to the cent, so the total gain still adds up", () => {
    const records = book({
      accounts: [BROKER],
      instruments: [STOCK_B],
      cashMovements: [cashMovement('deposit', BROKER, '2026-01-05', '1000')],
      exchanges: [exchange(BROKER, '2026-01-05', '1000', EURO, '1170', USD)],
      trades: [trade('buy', BROKER, STOCK_B, '2026-03-02', '5', '50', '0', '1.17'), trade('sell', BROKER, STOCK_B, '2026-04-01', '5', '50', '1', '1.17')],
    })

    // The sale brings in $249.00, €212.82 at 1.17, against a cost of $250.00, €213.68, so −0.86. Its $250.00 and $1.00 fee
    // would convert to €213.68 and €0.85 one by one, a cent more than the cash it brought in.
    const figures = figuresOf(records)
    const [line] = holdingOf(figures, STOCK_B).sales[0]!.lines
    expect([line!.proceeds, line!.fees, line!.gain]).toEqual([euros(213.67), euros(0.85), euros(-0.86)])
    expect(figures.realised).toBe(euros(-0.86))
    expect(gainFromSources(figures)).toBe(figures.totalGain)
  })

  it('names a foreign balance with no ECB rate yet and leaves it out of the value', () => {
    const records = book({ accounts: [BROKER], cashMovements: [cashMovement('deposit', BROKER, '2025-01-02', '1100', USD, '1.1')] })

    const figures = figuresOf(records, priceBookOf(new Map()), rateBookOf(new Map()))
    expect(figures.unratedCash.map((balance) => [balance.account, balance.currency, decimalText(balance.balance)])).toEqual([[BROKER.id, 'USD', '1100']])
    expect([figures.value, figures.totalGain]).toEqual([euros(0), euros(-1000)])
  })

  it('values a balance of zero at nothing without a rate', () => {
    const records = book({
      accounts: [BROKER],
      cashMovements: [cashMovement('deposit', BROKER, '2025-01-02', '1100', USD, '1.1'), cashMovement('withdrawal', BROKER, '2025-02-03', '1100', USD, '1.1')],
    })

    const figures = figuresOf(records, priceBookOf(new Map()), rateBookOf(new Map()))
    expect(figures.cash.map((balance) => balance.value)).toEqual([euros(0)])
    expect(figures.unratedCash).toEqual([])
  })

  it('flags a holding whose trades leave a fee not entered', () => {
    const records = workedPortfolio()
    const figures = figuresOf({ ...records, trades: [...records.trades, trade('buy', BROKER, WORLD_ETF, '2026-03-02', '1', '120', null)] })

    expect(holdingOf(figures, WORLD_ETF).feesMissing).toBe(true)
    expect(holdingOf(figures, STOCK_B).feesMissing).toBe(false)
  })
})

describe('closeIsLate', () => {
  const friday = civil('2026-10-30')

  it('lets a fetched close lag up to two weekdays, so an exchange holiday is no alarm', () => {
    expect(closeIsLate({ date: civil('2026-10-29'), price: decimal('1'), byHand: false }, friday)).toBe(false)
    expect(closeIsLate({ date: civil('2026-10-27'), price: decimal('1'), byHand: false }, friday)).toBe(false)
    // Tuesday, Wednesday and Thursday passed without a close.
    expect(closeIsLate({ date: civil('2026-10-26'), price: decimal('1'), byHand: false }, friday)).toBe(true)
  })

  it('lets a price entered by hand lag 35 days', () => {
    expect(closeIsLate({ date: civil('2026-09-25'), price: decimal('1'), byHand: true }, friday)).toBe(false)
    expect(closeIsLate({ date: civil('2026-09-24'), price: decimal('1'), byHand: true }, friday)).toBe(true)
  })
})
