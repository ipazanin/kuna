import { describe, expect, it } from 'vitest'

import { loanPlan } from '../src/apps/loans/bankLoans/domain/loanPlan'
import { planYears } from '../src/apps/loans/bankLoans/presentation/bankLoanView'
import { civil } from './fixtures/ledger'
import { bankLoan, ratePeriod } from './fixtures/loans'

describe("a bank loan's plan by year", () => {
  it('marks only the payments still to come at a variable rate as estimates', () => {
    const loan = bankLoan()
    const periods = [ratePeriod(loan, '2026-02-05', '12'), { ...ratePeriod(loan, '2026-08-05', '6'), rateType: 'variable' as const }]
    const book = { loan, ratePeriods: periods, extraPayments: [], lateInstalments: [], plan: loanPlan(loan, periods, []) }

    const lines = planYears(book, civil('2026-09-20')).flatMap((year) => year.lines)

    // August and September 2026 fell due at the variable rate before the day, so the bank's rate for them is known.
    expect(lines.filter((line) => line.estimate).map((line) => line.date)).toEqual(['2026-10-05', '2026-11-05', '2026-12-05', '2027-01-05'])
  })
})
