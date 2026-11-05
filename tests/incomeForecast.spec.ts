import { describe, expect, it } from 'vitest'

import { incomeForecast } from '../src/apps/investments/income/domain/incomeForecast'
import { fetchedFactsBook } from '../src/apps/investments/prices/domain/factsBook'
import { NO_FETCHED_FACTS } from '../src/apps/investments/prices/domain/pricesFile'
import { NO_RATES } from '../src/shared/money/rateBook'
import type { FactsBook } from '../src/apps/investments/prices/domain/factsBook'
import type { DividendRow } from '../src/apps/investments/prices/domain/pricesFile'
import type { InvestmentBook } from '../src/apps/investments/workbook/domain/investmentBook'
import type { PercentQuoting } from '../src/apps/investments/workbook/domain/instrument'
import { decimalText } from '../src/shared/money/decimal'
import { EURO } from '../src/shared/money/currencyCode'
import { BROKER, STOCK_B, USD, WORKED_PRICES, WORKED_RATES, book, cashMovement, decimal, dividend, exchange, instrument, split, trade, workedPortfolio } from './fixtures/investments'
import { civil, euros } from './fixtures/ledger'

const NOTHING_FETCHED = fetchedFactsBook(NO_FETCHED_FACTS)

function forecastOn(records: InvestmentBook, today: string, facts: FactsBook = NOTHING_FETCHED) {
  return incomeForecast({ book: records, prices: WORKED_PRICES, rates: WORKED_RATES, today: civil(today) }, facts)
}

/** What a made-up Alpha Vantage announced of Stock B, as the prices file keeps it. */
function announcing(...dividends: DividendRow[]): FactsBook {
  return fetchedFactsBook({ ...NO_FETCHED_FACTS, dividends: { 'alphavantage:STOCK-B': { asked: '2026-10-29', dividends } } })
}

/** 40 Stock B bought in January 2026, a dividend in June on those 40, and 10 more bought in August. */
function dividendPayer(): InvestmentBook {
  return book({
    accounts: [BROKER],
    instruments: [STOCK_B],
    cashMovements: [cashMovement('deposit', BROKER, '2026-01-05', '3000')],
    exchanges: [exchange(BROKER, '2026-01-05', '2500', EURO, '2750', USD)],
    trades: [trade('buy', BROKER, STOCK_B, '2026-01-05', '40', '50', '0', '1.10'), trade('buy', BROKER, STOCK_B, '2026-08-03', '10', '55', '0', '1.16')],
    income: [dividend(BROKER, STOCK_B, '2026-06-15', '12', '1.80', '1.15')],
  })
}

describe('coming income', () => {
  it('copies $12.00 gross with $1.80 withheld on 40 units to $15.00 and $2.25 on 15 Jun 2027 for the 50 held now, €11.38 received at 1.12', () => {
    const forecast = forecastOn(dividendPayer(), '2026-10-29')
    expect(forecast.months.map((month) => month.month)).toEqual(['2026-10', '2026-11', '2026-12', '2027-01', '2027-02', '2027-03', '2027-04', '2027-05', '2027-06', '2027-07', '2027-08', '2027-09'])
    const june = forecast.months.find((month) => month.month === '2027-06')
    expect(june?.payments.map((copy) => [copy.date, decimalText(copy.gross), decimalText(copy.withheld), copy.received])).toEqual([['2027-06-15', '15', '2.25', euros(11.38)]])
    expect(june?.received).toBe(euros(11.38))
    expect(forecast.received).toBe(euros(11.38))
  })

  it("copies only the last twelve months' payments, at the units held now after a sale", () => {
    // On 1 Sep 2026 the worked portfolio holds 15 of the 20 Stock B its dividend of 15 Sep 2025 was paid on: $10.00 and $3.00 become $7.50 and $2.25, and the $5.25 is €4.45 at 1.18.
    const forecast = forecastOn(workedPortfolio(), '2026-09-01')
    expect(forecast.months.flatMap((month) => month.payments).map((copy) => [copy.date, decimalText(copy.gross), decimalText(copy.withheld), copy.received])).toEqual([
      ['2026-09-15', '7.5', '2.25', euros(4.45)],
    ])
    expect(forecastOn(workedPortfolio(), '2026-10-29').received).toBe(euros(0))
    // A day after 15 Sep 2026 that dividend is more than twelve months old, so its copy would fall on a day already gone.
    const [september] = forecastOn(workedPortfolio(), '2026-09-16').months
    expect(september).toMatchObject({ month: '2026-09', received: euros(0), payments: [] })
  })

  it('counts the units of the day paid in the units of today, so a split after it changes nothing', () => {
    const records = dividendPayer()
    const doubled = { ...records, splits: [split(STOCK_B, '2026-09-01', 2, 1)] }
    const [copy] = forecastOn(doubled, '2026-10-29').months.flatMap((month) => month.payments)
    expect(copy === undefined ? null : [decimalText(copy.gross), decimalText(copy.withheld)]).toEqual(['15', '2.25'])
  })

  it('copies nothing of a holding sold since, of income with no instrument, or past the twelfth month', () => {
    const records = dividendPayer()
    const sold = { ...records, trades: [...records.trades, trade('sell', BROKER, STOCK_B, '2026-09-01', '50', '56', '0', '1.17')] }
    expect(forecastOn(sold, '2026-10-29').months.every((month) => month.payments.length === 0)).toBe(true)
    const interest = { ...dividend(BROKER, instrument('cash'), '2026-07-01', '2.60', '0'), instrument: null, kind: 'interest' as const, currency: EURO }
    expect(forecastOn({ ...records, income: [interest] }, '2026-10-29').received).toBe(euros(0))
    // A payment earlier this month comes again in October 2027, a month after the last one shown.
    const thisMonth = { ...records, income: [dividend(BROKER, STOCK_B, '2026-10-05', '12', '1.80', '1.12')] }
    expect(forecastOn(thisMonth, '2026-10-29').received).toBe(euros(0))
  })

  it('leaves out a coupon that would fall after the bond matures', () => {
    const terms: PercentQuoting = { kind: 'percent', coupon: decimal('3'), maturity: civil('2027-03-14') }
    const bond = instrument('bond', { name: 'State bond 2027', class: 'bonds', quoted: terms, prices: 'manual', sourceSymbol: '' })
    const records = book({
      accounts: [BROKER],
      instruments: [bond],
      cashMovements: [cashMovement('deposit', BROKER, '2026-01-05', '1000')],
      trades: [trade('buy', BROKER, bond, '2026-01-05', '1000', '99', '0')],
      income: [{ ...dividend(BROKER, bond, '2026-03-15', '30', '0'), kind: 'coupon' }],
    })
    expect(forecastOn(records, '2026-10-29').received).toBe(euros(0))
  })

  it('shows a copy in a currency with no rate yet without euros, outside the total', () => {
    const records = dividendPayer()
    const forecast = incomeForecast({ book: records, prices: WORKED_PRICES, rates: NO_RATES, today: civil('2026-10-29') }, NOTHING_FETCHED)
    expect(forecast.months.flatMap((month) => month.payments).map((copy) => copy.received)).toEqual([null])
    expect(forecast.received).toBe(euros(0))
  })
})

describe('announced dividends in the coming income', () => {
  it('replaces the copy of 15 Jun 2027 with $0.32 a unit announced for 10 Jun on the 50 held, withholding the last payment’s 15%, €12.14 at 1.12', () => {
    const forecast = forecastOn(dividendPayer(), '2026-10-29', announcing(['2027-06-01', '2027-06-10', '0.32']))
    const june = forecast.months.find((month) => month.month === '2027-06')
    // 50 × $0.32 = $16.00 gross, $2.40 withheld as $1.80 was of $12.00, and $13.60 at 1.12 is €12.14.
    expect(june?.payments.map((payment) => [payment.kind, payment.date, decimalText(payment.gross), decimalText(payment.withheld), payment.received])).toEqual([
      ['announced', '2027-06-10', '16', '2.4', euros(12.14)],
    ])
    expect(forecast.received).toBe(euros(12.14))
  })

  it('keeps the copy beside an announced payment more than 20 days from it', () => {
    const forecast = forecastOn(dividendPayer(), '2026-10-29', announcing(['2027-07-10', '2027-07-20', '0.32']))
    expect(forecast.months.flatMap((month) => month.payments).map((payment) => [payment.kind, payment.date])).toEqual([
      ['copied', '2027-06-15'],
      ['announced', '2027-07-20'],
    ])
    expect(forecast.received).toBe(euros(11.38 + 12.14))
  })

  it('replaces the copy of 15 Jun 2027 with a payment announced 20 days later, and keeps it beside one 21 days later', () => {
    const kinds = (paid: string) =>
      forecastOn(dividendPayer(), '2026-10-29', announcing(['2027-06-25', paid, '0.32'])).months.flatMap((month) => month.payments.map((payment) => [payment.kind, payment.date]))
    expect(kinds('2027-07-05')).toEqual([['announced', '2027-07-05']])
    expect(kinds('2027-07-06')).toEqual([
      ['copied', '2027-06-15'],
      ['announced', '2027-07-06'],
    ])
  })

  it('replaces the nearer of two copies within 20 days, 25 Jun 2027 for a payment announced for 22 Jun, and keeps 15 Jun', () => {
    const records = dividendPayer()
    const twice = { ...records, income: [...records.income, dividend(BROKER, STOCK_B, '2026-06-25', '12', '1.80', '1.15')] }
    expect(forecastOn(twice, '2026-10-29', announcing(['2027-06-12', '2027-06-22', '0.32'])).months.flatMap((month) => month.payments.map((payment) => [payment.kind, payment.date]))).toEqual([
      ['copied', '2027-06-15'],
      ['announced', '2027-06-22'],
    ])
  })

  it('pays a dividend whose ex day has passed on the 50 units held the day before it, not on those bought or sold since', () => {
    const records = dividendPayer()
    const facts = announcing(['2026-10-20', '2026-11-10', '0.32'])
    const bought = { ...records, trades: [...records.trades, trade('buy', BROKER, STOCK_B, '2026-10-20', '10', '56', '0', '1.17')] }
    const sold = { ...records, trades: [...records.trades, trade('sell', BROKER, STOCK_B, '2026-10-20', '50', '56', '0', '1.17')] }
    // 50 × $0.32 = $16.00 gross either way, $2.40 withheld, €12.14 at 1.12.
    for (const held of [bought, sold]) {
      const november = forecastOn(held, '2026-10-29', facts).months.find((month) => month.month === '2026-11')
      expect(november?.payments.map((payment) => [payment.kind, decimalText(payment.gross), payment.received])).toEqual([['announced', '16', euros(12.14)]])
    }
  })

  it('counts no announced payment already paid, past the twelfth month, or of a holding sold since', () => {
    const facts = announcing(['2026-10-01', '2026-10-20', '0.32'], ['2027-10-01', '2027-10-15', '0.32'])
    expect(forecastOn(dividendPayer(), '2026-10-29', facts).months.flatMap((month) => month.payments.map((payment) => payment.kind))).toEqual(['copied'])
    const records = dividendPayer()
    const sold = { ...records, trades: [...records.trades, trade('sell', BROKER, STOCK_B, '2026-09-01', '50', '56', '0', '1.17')] }
    expect(forecastOn(sold, '2026-10-29', announcing(['2027-06-01', '2027-06-10', '0.32'])).received).toBe(euros(0))
  })
})
