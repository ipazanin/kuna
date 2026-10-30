import { describe, expect, it } from 'vitest'

import { civilDate } from '../src/shared/calendar/civilDate'
import type { CivilDate } from '../src/shared/calendar/civilDate'
import { moneyFromCents } from '../src/shared/money/money'
import { daysOver365, solvedRate } from '../src/shared/money/rateSolver'
import type { DatedFlow } from '../src/shared/money/rateSolver'

function flow(date: string, cents: number): DatedFlow {
  return { date: date as CivilDate, amount: moneyFromCents(cents) }
}

/** Whole months over 12, for flows on the same day of each month. */
function monthsOver12(from: CivilDate, to: CivilDate): number {
  const [fromYear, fromMonth] = from.split('-').map(Number)
  const [toYear, toMonth] = to.split('-').map(Number)
  return ((toYear! - fromYear!) * 12 + (toMonth! - fromMonth!)) / 12
}

function negated(flows: readonly DatedFlow[]): DatedFlow[] {
  return flows.map((dated) => ({ date: dated.date, amount: moneyFromCents(-dated.amount) }))
}

describe('solvedRate', () => {
  it("solves an annuity's yearly rate from its monthly payments", () => {
    // €10,000.00 at 0.5% a month over 12 months: 10,000 × 0.005 ÷ (1 − 1.005^−12) = 860.66
    const payments = Array.from({ length: 12 }, (_, index) => ({ date: civilDate(2026 + Math.floor((index + 1) / 12), ((index + 1) % 12) + 1, 1), amount: moneyFromCents(86_066) }))
    const loan = [flow('2026-01-01', -1_000_000), ...payments]

    expect(solvedRate(loan, monthsOver12)).toBeCloseTo(1.005 ** 12 - 1, 4)
  })

  it('solves an XIRR on irregular dates', () => {
    const flows = [flow('2008-01-01', -1_000_000), flow('2008-03-01', 275_000), flow('2008-10-30', 425_000), flow('2009-02-15', 325_000), flow('2009-04-01', 275_000)]

    expect(solvedRate(flows, daysOver365)).toBeCloseTo(0.373362535, 8)
  })

  it("gives the worked portfolio's 7.4% a year over 665 days", () => {
    const flows = [flow('2025-01-02', -300_000), flow('2026-10-29', 341_475)]

    expect(solvedRate(flows, daysOver365)).toBeCloseTo(0.0737, 4)
  })

  it('solves a rate below zero, as a big deposit before a fall gives', () => {
    const flows = [flow('2025-01-01', -100_000), flow('2025-07-01', -1_000_000), flow('2025-12-31', 1_054_500)]

    expect(solvedRate(flows, daysOver365)).toBeCloseTo(-0.0745, 4)
  })

  it('finds no rate when every flow has the same sign', () => {
    expect(solvedRate([flow('2025-01-01', -100_000), flow('2026-01-01', -50_000)], daysOver365)).toBeNull()
    expect(solvedRate([flow('2025-01-01', 100_000), flow('2026-01-01', 50_000)], daysOver365)).toBeNull()
    expect(solvedRate([], daysOver365)).toBeNull()
  })

  it('gives the same rate whichever side calls money out negative', () => {
    const flows = [flow('2025-01-02', -300_000), flow('2026-10-29', 341_475)]

    expect(solvedRate(negated(flows), daysOver365)).toBeCloseTo(solvedRate(flows, daysOver365)!, 10)
  })

  it('takes the rate nearest zero when flows change sign twice and two rates balance them', () => {
    // −100 + 235 ÷ (1 + r) − 136.5 ÷ (1 + r)² is zero at 5% and at 30%
    const flows = [flow('2025-01-01', -10_000), flow('2026-01-01', 23_500), flow('2027-01-01', -13_650)]

    expect(solvedRate(flows, daysOver365)).toBeCloseTo(0.05, 8)
  })

  it('finds two rates that fall between the same wide steps, 12% and 20%, and takes 12%', () => {
    // −100 + 232 ÷ (1 + r) − 134.40 ÷ (1 + r)² is zero at 12% and at 20%
    const flows = [flow('2025-01-01', -10_000), flow('2026-01-01', 23_200), flow('2027-01-01', -13_440)]

    expect(solvedRate(flows, daysOver365)).toBeCloseTo(0.12, 8)
  })

  it('takes +2% over −5% when the rates sit on either side of zero', () => {
    // −100 + 197 ÷ (1 + r) − 96.90 ÷ (1 + r)² is zero at −5% and at 2%
    const flows = [flow('2025-01-01', -10_000), flow('2026-01-01', 19_700), flow('2027-01-01', -9_690)]

    expect(solvedRate(flows, daysOver365)).toBeCloseTo(0.02, 8)
  })

  it('gives exactly zero when the flows balance with no return', () => {
    expect(solvedRate([flow('2025-01-02', -100_000), flow('2026-01-02', 100_000)], daysOver365)).toBe(0)
  })

  it('counts years from the earliest flow, whatever the order flows come in', () => {
    const flows = [flow('2026-10-29', 341_475), flow('2025-01-02', -300_000)]

    expect(solvedRate(flows, daysOver365)).toBeCloseTo(0.0737, 4)
  })
})
