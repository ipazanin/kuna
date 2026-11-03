import { describe, expect, it } from 'vitest'

import type { Asset } from '../src/apps/company/packs/hr-doo/domain/assets/assets'
import { bookValueOn, depreciationSchedule } from '../src/apps/company/packs/hr-doo/domain/assets/depreciationSchedule'
import { ASSET_RECORDS } from '../src/apps/company/packs/hr-doo/domain/hrDooKinds'
import { bookValueChart, bookValueSpan } from '../src/apps/company/packs/hr-doo/presentation/assets/assetCharts'
import { lastDayOf, parseMonthKey } from '../src/shared/calendar/monthKey'
import { rangeWindow, wholeMonthsSpan } from '../src/shared/charts/chartRange'
import type { ChartTokens } from '../src/shared/charts/chartTokens'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { civil, euros } from './fixtures/ledger'

const TOKENS = new Proxy({}, { get: (_target, name) => (name === 'series' ? ['--series-1'] : String(name)) }) as unknown as ChartTokens
const TODAY = civil('2026-11-03')

function laptop(cost: number): Asset {
  return {
    name: 'Example laptop',
    bought: civil('2025-03-10'),
    inUse: civil('2025-03-10'),
    costNet: euros(cost),
    group: 'computers',
    doubledRate: false,
    disposed: null,
    fundedBy: '',
    ledgerReference: '',
    note: '',
    id: recordIdOf(ASSET_RECORDS, 'row-2'),
  }
}

describe("the book value chart's range", () => {
  const schedule = depreciationSchedule(laptop(2400), { depreciationDoubled: false })
  const lastMonth = schedule.months.at(-1)!.month

  it('spans the months from the purchase to the month the asset reaches zero, and nothing without a depreciated asset', () => {
    expect(bookValueSpan([schedule])).toEqual(wholeMonthsSpan(parseMonthKey('2025-03')!, lastMonth))
    expect(bookValueSpan([])).toBeNull()
  })

  it('draws only the month ends in the range, each at its own book value', () => {
    // The last year runs from 3 Nov 2025 to today, so Nov 2025 to Nov 2026, thirteen month ends.
    const chart = bookValueChart([schedule], TODAY, TOKENS, rangeWindow('1y', TODAY))
    const months = (chart.option.xAxis as { data: string[] }).data
    const [line] = chart.option.series as { data: (number | null)[] }[]

    expect([months.length, months[0], months.at(-1)]).toEqual([13, '2025-11', '2026-11'])
    expect(line!.data[0]).toBe(bookValueOn(schedule, lastDayOf(parseMonthKey('2025-11')!)).amount)
    expect((bookValueChart([schedule], TODAY, TOKENS, null).option.xAxis as { data: string[] }).data[0]).toBe('2025-03')
  })
})
