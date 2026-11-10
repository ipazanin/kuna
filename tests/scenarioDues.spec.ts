import { describe, expect, it } from 'vitest'

import { NO_COSTS } from '../src/apps/loans/scenarios/domain/loanScenario'
import type { LoanChange } from '../src/apps/loans/scenarios/domain/loanScenario'
import { moveDates, oldLoanDues, scenarioDues } from '../src/apps/loans/scenarios/domain/scenarioDues'
import type { ScenarioBase } from '../src/apps/loans/scenarios/domain/scenarioPlan'
import { civil, euros } from './fixtures/ledger'
import { bankLoan, percent, ratePeriod } from './fixtures/loans'

// 1,200.00 over 12 instalments at 3.5%, due on the 5th from 2026-02-05 to 2027-01-05.
const loan = bankLoan()
const base: ScenarioBase = { loan, ratePeriods: [ratePeriod(loan, '2026-02-05', '3.5')], extraPayments: [], costs: NO_COSTS }
const move: LoanChange = { kind: 'move', on: civil('2026-06-05'), lender: 'Other Bank', rate: percent('3'), rateType: 'fixed', instalments: 6, costs: NO_COSTS }

describe("a scenario's due dates", () => {
  it("numbers the loan's due dates from the first, and runs on over a move's instalments", () => {
    expect(scenarioDues(loan, 0)).toHaveLength(12)
    expect(scenarioDues(loan, 0)[0]).toEqual({ number: 1, date: '2026-02-05' })
    expect(scenarioDues(loan, 6).at(-1)).toEqual({ number: 18, date: '2027-07-05' })
  })

  it('lets a move fall on each due date but the last, whatever move the scenario holds', () => {
    const dates = moveDates(base, [move])!
    expect(dates.size).toBe(11)
    expect(dates.has(civil('2026-12-05'))).toBe(true)
    expect(dates.has(civil('2027-01-05'))).toBe(false)
    expect(oldLoanDues(base, [move])!.find((due) => due.date === '2026-06-05')!.left).toBe(7)
  })

  it('ends where an extra payment shortens the old loan', () => {
    const early: LoanChange = { kind: 'extra-payment', date: civil('2026-03-01'), amount: euros(600), effect: 'shorter-term' }
    const dues = oldLoanDues(base, [early])!
    const dates = moveDates(base, [early])!
    expect(dues.length).toBeLessThan(12)
    expect(dates.has(dues.at(-1)!.date)).toBe(false)
    expect(dates.size).toBe(dues.length - 1)
  })
})
