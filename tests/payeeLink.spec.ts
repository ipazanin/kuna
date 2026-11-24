import { describe, expect, it } from 'vitest'

import { ALL_MONTHS, LAST_12_MONTHS, entriesMonthsNamed, payeeLink, payeePeriodShowing } from '../src/apps/spending/overview/presentation/spendingLinks'
import { payeeKey } from '../src/apps/spending/payees/domain/payeeKey'
import { inPeriod } from '../src/apps/spending/payees/domain/payeePeriod'
import { payeeTotals } from '../src/apps/spending/payees/domain/payeeTotals'
import { countedRows } from '../src/apps/spending/analytics/domain/countedRow'
import { lastTwelveMonths, rangeContains } from '../src/shared/calendar/dateRange'
import { civil, euros, month } from './fixtures/ledger'
import { ACCOUNTS, CATEGORIES, OTP, RATES, row, wholeItems } from './fixtures/spending'

describe('the last twelve months', () => {
  it('run from the first day eleven months back to the last day of the month of the day', () => {
    expect(lastTwelveMonths(civil('2026-11-16'))).toEqual({ from: civil('2025-12-01'), to: civil('2026-11-30') })
    expect(lastTwelveMonths(civil('2026-01-31'))).toEqual({ from: civil('2025-02-01'), to: civil('2026-01-31') })
  })

  it('are the days the Payees tab counts as Last 12 months', () => {
    const day = civil('2026-11-16')
    const range = lastTwelveMonths(day)
    const counted = inPeriod('year', day)

    for (const date of ['2025-11-30', '2025-12-01', '2026-11-30', '2026-12-01'].map(civil)) expect(counted(date)).toBe(rangeContains(range, date))
  })
})

describe("a payee's link to Entries", () => {
  const monthsOf = (period: 'month' | 'year' | 'all') => {
    const link = payeeLink(payeeKey('Landlord'), period)
    if (typeof link === 'string' || !('query' in link)) throw new Error('The link has no query.')
    return { months: entriesMonthsNamed(link.query?.month), payee: link.query?.payee }
  }

  it('opens Entries on the months the Payees tab counted, which Entries reads back', () => {
    expect(monthsOf('month')).toEqual({ months: null, payee: payeeKey('Landlord') })
    expect(monthsOf('year').months).toBe(LAST_12_MONTHS)
    expect(monthsOf('all').months).toBe(ALL_MONTHS)
  })

  it('reads a month, every month and the last twelve from the address, and nothing else', () => {
    expect([entriesMonthsNamed('2026-03'), entriesMonthsNamed('all'), entriesMonthsNamed('last-12-months')]).toEqual(['2026-03', ALL_MONTHS, LAST_12_MONTHS])
    expect([entriesMonthsNamed('2026-13'), entriesMonthsNamed('year'), entriesMonthsNamed(undefined)]).toEqual([null, null, null])
  })

  it('leaves out a payment fourteen months back, so both screens show the same rent', () => {
    const day = civil('2026-11-16')
    const transactions = [row(OTP, '2025-09-01', -1800, 'Home/Rent', { payee: 'Landlord' }), row(OTP, '2026-10-01', -1800, 'Home/Rent', { payee: 'Landlord' })]
    const rows = countedRows({ sharedCosts: [], accounts: ACCOUNTS, transactions, items: wholeItems(transactions) }, RATES)
    const range = lastTwelveMonths(day)
    const counted = inPeriod('year', day)

    const onPayees = payeeTotals(
      rows.filter((shown) => counted(shown.day)),
      CATEGORIES,
      { payees: [] },
    )
    const onEntries = payeeTotals(
      rows.filter((shown) => rangeContains(range, shown.day)),
      CATEGORIES,
      { payees: [] },
    )

    expect(onPayees.map((payee) => payee.spent)).toEqual([euros(1800)])
    expect(onEntries).toEqual(onPayees)
  })
})

describe('the payee page Entries opens', () => {
  const thisMonth = month('2026-11')

  it('comes back to the period whose link to Entries gave the months', () => {
    for (const period of ['month', 'year', 'all'] as const) {
      const link = payeeLink(payeeKey('Landlord'), period)
      if (typeof link === 'string' || !('query' in link)) throw new Error('The link has no query.')
      expect(payeePeriodShowing(entriesMonthsNamed(link.query?.['month']) ?? thisMonth, thisMonth)).toBe(period)
    }
  })

  it('opens Last 12 months for another month or a span of days', () => {
    expect(payeePeriodShowing(month('2025-10'), thisMonth)).toBe('year')
    expect(payeePeriodShowing(null, thisMonth)).toBe('year')
    expect(payeePeriodShowing(ALL_MONTHS, thisMonth)).toBe('all')
    expect(payeePeriodShowing(LAST_12_MONTHS, thisMonth)).toBe('year')
  })
})
