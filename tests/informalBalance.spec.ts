import { describe, expect, it } from 'vitest'

import { informalBalanceOn, informalBalances, lastMovement } from '../src/apps/loans/informalLoans/domain/informalBalance'
import { civil, euros } from './fixtures/ledger'
import { informalLoan, movement } from './fixtures/loans'

describe("an informal loan's balance", () => {
  const loan = informalLoan()

  it('adds what is borrowed, in money or in kind, and takes off what is repaid, repaid in kind or forgiven, by date', () => {
    const movements = [
      movement(loan, '2026-05-10', 'borrowed', 300),
      movement(loan, '2026-03-15', 'repaid', 500),
      movement(loan, '2026-04-02', 'repaid-in-kind', 80),
      movement(loan, '2026-06-01', 'borrowed-in-kind', 45.5),
      movement(loan, '2026-07-01', 'forgiven', 200),
    ]

    // 3,000.00 − 500.00 − 80.00 + 300.00 + 45.50 − 200.00 = 2,565.50.
    expect(informalBalances(loan, movements).map((step) => [step.date, step.movement?.kind ?? null, step.balance / 100])).toEqual([
      ['2026-03-01', null, 3000],
      ['2026-03-15', 'repaid', 2500],
      ['2026-04-02', 'repaid-in-kind', 2420],
      ['2026-05-10', 'borrowed', 2720],
      ['2026-06-01', 'borrowed-in-kind', 2765.5],
      ['2026-07-01', 'forgiven', 2565.5],
    ])
    expect(lastMovement(movements)?.kind).toBe('forgiven')
  })

  it('raises the balance again when money is borrowed back, and reads below zero once the other side owes', () => {
    const movements = [movement(loan, '2026-04-01', 'repaid', 3000), movement(loan, '2026-04-20', 'borrowed', 250), movement(loan, '2026-05-01', 'repaid', 400)]

    // 3,000.00 − 3,000.00 = 0. Borrowing 250.00 back owes 250.00 again, and repaying 400.00 overpays by 150.00.
    expect(informalBalanceOn(loan, movements, civil('2026-04-01'))).toBe(0)
    expect(informalBalanceOn(loan, movements, civil('2026-04-30'))).toBe(euros(250))
    expect(informalBalanceOn(loan, movements, civil('2026-05-01'))).toBe(euros(-150))
  })

  it('owes the opening balance from the start day, nothing before it, and has no last movement without movements', () => {
    expect(informalBalanceOn(loan, [], civil('2026-02-28'))).toBe(0)
    expect(informalBalanceOn(loan, [], civil('2026-03-01'))).toBe(euros(3000))
    expect(lastMovement([])).toBeNull()
  })

  it('takes the last movement of a day in the order the file gives them', () => {
    const movements = [movement(loan, '2026-04-01', 'repaid', 100, 'first'), movement(loan, '2026-04-01', 'borrowed', 40, 'second')]

    expect(lastMovement(movements)?.id).toBe(movements[1]!.id)
  })
})
