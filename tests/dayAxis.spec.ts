import { describe, expect, it } from 'vitest'

import type { ChartTokens } from '../src/shared/charts/chartTokens'
import { dayAxisLabels } from '../src/shared/charts/dayAxis'
import type { CivilDate } from '../src/shared/calendar/civilDate'
import { civil } from './fixtures/ledger'

const TOKENS = new Proxy({}, { get: (_target, name) => String(name) }) as unknown as ChartTokens

/** Every weekday from one day to another, as a vendor's daily closes would fall. */
function weekdaysFrom(from: string, to: string): CivilDate[] {
  const days: CivilDate[] = []
  for (let day = new Date(`${from}T00:00:00Z`); day <= new Date(`${to}T00:00:00Z`); day.setUTCDate(day.getUTCDate() + 1)) {
    if (day.getUTCDay() !== 0 && day.getUTCDay() !== 6) days.push(civil(day.toISOString().slice(0, 10)))
  }
  return days
}

describe('the labels of an axis of daily closes', () => {
  it('labels a month on its last close, such as Friday 30 Oct when the 31st is a Saturday', () => {
    const dates = weekdaysFrom('2026-09-28', '2026-11-03')
    const { interval } = dayAxisLabels(dates, TOKENS, false) as { interval: (index: number, category: string) => boolean }
    const labelled = dates.filter((day, index) => interval(index, day))
    // Wednesday 30 Sep is its month's last day, and Friday 30 Oct the last close of October.
    expect(labelled).toEqual(['2026-09-30', '2026-10-30'])
  })

  it('labels no first day, and no last day in the middle of its month', () => {
    const dates = weekdaysFrom('2026-10-30', '2026-11-17')
    const { interval } = dayAxisLabels(dates, TOKENS, false) as { interval: (index: number, category: string) => boolean }
    expect(dates.filter((day, index) => interval(index, day))).toEqual([])
  })
})
