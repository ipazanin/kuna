import { describe, expect, it } from 'vitest'

import { investingRhythm } from '../src/apps/investments/income/domain/investingRhythm'
import { BROKER, book, cashMovement } from './fixtures/investments'
import { civil, euros } from './fixtures/ledger'

const deposits = (dates: readonly string[], amount = '500') => dates.map((date) => cashMovement('deposit', BROKER, date, amount))

describe('how regularly money goes in', () => {
  it('counts 4 months in a row to September while October has none yet, and €166.67 a month', () => {
    const rhythm = investingRhythm(book({ cashMovements: deposits(['2026-06-02', '2026-07-01', '2026-08-03', '2026-09-01']) }), civil('2026-10-31'))
    // €2,000.00 over the 12 complete months from October 2025 to September 2026.
    expect(rhythm).toMatchObject({ inARow: 4, thisMonthWaits: true, longestRun: 4, averageMonth: euros(166.67) })
    expect(rhythm.months).toHaveLength(24)
    expect(rhythm.months[0]).toEqual({ month: '2024-11', putIn: euros(0) })
    expect(rhythm.months.slice(-6).map((month) => month.putIn)).toEqual([euros(0), euros(500), euros(500), euros(500), euros(500), euros(0)])
  })

  it("counts the day's month once it has a deposit", () => {
    const rhythm = investingRhythm(book({ cashMovements: deposits(['2026-09-01', '2026-10-05']) }), civil('2026-10-06'))
    expect(rhythm).toMatchObject({ inARow: 2, thisMonthWaits: false, longestRun: 2 })
  })

  it("ends the run at the day's month when its deposit is outweighed by a withdrawal, and waits for nothing more", () => {
    const cashMovements = [...deposits(['2026-09-01', '2026-10-05']), cashMovement('withdrawal', BROKER, '2026-10-06', '800')]
    expect(investingRhythm(book({ cashMovements }), civil('2026-10-07'))).toMatchObject({ inARow: 0, thisMonthWaits: false, longestRun: 1 })
  })

  it("averages the 12 complete months before the day's, keeping the month a year back and leaving out the day's", () => {
    const cashMovements = [...deposits(['2025-10-01'], '1200'), ...deposits(['2026-10-01'], '2400')]
    const rhythm = investingRhythm(book({ cashMovements }), civil('2026-10-15'))
    // Only the €1,200.00 of October 2025 falls in October 2025 to September 2026. A window to October 2026 would give €200.00.
    expect(rhythm.averageMonth).toBe(euros(100))
  })

  it('keeps the longest run when a later run is shorter, and a month that took out more than it put in breaks a run', () => {
    const cashMovements = [
      ...deposits(['2025-01-02', '2025-02-03', '2025-03-03', '2025-04-01', '2025-06-02', '2025-07-01']),
      cashMovement('withdrawal', BROKER, '2025-07-20', '800'),
      ...deposits(['2025-08-01', '2025-09-01']),
    ]
    expect(investingRhythm(book({ cashMovements }), civil('2025-09-30'))).toMatchObject({ inARow: 2, longestRun: 4 })
  })

  it('leaves out what comes after the day', () => {
    const rhythm = investingRhythm(book({ cashMovements: deposits(['2026-09-01', '2026-11-02']) }), civil('2026-10-31'))
    expect(rhythm).toMatchObject({ inARow: 1, thisMonthWaits: true })
    expect(rhythm.months.at(-1)).toEqual({ month: '2026-10', putIn: euros(0) })
  })

  it('has no run and nothing a month without deposits', () => {
    expect(investingRhythm(book({}), civil('2026-10-31'))).toMatchObject({ inARow: 0, longestRun: 0, averageMonth: euros(0), thisMonthWaits: true })
  })
})
