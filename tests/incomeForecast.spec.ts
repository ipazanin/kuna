import { describe, expect, it } from 'vitest'

import { incomeForecast } from '../src/apps/investments/income/domain/incomeForecast'
import type { InvestmentBook } from '../src/apps/investments/workbook/domain/investmentBook'
import type { PercentQuoting } from '../src/apps/investments/workbook/domain/instrument'
import { decimalText } from '../src/shared/money/decimal'
import { EURO } from '../src/shared/money/currencyCode'
import { BROKER, STOCK_B, USD, WORKED_PRICES, WORKED_RATES, book, cashMovement, decimal, dividend, exchange, instrument, split, trade, workedPortfolio } from './fixtures/investments'
import { civil, euros } from './fixtures/ledger'

function forecastOn(records: InvestmentBook, today: string) {
  return incomeForecast({ book: records, prices: WORKED_PRICES, rates: WORKED_RATES, today: civil(today) })
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
    const forecast = incomeForecast({ book: records, prices: WORKED_PRICES, rates: { unitsPerEuroOnOrBefore: () => null }, today: civil('2026-10-29') })
    expect(forecast.months.flatMap((month) => month.payments).map((copy) => copy.received)).toEqual([null])
    expect(forecast.received).toBe(euros(0))
  })
})
