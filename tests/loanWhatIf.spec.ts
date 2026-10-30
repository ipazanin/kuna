import { describe, expect, it } from 'vitest'

import { splitOfRows } from '../src/apps/loans/bankLoans/domain/loanFigures'
import { loanPlan } from '../src/apps/loans/bankLoans/domain/loanPlan'
import { whatIfExtraPayment } from '../src/apps/loans/bankLoans/domain/whatIf'
import type { BankLoan } from '../src/apps/loans/workbook/domain/bankLoan'
import type { RatePeriod } from '../src/apps/loans/workbook/domain/ratePeriod'
import type { BankLoanBook } from '../src/apps/loans/workbook/domain/readLoanBook'
import { subtractMoney } from '../src/shared/money/money'
import { civil, euros } from './fixtures/ledger'
import { bankLoan, extraPayment, ratePeriod } from './fixtures/loans'

function bookOf(loan: BankLoan, periods: readonly RatePeriod[]): BankLoanBook {
  return { loan, ratePeriods: periods, extraPayments: [], lateInstalments: [], plan: loanPlan(loan, periods, []) }
}

describe('what an extra payment would do', () => {
  const loan = bankLoan()
  const periods = [ratePeriod(loan, '2026-02-05', '12')]

  it('shows a shorter term and a lower instalment side by side, against the plan as it stands', () => {
    const { outcomes, subsidyRepaidUntil } = whatIfExtraPayment(bookOf(loan, periods), civil('2026-07-05'), euros(300))!
    const interestOf = (effect: 'shorter-term' | 'lower-instalment') => splitOfRows(loanPlan(loan, periods, [extraPayment(loan, '2026-07-05', 300, effect)])).interest
    const interestBefore = splitOfRows(loanPlan(loan, periods, [])).interest

    // As the plan specs work out: a shorter term ends with instalment 10 on 2026-11-05, two fewer, and a lower instalment pays 54.85 to the end.
    expect(outcomes).toEqual([
      { effect: 'shorter-term', payoff: civil('2026-11-05'), monthsSaved: 2, interestSaved: subtractMoney(interestBefore, interestOf('shorter-term')), nextInstalment: euros(106.62) },
      { effect: 'lower-instalment', payoff: civil('2027-01-05'), monthsSaved: 0, interestSaved: subtractMoney(interestBefore, interestOf('lower-instalment')), nextInstalment: euros(54.85) },
    ])
    expect(subsidyRepaidUntil).toBeNull()
  })

  it('counts only the interest you pay as saved, never what the subsidy would have paid', () => {
    // A subsidy of 50.00 on every instalment pays the whole of each month's interest, at most 12.00, so you pay none with or without the payment.
    const subsidised = bankLoan({ subsidy: { monthly: euros(50), firstInstalment: 1, instalments: 12, payer: '' } })
    const { outcomes } = whatIfExtraPayment(bookOf(subsidised, [ratePeriod(subsidised, '2026-02-05', '12')]), civil('2026-07-05'), euros(300))!

    expect(outcomes.map((outcome) => outcome.interestSaved)).toEqual([0, 0])
  })

  it('warns up to 24 months after the subsidy’s last covered instalment, and not after', () => {
    const subsidised = bankLoan({ instalments: 60, subsidy: { monthly: euros(10), firstInstalment: 1, instalments: 12, payer: '' } })
    const book = bookOf(subsidised, [ratePeriod(subsidised, '2026-02-05', '12')])

    // Instalment 12 falls due on 2027-01-05, so the window runs to 2029-01-05.
    expect(whatIfExtraPayment(book, civil('2029-01-05'), euros(100))!.subsidyRepaidUntil).toBe(civil('2029-01-05'))
    expect(whatIfExtraPayment(book, civil('2029-01-06'), euros(100))!.subsidyRepaidUntil).toBeNull()
  })

  it('tries nothing while the plan cannot be worked out', () => {
    expect(whatIfExtraPayment({ ...bookOf(loan, periods), plan: null }, civil('2026-07-05'), euros(300))).toBeNull()
  })
})
