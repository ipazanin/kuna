import { afterEach, describe, expect, it, vi } from 'vitest'

import { gainSources, incomeAgainstLastYear, lastDayMovers, noticeIsEmpty, pricesNotice, valueByClass, valueByCurrency } from '../src/apps/investments/overview/domain/overviewFigures'
import { shownValueOverTime, valueOverTime } from '../src/apps/investments/overview/domain/valueOverTime'
import { rollingPeriods } from '../src/apps/investments/performance/domain/performancePeriod'
import { firstDepositIn } from '../src/apps/investments/performance/domain/portfolioPerformance'
import { accountCash } from '../src/apps/investments/holdings/domain/accountCash'
import { latestRecords } from '../src/apps/investments/holdings/domain/latestRecords'
import { figuresClose, portfolioFigures } from '../src/apps/investments/holdings/domain/portfolioFigures'
import type { PortfolioFigures } from '../src/apps/investments/holdings/domain/portfolioFigures'
import type { PriceBook } from '../src/apps/investments/prices/domain/priceBook'
import type { Instrument } from '../src/apps/investments/workbook/domain/instrument'
import { hasTransactions } from '../src/apps/investments/workbook/domain/investmentBook'
import type { InvestmentBook } from '../src/apps/investments/workbook/domain/investmentBook'
import { EURO } from '../src/shared/money/currencyCode'
import { decimalText } from '../src/shared/money/decimal'
import { BROKER, STOCK_B, USD, WORKED_PRICES, WORKED_RATES, WORLD_ETF, book, cashMovement, dividend, instrument, priceBookOf, rateBookOf, trade, workedPortfolio } from './fixtures/investments'
import type { CloseRow } from './fixtures/investments'
import { civil, euros } from './fixtures/ledger'

const TODAY = civil('2026-10-29')

function figuresOf(records: InvestmentBook, prices: PriceBook = WORKED_PRICES): PortfolioFigures {
  return portfolioFigures({ book: records, prices, rates: WORKED_RATES, today: TODAY })
}

/** The worked closes plus another instrument's. */
function pricesWith(what: Instrument, rows: readonly CloseRow[]): PriceBook {
  const extra = priceBookOf(new Map([[what, rows]]))
  return { closeOnOrBefore: (asked, day) => (asked.id === what.id ? extra.closeOnOrBefore(asked, day) : WORKED_PRICES.closeOnOrBefore(asked, day)) }
}

/** The worked portfolio with one more instrument bought on 5 May 2025 out of a deposit of the same day. */
function workedWith(what: Instrument, quantity: string, price: string): InvestmentBook {
  const records = workedPortfolio()
  return {
    ...records,
    instruments: [...records.instruments, what],
    cashMovements: [...records.cashMovements, cashMovement('deposit', BROKER, '2025-05-05', String(Number(quantity) * Number(price)))],
    trades: [...records.trades, trade('buy', BROKER, what, '2025-05-05', quantity, price, '0')],
  }
}

describe("the worked portfolio's Overview on 29 Oct 2026", () => {
  const figures = figuresOf(workedPortfolio())

  it('is at the close of 29 Oct, with nothing to name in the notice', () => {
    expect(figuresClose(figures)).toBe('2026-10-29')
    expect(noticeIsEmpty(pricesNotice(figures))).toBe(true)
  })

  it('makes up the total gain of €414.75 from five parts, with the €5.80 of trading fees inside them', () => {
    // 382.79 on what is held + 15.06 realised + 5.98 of income − 0.00 of account fees + 10.92 of currency on cash = 414.75.
    expect(gainSources(figures)).toEqual({
      parts: [
        { source: 'held', amount: euros(382.79) },
        { source: 'realised', amount: euros(15.06) },
        { source: 'income', amount: euros(5.98) },
        { source: 'account-fees', amount: euros(0) },
        { source: 'currency-on-cash', amount: euros(10.92) },
      ],
      total: euros(414.75),
      addsUp: true,
      tradingFees: euros(5.8),
    })
  })

  it('puts the money in stocks and cash, and in euros and dollars, largest first', () => {
    // Stocks: 1,875.00 + 776.79 = 2,651.79 of 3,414.75. Cash: 446.00 + 316.96 = 762.96.
    expect(valueByClass(figures).map((part) => [part.group, part.value])).toEqual([
      ['stocks', euros(2651.79)],
      ['cash', euros(762.96)],
    ])
    expect(valueByClass(figures)[0]!.share).toBeCloseTo(0.776569, 6)
    // Euros: 1,875.00 + 446.00 = 2,321.00. Dollars: 776.79 + 316.96 = 1,093.75.
    expect(valueByCurrency(figures).map((part) => [part.group, part.value])).toEqual([
      [EURO, euros(2321)],
      [USD, euros(1093.75)],
    ])
  })

  it('lists the movers of the last day by share, the World ETF ahead of Stock B', () => {
    // World ETF +15.00 on 1,860.00 is +0.81%. Stock B +3.25 on 773.54 is +0.42%.
    expect(lastDayMovers(figures, 3)).toEqual({ up: [figures.holdings[0], figures.holdings[1]], down: [] })
    expect(lastDayMovers(figures, 1).up.map((holding) => holding.instrument)).toEqual([WORLD_ETF])
  })

  it('compares no income so far in 2026 with the €5.98 of the same months of 2025', () => {
    expect(incomeAgainstLastYear(workedPortfolio(), TODAY)).toEqual({ year: 2026, thisYear: euros(0), sameMonthsLastYear: euros(5.98), change: euros(-5.98) })
  })

  it('lists the five newest records with their euros signed as they move cash, the sale first', () => {
    // The sale's $299.00 at 1.18 = 253.39. Stock B's buy of $1,001.00 at 1.05 = 953.33. On 3 Mar the exchange comes before the buy.
    expect(latestRecords(workedPortfolio(), WORKED_RATES, 5).map((entry) => [entry.kind, entry.record.date, 'euros' in entry ? entry.euros : null])).toEqual([
      ['trade', '2026-02-02', euros(253.39)],
      ['income', '2025-09-15', euros(5.98)],
      ['trade', '2025-07-01', euros(-552)],
      ['exchange', '2025-03-03', euros(1000)],
      ['trade', '2025-03-03', euros(-953.33)],
    ])
  })

  it('signs a withdrawal and a fee below zero, and a deposit and a fee refund above it', () => {
    const records = book({
      accounts: [BROKER],
      cashMovements: [
        cashMovement('deposit', BROKER, '2026-01-02', '100'),
        cashMovement('withdrawal', BROKER, '2026-01-03', '40'),
        cashMovement('fee', BROKER, '2026-01-04', '3'),
        cashMovement('fee-refund', BROKER, '2026-01-05', '1'),
      ],
    })

    expect(latestRecords(records, WORKED_RATES, 4).map((entry) => ('euros' in entry ? entry.euros : null))).toEqual([euros(1), euros(-3), euros(-40), euros(100)])
  })
})

describe("the Overview's notice", () => {
  it('names a late close, a price entered by hand, a holding with no price and cash below zero', () => {
    const late = instrument('late-fund', { prices: 'alphavantage' })
    const byHand = instrument('hand-fund', { prices: 'manual' })
    const unpriced = instrument('new-fund', { prices: 'manual' })
    const lateFigures = figuresOf(workedWith(late, '20', '10'), pricesWith(late, [['2026-10-20', '10.5']]))
    const handFigures = figuresOf(workedWith(byHand, '20', '10'), pricesWith(byHand, [['2026-10-01', '10.2', 'by hand']]))
    const unpricedFigures = figuresOf(workedWith(unpriced, '2', '50'))
    const records = workedPortfolio()
    const belowZero = figuresOf({ ...records, trades: [...records.trades, trade('buy', BROKER, WORLD_ETF, '2026-03-02', '10', '120', '0')] })

    expect(pricesNotice(lateFigures).late.map((holding) => holding.instrument)).toEqual([late])
    expect(pricesNotice(handFigures)).toMatchObject({ late: [], unpriced: [], cashBelowZero: [] })
    expect(pricesNotice(handFigures).byHand.map((holding) => holding.instrument)).toEqual([byHand])
    expect(pricesNotice(unpricedFigures).unpriced).toEqual([unpriced])
    // 446.00 of euro cash less a buy of 1,200.00 leaves −754.00.
    expect(pricesNotice(belowZero).cashBelowZero.map((balance) => [balance.currency, balance.value])).toEqual([[EURO, euros(-754)]])
  })

  it('says the parts of the gain leave out a holding with no price', () => {
    // The total gain counts the 100.00 put into it and nothing of its worth, the parts count nothing of it.
    const sources = gainSources(figuresOf(workedWith(instrument('new-fund', { prices: 'manual' }), '2', '50')))
    expect(sources.total).toBe(euros(314.75))
    expect(sources.addsUp).toBe(false)
  })
})

describe('a dividend the broker reversed', () => {
  const SHARE = instrument('euroshare')
  const PAID = dividend(BROKER, SHARE, '2026-03-02', '10', '1.5')
  const REVERSED = { ...dividend(BROKER, SHARE, '2026-03-09', '-10', '-1.5'), note: 'Reverses a dividend' }
  const REBOOKED = dividend(BROKER, SHARE, '2026-03-10', '10.5', '1.58')

  function withIncome(...income: InvestmentBook['income'][number][]): InvestmentBook {
    return book({ accounts: [BROKER], instruments: [SHARE], income })
  }

  function euroCash(records: InvestmentBook): string {
    const balance = accountCash(records, rateBookOf(new Map()), new Set()).balances.find((cash) => cash.currency === EURO)
    return balance === undefined ? '0' : decimalText(balance.balance)
  }

  it('nets to no income and no change of cash with its reversal and the tax given back', () => {
    const records = withIncome(PAID, REVERSED)
    expect(incomeAgainstLastYear(records, TODAY).thisYear).toBe(euros(0))
    expect(figuresOf(records).income).toEqual({ gross: euros(0), withheld: euros(0), received: euros(0) })
    expect(euroCash(records)).toBe('0')
  })

  it('leaves the corrected figure once the broker books the dividend again', () => {
    // 10.00 − 10.00 + 10.50 gross, 1.50 − 1.50 + 1.58 withheld, so 8.92 received.
    const records = withIncome(PAID, REVERSED, REBOOKED)
    expect(incomeAgainstLastYear(records, TODAY).thisYear).toBe(euros(8.92))
    expect(figuresOf(records).income).toEqual({ gross: euros(10.5), withheld: euros(1.58), received: euros(8.92) })
    expect(euroCash(records)).toBe('8.92')
  })
})

describe('the value over time', () => {
  const ETF = instrument('etf', { name: 'ETF' })
  const LATE_LISTED = instrument('late-listed', { name: 'Late Listed' })
  const PRICES = priceBookOf(
    new Map<Instrument, readonly CloseRow[]>([
      [
        ETF,
        [
          ['2026-01-30', '101'],
          ['2026-02-27', '103'],
          ['2026-03-31', '99'],
          ['2026-04-09', '105'],
        ],
      ],
    ]),
  )
  const PRICES_FROM_2025 = priceBookOf(new Map<Instrument, readonly CloseRow[]>([[ETF, [['2025-01-31', '101']]]]))
  const RATES = rateBookOf(new Map())
  const records = book({
    accounts: [BROKER],
    instruments: [ETF],
    cashMovements: [cashMovement('deposit', BROKER, '2026-01-15', '1100'), cashMovement('withdrawal', BROKER, '2026-03-10', '100')],
    trades: [trade('buy', BROKER, ETF, '2026-01-15', '10', '100', '0')],
  })

  it('values each month end and the last day against what was put in less what was taken out', () => {
    const over = valueOverTime({ book: records, prices: PRICES, rates: RATES, today: civil('2026-04-10') }, { kind: 'all' })

    // 31 Jan: 10 × 101 + 100 of cash = 1,110 against 1,100. 31 Mar: 990 + 0 against 1,000. 10 Apr: 1,050 against 1,000, 50 of gain.
    expect(over.points).toEqual([
      { date: '2026-01-31', value: euros(1110), putIn: euros(1100), gain: euros(10) },
      { date: '2026-02-28', value: euros(1130), putIn: euros(1100), gain: euros(30) },
      { date: '2026-03-31', value: euros(990), putIn: euros(1000), gain: euros(-10) },
      { date: '2026-04-10', value: euros(1050), putIn: euros(1000), gain: euros(50) },
    ])
    expect(over.heldBack).toEqual({ instruments: [], currencies: [] })
  })

  it('starts once every holding has a price, and names the holding that held it back', () => {
    const later = book({
      ...records,
      instruments: [LATE_LISTED, ETF],
      cashMovements: [...records.cashMovements, cashMovement('deposit', BROKER, '2026-01-16', '50')],
      trades: [...records.trades, trade('buy', BROKER, LATE_LISTED, '2026-01-16', '1', '50', '0')],
    })
    const prices = priceBookOf(
      new Map<Instrument, readonly CloseRow[]>([
        [ETF, [['2026-01-30', '101']]],
        [LATE_LISTED, [['2026-02-20', '52']]],
      ]),
    )
    const over = valueOverTime({ book: later, prices, rates: RATES, today: civil('2026-03-05') }, { kind: 'all' })

    // 31 Jan has no close for Late Listed, so the chart starts on 28 Feb: 1,010 + 52 + 100 of cash = 1,162.
    expect(over.points.map((point) => [point.date, point.value])).toEqual([
      ['2026-02-28', euros(1162)],
      ['2026-03-05', euros(1162)],
    ])
    expect(over.heldBack.instruments).toEqual([LATE_LISTED])
  })

  it('keeps to the period asked for, from the same day a year back', () => {
    const over = valueOverTime({ book: workedPortfolio(), prices: WORKED_PRICES, rates: WORKED_RATES, today: TODAY }, { kind: 'years', years: 1 })

    // The worked closes start on 28 Oct 2026, so only the last day has every holding priced.
    expect(over.points.map((point) => point.date)).toEqual(['2026-10-29'])
    expect(over.heldBack.instruments).toEqual([WORLD_ETF, STOCK_B])
  })

  it('shows everything when no day of the period picked has every holding priced', () => {
    const unpricedSince = book({
      accounts: [BROKER],
      instruments: [ETF, LATE_LISTED],
      cashMovements: [cashMovement('deposit', BROKER, '2025-01-15', '1100'), cashMovement('deposit', BROKER, '2025-06-02', '50')],
      trades: [trade('buy', BROKER, ETF, '2025-01-15', '10', '100', '0'), trade('buy', BROKER, LATE_LISTED, '2025-06-02', '1', '50', '0')],
    })
    const sources = { book: unpricedSince, prices: PRICES_FROM_2025, rates: RATES, today: civil('2026-10-10') }

    // Late Listed has had no price since it was bought on 2 Jun 2025, so the last year has no whole day, while January to May 2025 do.
    expect(valueOverTime(sources, { kind: 'years', years: 1 }).points).toEqual([])
    const shown = shownValueOverTime(sources, { kind: 'years', years: 1 })
    expect(shown.period).toEqual({ kind: 'all' })
    expect(shown.over.points.map((point) => point.date).slice(0, 2)).toEqual(['2025-01-31', '2025-02-28'])
    expect(shownValueOverTime(sources, { kind: 'all' }).period).toEqual({ kind: 'all' })
  })

  it('offers the last one, three and five years only when the first deposit is older', () => {
    expect(rollingPeriods(firstDepositIn(workedPortfolio()), TODAY)).toEqual([{ kind: 'years', years: 1 }, { kind: 'all' }])
    expect(rollingPeriods(firstDepositIn(records), civil('2026-04-10'))).toEqual([{ kind: 'all' }])
    expect(rollingPeriods(firstDepositIn(book({})), TODAY)).toEqual([{ kind: 'all' }])
  })
})

describe('whether the file holds transactions', () => {
  it('counts records of what happened, not accounts, instruments or prices', () => {
    expect(hasTransactions(book({ accounts: [BROKER], instruments: [WORLD_ETF] }))).toBe(false)
    expect(hasTransactions(book({ income: [dividend(BROKER, STOCK_B, '2025-09-15', '10', '3', '1.17')] }))).toBe(true)
  })
})

describe('the day the figures are at', () => {
  afterEach(() => {
    vi.doUnmock('../src/shared/text/language')
  })

  it('names the weekday, and Croatian writes the month as a number without padding', async () => {
    const { weekdayDayLabel } = await import('../src/shared/calendar/dayLabel')
    expect(weekdayDayLabel(civil('2026-10-29'))).toBe('Thursday 29 Oct')

    vi.resetModules()
    vi.doMock('../src/shared/text/language', () => ({ language: 'hr', intlLocale: 'hr-HR' }))
    const croatian = await import('../src/shared/calendar/dayLabel')
    expect(croatian.weekdayDayLabel(civil('2026-09-03'))).toBe('četvrtak,\u00a03.\u00a09.')
  })
})
