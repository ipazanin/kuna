import { describe, expect, it } from 'vitest'

import type { PortfolioSources } from '../src/apps/investments/holdings/domain/holding'
import { yearlyCosts } from '../src/apps/investments/income/domain/yearlyCosts'
import { dayValuer } from '../src/apps/investments/performance/domain/portfolioPerformance'
import type { InvestmentBook } from '../src/apps/investments/workbook/domain/investmentBook'
import { EURO } from '../src/shared/money/currencyCode'
import { BROKER, USD, WORKED_PRICES, WORKED_RATES, book, cashMovement, decimal, exchange, instrument, priceBookOf, rateBookOf, trade, workedPortfolio } from './fixtures/investments'
import { civil, euros } from './fixtures/ledger'

const FUND = instrument('world-fund', { name: 'World fund', type: 'fund', ter: decimal('0.2') })
const FUND_PRICES = priceBookOf(new Map([[FUND, [['2025-01-02', '100']] as const]]))
const NO_RATES = rateBookOf(new Map())

function costsOf(records: InvestmentBook, today: string, sources: Partial<PortfolioSources> = {}) {
  const all: PortfolioSources = { book: records, prices: FUND_PRICES, rates: NO_RATES, today: civil(today), ...sources }
  return yearlyCosts(all, dayValuer(all))
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
    expect(year2025?.funds).toEqual([{ instrument: FUND, ter: decimal('0.2'), cost: euros(20) }])
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
