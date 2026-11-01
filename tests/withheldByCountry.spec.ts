import { describe, expect, it } from 'vitest'

import { withheldByCountry } from '../src/apps/investments/income/domain/withheldByCountry'
import type { Income } from '../src/apps/investments/workbook/domain/income'
import { EURO } from '../src/shared/money/currencyCode'
import { BROKER, USD, book, dividend, instrument } from './fixtures/investments'
import { civil, euros } from './fixtures/ledger'

const US_SHARE = instrument('us-share', { name: 'Example US Share', currency: USD, isin: 'US0000000001' })
const IE_FUND = instrument('ie-fund', { name: 'Example Irish Fund', isin: 'ie0000000002' })
const NO_ISIN = instrument('no-isin', { name: 'Example Fund Without ISIN' })

function records(income: readonly Income[]) {
  return book({ accounts: [BROKER], instruments: [US_SHARE, IE_FUND, NO_ISIN], income })
}

describe('tax withheld by year and country', () => {
  it("gives 2025's US dividends €90.91, €13.64, €77.27 at 15.0% and the IE fund's €40.00 with nothing withheld", () => {
    // $100.00 at 1.10 is €90.91 and the $85.00 received is €77.27, so €13.64 was withheld.
    const [year] = withheldByCountry(records([dividend(BROKER, US_SHARE, '2025-06-16', '100', '15', '1.10'), dividend(BROKER, IE_FUND, '2025-12-10', '40', '0')]), civil('2026-10-29'))
    expect(year?.year).toBe(2025)
    expect(year?.countries.map(({ country, gross, withheld, received }) => ({ country, gross, withheld, received }))).toEqual([
      { country: 'US', gross: euros(90.91), withheld: euros(13.64), received: euros(77.27) },
      { country: 'IE', gross: euros(40), withheld: euros(0), received: euros(40) },
    ])
    expect(year?.countries[0]?.share).toBeCloseTo(0.15, 3)
    expect(year?.countries[1]?.share).toBe(0)
  })

  it('puts income with no ISIN in one row after the countries, and lists the years newest first', () => {
    const interest: Income = { ...dividend(BROKER, instrument('cash'), '2026-04-01', '2.40', '0'), instrument: null, kind: 'interest', currency: EURO }
    const years = withheldByCountry(
      records([dividend(BROKER, NO_ISIN, '2026-03-02', '50', '0'), interest, dividend(BROKER, IE_FUND, '2026-06-10', '10', '0'), dividend(BROKER, US_SHARE, '2025-06-16', '100', '15', '1.10')]),
      civil('2026-10-29'),
    )
    expect(years.map((year) => year.year)).toEqual([2026, 2025])
    expect(years[0]?.countries.map(({ country, gross }) => [country, gross])).toEqual([
      ['IE', euros(10)],
      [null, euros(52.4)],
    ])
  })

  it('leaves out a payment after the day', () => {
    expect(withheldByCountry(records([dividend(BROKER, US_SHARE, '2026-11-16', '100', '15', '1.10')]), civil('2026-10-29'))).toEqual([])
  })
})
