import type { Income } from '../../src/apps/investments/workbook/domain/income'
import type { InvestmentBook } from '../../src/apps/investments/workbook/domain/investmentBook'
import { INCOME_RECORDS } from '../../src/apps/investments/workbook/domain/investmentKinds'
import { EURO } from '../../src/shared/money/currencyCode'
import { recordIdOf } from '../../src/shared/storage/domain/recordId'
import { BROKER, USD, book, decimal, dividend, instrument, rateBookOf, trade } from './investments'
import { civil } from './ledger'

/** The tax plan's worked 2026, every figure made up. */
export const WORLD = instrument('world', { name: 'Example World ETF', isin: 'IE0000000WD1', prices: 'alphavantage' })
export const DIVIDEND_CO = instrument('dividend-co', { name: 'Example Dividend Co', currency: USD, isin: 'US0000000DC2' })
export const TECH = instrument('tech', { name: 'Example Tech', currency: USD, isin: 'US0000000TC3' })
export const OLD_SHARE = instrument('old-share', { name: 'Example Old Share', isin: 'DE0000000OS4' })

/**
 * ECB rates of dollars per euro. HNB's list published on a day carries that day's rate, so each settlement or payment
 * day converts at its own row, and the day before differs to show it is not used.
 */
export const EXAMPLE_RATES = rateBookOf(
  new Map([
    [
      USD,
      [
        ['2026-06-15', '1.2400'],
        ['2026-06-16', '1.2500'],
        ['2026-07-14', '1.0950'],
        ['2026-07-15', '1.1000'],
        ['2026-08-04', '1.0950'],
        ['2026-08-05', '1.1000'],
        ['2026-10-02', '1.1900'],
        ['2026-10-05', '1.2000'],
        ['2026-11-02', '1.2200'],
      ],
    ],
  ]),
)

/** A payment of the year that is not a dividend, in the account's own words. */
export function payment(kind: Income['kind'], date: string, currency: Income['currency'], gross: string, note = ''): Income {
  return { ...dividend(BROKER, WORLD, date, gross, '0'), id: recordIdOf(INCOME_RECORDS, `${kind}-${date}`), kind, instrument: null, currency, rate: currency === EURO ? null : decimal('1.08'), note }
}

/**
 * Four sales: the World ETF closing a lot past two years and one under, a dollar share at a loss, a dollar share
 * settling on a Monday, and a share bought in 2023 sold at a loss. Then a US dividend with 30% withheld, an Irish
 * distribution with nothing withheld, stock lending and a referral credit. Every stored rate is 1.08, which the tax never reads.
 */
export function exampleYear(): InvestmentBook {
  return book({
    accounts: [BROKER],
    instruments: [WORLD, DIVIDEND_CO, TECH, OLD_SHARE],
    trades: [
      trade('buy', BROKER, OLD_SHARE, '2023-05-02', '10', '20', '0'),
      trade('buy', BROKER, WORLD, '2024-01-15', '10', '100', '1'),
      trade('buy', BROKER, TECH, '2025-03-10', '10', '100', '0', '1.08'),
      trade('buy', BROKER, WORLD, '2025-06-10', '10', '120', '1'),
      trade('buy', BROKER, DIVIDEND_CO, '2026-01-12', '10', '60', '0', '1.08'),
      trade('sell', BROKER, WORLD, '2026-03-02', '15', '130', '1'),
      trade('sell', BROKER, OLD_SHARE, '2026-05-04', '10', '16', '0'),
      trade('sell', BROKER, DIVIDEND_CO, '2026-06-15', '10', '50', '0', '1.08'),
      trade('sell', BROKER, TECH, '2026-10-02', '10', '120', '0', '1.08'),
    ],
    income: [
      dividend(BROKER, DIVIDEND_CO, '2026-07-15', '100', '30', '1.08'),
      payment('lending', '2026-08-05', USD, '10'),
      payment('referral', '2026-09-02', EURO, '40'),
      { ...dividend(BROKER, WORLD, '2026-10-16', '50', '0'), currency: EURO },
    ],
  })
}

export const EXAMPLE_DAY = civil('2026-11-03')
