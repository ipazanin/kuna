import { describe, expect, it } from 'vitest'

import type { PortfolioSources } from '../src/apps/investments/holdings/domain/holding'
import { recentCosts, yearlyCosts } from '../src/apps/investments/income/domain/yearlyCosts'
import { dayValuer } from '../src/apps/investments/performance/domain/portfolioPerformance'
import { fetchedFactsBook } from '../src/apps/investments/prices/domain/factsBook'
import type { FactsBook } from '../src/apps/investments/prices/domain/factsBook'
import { NO_FETCHED_FACTS } from '../src/apps/investments/prices/domain/pricesFile'
import type { InvestmentBook } from '../src/apps/investments/workbook/domain/investmentBook'
import { EURO } from '../src/shared/money/currencyCode'
import { BROKER, USD, WORKED_PRICES, WORKED_RATES, book, cashMovement, decimal, exchange, instrument, priceBookOf, rateBookOf, trade, workedPortfolio } from './fixtures/investments'
import { fundFact } from './fixtures/facts'
import { civil, euros } from './fixtures/ledger'

const FUND = instrument('world-fund', { name: 'World fund', type: 'fund', ter: decimal('0.2') })
const FUND_PRICES = priceBookOf(new Map([[FUND, [['2025-01-02', '100']] as const]]))
const NO_RATES = rateBookOf(new Map())
const NOTHING_FETCHED = fetchedFactsBook(NO_FETCHED_FACTS)
/** Alpha Vantage's fund profile of the fund, with a TER of 0.30%. */
const FETCHED_TER = fetchedFactsBook({ ...NO_FETCHED_FACTS, funds: { 'alphavantage:WORLD-FUND': fundFact('2026-01-02', { expenseRatio: '0.003' }) } })

function costsOf(records: InvestmentBook, today: string, sources: Partial<PortfolioSources> = {}, facts: FactsBook = NOTHING_FETCHED) {
  const all: PortfolioSources = { book: records, prices: FUND_PRICES, rates: NO_RATES, today: civil(today), ...sources }
  return yearlyCosts(all, dayValuer(all), facts)
}

/** €10,000.00 of the fund bought on the day out of a deposit of the same. */
function fundBoughtOn(date: string): InvestmentBook {
  return book({
    accounts: [BROKER],
    instruments: [FUND],
    cashMovements: [cashMovement('deposit', BROKER, date, '10000')],
    trades: [trade('buy', BROKER, FUND, date, '100', '100', '0')],
  })
}

describe("the worked portfolio's costs", () => {
  it('has €4.95 of trading fees in 2025 and €0.85 in 2026', () => {
    // 2025: €2.00, $1.00 at 1.05 as €0.95, and €2.00. 2026: $1.00 at 1.18 as €0.85.
    const years = costsOf(workedPortfolio(), '2026-10-29', { prices: WORKED_PRICES, rates: WORKED_RATES })
    expect(years.map((year) => [year.year, year.trading])).toEqual([
      [2026, euros(0.85)],
      [2025, euros(4.95)],
    ])
    expect(years.every((year) => year.funds.length === 0 && year.exchange === 0 && year.account === 0)).toBe(true)
  })
})

describe('fund costs from the TER', () => {
  it('costs €20.00 for a fund at €10,000.00 at every month end of 2025 with a 0.20% TER', () => {
    const [, year2025] = costsOf(fundBoughtOn('2025-01-02'), '2026-01-15')
    expect(year2025).toMatchObject({ year: 2025, fundCosts: euros(20), total: euros(20), averageValue: euros(10000), share: 0.002 })
    expect(year2025?.funds).toEqual([{ instrument: FUND, ter: { percent: decimal('0.2'), vendor: null }, cost: euros(20) }])
  })

  it('costs a fund with no TER typed at the TER of its fetched fund profile, and a typed TER ahead of it', () => {
    const records = fundBoughtOn('2025-01-02')
    const fetchedFund = { ...FUND, ter: null }
    const [, fetched] = costsOf({ ...records, instruments: [fetchedFund] }, '2026-01-15', {}, FETCHED_TER)
    // 0.30% of €10,000.00 at every month end is €30.00.
    expect(fetched?.funds).toEqual([{ instrument: fetchedFund, ter: { percent: decimal('0.3'), vendor: 'alphavantage' }, cost: euros(30) }])

    const [, typed] = costsOf({ ...records, instruments: [{ ...fetchedFund, ter: decimal('0.2') }] }, '2026-01-15', {}, FETCHED_TER)
    expect(typed?.funds.map((fund) => [fund.ter, fund.cost])).toEqual([[{ percent: decimal('0.2'), vendor: null }, euros(20)]])
  })

  it('costs €10.00 for the same fund held only from July, the months before counting zero', () => {
    const [, year2025] = costsOf(fundBoughtOn('2025-07-01'), '2026-01-15')
    // Six month ends at €10,000.00 over twelve average €5,000.00, and 0.20% of that is €10.00.
    expect(year2025).toMatchObject({ fundCosts: euros(10), averageValue: euros(5000), share: 0.002 })
  })

  it("counts the day's year to its last month end, so April shows January to March", () => {
    const [year2026] = costsOf(fundBoughtOn('2025-01-02'), '2026-04-15')
    // Three month ends at €10,000.00 over twelve, at 0.20%.
    expect(year2026).toMatchObject({ year: 2026, fundCosts: euros(5), averageValue: euros(10000), share: 0.0005 })
  })

  it('has no fund cost and no share for a year with no month end yet', () => {
    const [year2026] = costsOf(fundBoughtOn('2025-01-02'), '2026-01-15')
    expect(year2026).toMatchObject({ year: 2026, funds: [], fundCosts: euros(0), averageValue: euros(0), share: null })
  })

  it('leaves out an instrument without a TER', () => {
    const records = fundBoughtOn('2025-01-02')
    const [, year2025] = costsOf({ ...records, instruments: [{ ...FUND, ter: null }] }, '2026-01-15')
    expect(year2025?.funds).toEqual([])
  })
})

describe('fees by kind', () => {
  it('takes refunds off account fees and turns exchange fees into euros at the ECB rate of their day', () => {
    const records = book({
      ...fundBoughtOn('2025-01-02'),
      cashMovements: [
        cashMovement('deposit', BROKER, '2025-01-02', '10000'),
        cashMovement('fee', BROKER, '2025-03-31', '3'),
        cashMovement('fee-refund', BROKER, '2025-04-30', '1'),
        cashMovement('fee', BROKER, '2026-02-01', '9'),
      ],
      exchanges: [exchange(BROKER, '2025-05-05', '100', EURO, '108.9', USD, { amount: decimal('1.1'), currency: USD })],
    })
    const [, year2025] = costsOf(records, '2026-01-15', { rates: rateBookOf(new Map([[USD, [['2025-05-05', '1.1']] as const]])) })
    // €3.00 less the €1.00 refund, $1.10 at 1.10, and the fund's €20.00. The 2026 fee comes after the day.
    expect(year2025).toMatchObject({ account: euros(2), exchange: euros(1), total: euros(23) })
  })

  it('counts the exchanges whose fees have no ECB rate yet, leaving their fees out', () => {
    const records = book({
      ...fundBoughtOn('2025-01-02'),
      exchanges: [exchange(BROKER, '2025-05-05', '100', EURO, '108.9', USD, { amount: decimal('1.1'), currency: USD })],
    })
    const [, year2025] = costsOf(records, '2026-01-15')
    expect(year2025).toMatchObject({ exchange: euros(0), unratedExchanges: 1, unpricedFunds: [] })
  })

  it('names a fund held at a month end it has no close for', () => {
    const [, , year2024] = costsOf(fundBoughtOn('2024-12-02'), '2026-01-15')
    // The prices start on 2 January 2025, so 31 December 2024 has no close for the fund.
    expect(year2024).toMatchObject({ year: 2024, funds: [], unpricedFunds: [FUND] })
  })

  it('has no years before the first deposit', () => {
    expect(costsOf(book({}), '2026-01-15')).toEqual([])
  })
})

describe('the costs of the last 12 months', () => {
  function recentOf(records: InvestmentBook, today: string, sources: Partial<PortfolioSources> = {}) {
    const all: PortfolioSources = { book: records, prices: FUND_PRICES, rates: NO_RATES, today: civil(today), ...sources }
    return recentCosts(all, dayValuer(all), NOTHING_FETCHED)
  }

  it('takes the TER of the twelve month ends since the day a year back, against their average value', () => {
    // 31 Jan to 31 Dec 2025 at €10,000.00 each: 0.20% of €10,000.00 is €20.00.
    expect(recentOf(fundBoughtOn('2025-01-02'), '2026-01-15')).toEqual({ total: euros(20), averageValue: euros(10000) })
  })

  it('averages a portfolio first funded 6 months back over all twelve month ends, the six before its first deposit counting zero', () => {
    // Six of the twelve month ends hold €10,000.00, so the fund cost is €10.00 against an average of €60,000.00 ÷ 12 = €5,000.00.
    // The share is 0.20%, twice the 0.10% the average of the six funded month ends alone, €10,000.00, gave.
    const recent = recentOf(fundBoughtOn('2025-07-01'), '2026-01-15')
    expect(recent).toEqual({ total: euros(10), averageValue: euros(5000) })
    expect(recent.total / recent.averageValue).toBe(0.002)
  })

  it('averages its twelve month ends as the Costs tab averages a year', () => {
    // On 15 January 2026 the twelve month ends are those of 2025.
    const [, year2025] = costsOf(fundBoughtOn('2025-07-01'), '2026-01-15')
    expect(recentOf(fundBoughtOn('2025-07-01'), '2026-01-15').averageValue).toBe(year2025?.averageValue)
  })

  it('counts the fees of the records after the day a year back', () => {
    // Only the sale of 2 Feb 2026 is after 29 Oct 2025: $1.00 at 1.18 is €0.85.
    expect(recentOf(workedPortfolio(), '2026-10-29', { prices: WORKED_PRICES, rates: WORKED_RATES }).total).toBe(euros(0.85))
  })
})
