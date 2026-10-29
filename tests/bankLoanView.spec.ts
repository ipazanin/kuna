import { describe, expect, it } from 'vitest'

import { loanPlan } from '../src/apps/loans/bankLoans/domain/loanPlan'
import { bankLoanFigures, planYears } from '../src/apps/loans/bankLoans/presentation/bankLoanView'
import { euros } from './fixtures/ledger'
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

describe("a bank loan's figures on a day", () => {
  const loan = bankLoan({ subsidy: { monthly: euros(20), firstInstalment: 1, instalments: 12, payer: 'APN' } })
  const periods = [ratePeriod(loan, '2026-02-05', '12')]
  const book = { loan, ratePeriods: periods, extraPayments: [], lateInstalments: [], plan: loanPlan(loan, periods, []) }

  it('gives what is paid back, what is still to pay and who pays it, and the subsidy instalments to go', () => {
    const figures = bankLoanFigures(book, civil('2026-11-05'))

    // After instalment 10, 210.06 of 1,200.00 is owed, so 989.94 or 82% is paid back.
    expect(figures).toMatchObject({ owed: euros(210.06), paidBack: euros(989.94), paidBackPercent: 82, instalmentsLeft: 2 })
    expect(figures?.subsidy).toMatchObject({ lastCovered: '2027-01-05', ended: false, instalmentsLeft: 2 })
    // The interest of 2026's instalments is 78.36, which the subsidy's 20.00 a month covers in full.
    expect(figures?.interestThisYear).toEqual({ year: 2026, interest: euros(78.36), subsidy: euros(78.36) })
    expect(figures?.stillToPay).toEqual({ principal: euros(173.22), interest: 0, subsidyPrincipal: euros(36.84), subsidyInterest: euros(3.16), extra: 0 })
  })
})
