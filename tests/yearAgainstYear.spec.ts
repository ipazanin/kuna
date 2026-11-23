import { describe, expect, it } from 'vitest'

import { countedRows } from '../src/apps/spending/analytics/domain/countedRow'
import { monthTotals } from '../src/apps/spending/analytics/domain/monthTotals'
import { yearChange, yearAgainstYear } from '../src/apps/spending/analytics/domain/yearAgainstYear'
import type { MonthKey } from '../src/shared/calendar/monthKey'
import { NO_RATES } from '../src/shared/money/rateBook'
import { civil, euros } from './fixtures/ledger'
import { ACCOUNTS, CATEGORIES, OTP, category, row, wholeItems } from './fixtures/spending'

const transactions = [
  row(OTP, '2025-01-10', -50, 'Transport/Fuel'),
  row(OTP, '2025-03-05', -40, 'Transport/Fuel'),
  row(OTP, '2025-03-25', -30, 'Transport/Fuel'),
  row(OTP, '2025-12-01', -90, 'Transport/Fuel'),
  row(OTP, '2026-01-12', -70, 'Transport/Fuel'),
  row(OTP, '2026-03-02', -20, 'Transport/Fuel'),
]
const rows = countedRows({ sharedCosts: [], accounts: ACCOUNTS, transactions, items: wholeItems(transactions) }, NO_RATES)
const totalsOf = (asked: MonthKey) => monthTotals(rows, CATEGORIES, asked)

describe('a year against the year before', () => {
  it("sets each month beside last year's, with no figure for a month after the day's", () => {
    const fuel = yearAgainstYear(rows, CATEGORIES, totalsOf, category('Transport'), 2026, civil('2026-03-10'))

    expect(fuel.months.slice(0, 4).map(({ counted, lastYear }) => [counted, lastYear])).toEqual([
      [euros(70), euros(50)],
      [euros(0), euros(0)],
      [euros(20), euros(70)],
      [null, euros(0)],
    ])
  })

  it('counts the year to the day against the same days of last year', () => {
    const fuel = yearAgainstYear(rows, CATEGORIES, totalsOf, category('Transport/Fuel'), 2026, civil('2026-03-10'))

    // 70 + 20 this year to 10 March, against 50 + 40 last year to 10 March. The 30 of 25 March 2025 is after it.
    expect([fuel.toDate.counted, fuel.lastYearToDate.counted]).toEqual([euros(90), euros(90)])
  })

  it('counts a year before the day whole', () => {
    const fuel = yearAgainstYear(rows, CATEGORIES, totalsOf, null, 2025, civil('2026-03-10'))

    expect([fuel.toDate.counted, fuel.lastYearToDate.counted]).toEqual([euros(210), euros(0)])
    expect(fuel.months.every((shown) => shown.counted !== null)).toBe(true)
  })

  it('names the days each count reads and how far the year moved from them', () => {
    const fuel = yearAgainstYear(rows, CATEGORIES, totalsOf, category('Transport'), 2026, civil('2026-03-10'))

    expect([fuel.toDate.days, fuel.lastYearToDate.days]).toEqual([
      { from: civil('2026-01-01'), to: civil('2026-03-10') },
      { from: civil('2025-01-01'), to: civil('2025-03-10') },
    ])
    // 90 against 90, so no change.
    expect(yearChange(fuel)).toEqual({ change: euros(0), share: 0 })
  })
})
