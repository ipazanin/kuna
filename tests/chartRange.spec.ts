import { describe, expect, it } from 'vitest'

import { chartRanges, monthInRange, rangeWindow, wholeMonthsSpan, yearInRange } from '../src/shared/charts/chartRange'
import { parseMonthKey } from '../src/shared/calendar/monthKey'
import { civil } from './fixtures/ledger'

const TODAY = civil('2026-11-03')
const month = (text: string) => parseMonthKey(text)!

describe("a time chart's range", () => {
  it('keeps the last one, three or five years up to today, the next five years from today, or everything', () => {
    expect(rangeWindow('1y', TODAY)).toEqual({ from: civil('2025-11-03'), to: TODAY })
    expect(rangeWindow('5y', TODAY)).toEqual({ from: civil('2021-11-03'), to: TODAY })
    expect(rangeWindow('next-5y', TODAY)).toEqual({ from: TODAY, to: civil('2031-11-03') })
    expect(rangeWindow('all', TODAY)).toBeNull()
  })

  it('keeps the months and years of its first and last day whole', () => {
    // The last year runs from 3 Nov 2025, so November 2025 is in it and October is not: thirteen month ends in all.
    const lastYear = rangeWindow('1y', TODAY)
    expect(['2025-10', '2025-11', '2026-11', '2026-12'].map((key) => monthInRange(lastYear, month(key)))).toEqual([false, true, true, false])
    expect([2024, 2025, 2026, 2027].map((year) => yearInRange(lastYear, year))).toEqual([false, true, true, false])
    expect(['2026-10', '2026-11', '2031-11', '2031-12'].map((key) => monthInRange(rangeWindow('next-5y', TODAY), month(key)))).toEqual([false, true, true, false])
    expect([monthInRange(null, month('1999-01')), yearInRange(null, 2099)]).toEqual([true, true])
  })

  it('offers a past range once the chart starts before it, so none shows what All shows', () => {
    // A holding first bought on 10 Mar 2023 has closes to today: the last year and the last three, then All.
    expect(chartRanges({ from: civil('2023-03-10'), to: TODAY }, TODAY)).toEqual(['1y', '3y', 'all'])
    expect(chartRanges({ from: civil('2026-03-10'), to: TODAY }, TODAY)).toEqual(['all'])
  })

  it('offers no past range that would show nothing, as for a holding sold long ago', () => {
    expect(chartRanges({ from: civil('2019-01-31'), to: civil('2022-06-30') }, TODAY)).toEqual(['5y', 'all'])
  })

  it('offers the next five years on a chart that runs on past them, as a bank loan plan to 2048 does', () => {
    expect(chartRanges(wholeMonthsSpan(month('2023-04'), month('2048-03')), TODAY)).toEqual(['1y', '3y', 'next-5y', 'all'])
    // A plan line that stops in Jun 2027 has no next five years to cut.
    expect(chartRanges(wholeMonthsSpan(month('2026-06'), month('2027-06')), TODAY)).toEqual(['all'])
  })

  it('counts the months of a month-end chart whole, so a range starting inside its first month is not offered', () => {
    // A chart from November 2025 shows the same months as the last year, which starts on 3 Nov 2025.
    expect(chartRanges(wholeMonthsSpan(month('2025-11'), month('2026-11')), TODAY)).toEqual(['all'])
    expect(chartRanges(wholeMonthsSpan(month('2025-10'), month('2026-11')), TODAY)).toEqual(['1y', 'all'])
    // A chart that ends in November 2031 keeps that month in the next five years, which end on 3 Nov 2031.
    expect(chartRanges(wholeMonthsSpan(month('2026-11'), month('2031-11')), TODAY)).toEqual(['all'])
    expect(chartRanges(wholeMonthsSpan(month('2026-11'), month('2031-12')), TODAY)).toEqual(['next-5y', 'all'])
  })
})
