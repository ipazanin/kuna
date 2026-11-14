import { describe, expect, it } from 'vitest'

import { loanPlan } from '../src/apps/loans/bankLoans/domain/loanPlan'
import { bankLoanFigures } from '../src/apps/loans/bankLoans/domain/bankLoanFigures'
import { informalLoanFigures } from '../src/apps/loans/informalLoans/domain/informalLoanFigures'
import { loansNetWorthParts } from '../src/apps/loans/home/domain/loansNetWorthParts'
import { netDirection, netOwed, owedOnDay, owedTotals } from '../src/apps/loans/overview/domain/owedTotals'
import type { BankLoan } from '../src/apps/loans/workbook/domain/bankLoan'
import type { InformalLoan } from '../src/apps/loans/workbook/domain/informalLoan'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { INFORMAL_LOAN_RECORDS } from '../src/apps/loans/workbook/domain/loanKinds'
import { civil, euros } from './fixtures/ledger'
import { bankLoan, informalLoan, movement, ratePeriod } from './fixtures/loans'

function bankBook(loan: BankLoan, withPlan = true) {
  const periods = [ratePeriod(loan, loan.firstInstalment, '12')]
  return { loan, ratePeriods: periods, extraPayments: [], lateInstalments: [], plan: withPlan ? loanPlan(loan, periods, []) : null }
}

function informalBook(loan: InformalLoan, movements: ReturnType<typeof movement>[] = []) {
  return { loan, movements }
}

describe('what you owe over every loan', () => {
  // Before the first instalment, the bank loan's whole 1,200.00 is still owed.
  const day = civil('2026-01-20')

  function totalsOf(bankBooks: ReturnType<typeof bankBook>[], informalBooks: ReturnType<typeof informalBook>[]) {
    return owedTotals({ bank: bankBooks.map((book) => bankLoanFigures(book, day)), informal: informalBooks.map((book) => informalLoanFigures(book, day)) })
  }

  it('adds every bank loan and every informal loan you owe on', () => {
    const fromAna = informalLoan({ start: civil('2026-01-02') })

    expect(totalsOf([bankBook(bankLoan())], [informalBook(fromAna, [movement(fromAna, '2026-01-10', 'repaid', 500)])])).toEqual({
      // 1,200.00 + 3,000.00 − 500.00.
      owed: euros(3700),
      owedToYou: euros(0),
      loansYouOwe: 2,
      loansOwedToYou: 0,
    })
  })

  it('keeps what others owe you apart, whichever way the loan runs', () => {
    const toMarko = informalLoan({ id: recordIdOf(INFORMAL_LOAN_RECORDS, 'to-marko'), name: 'To Marko', direction: 'owed-to-you', openingBalance: euros(800), start: civil('2026-01-02') })
    const overpaid = informalLoan({ start: civil('2026-01-02') })

    // Repaying 3,150.00 of 3,000.00 leaves Ana owing you 150.00, beside the 800.00 Marko owes.
    expect(totalsOf([bankBook(bankLoan())], [informalBook(toMarko), informalBook(overpaid, [movement(overpaid, '2026-01-10', 'repaid', 3150)])])).toEqual({
      owed: euros(1200),
      owedToYou: euros(950),
      loansYouOwe: 1,
      loansOwedToYou: 2,
    })
  })

  it('adds nothing for a bank loan whose plan cannot be worked out', () => {
    expect(totalsOf([bankBook(bankLoan(), false)], [])).toEqual({ owed: euros(0), owedToYou: euros(0), loansYouOwe: 0, loansOwedToYou: 0 })
  })
})

describe('what you owe over every loan of the file on a day', () => {
  it('works out each loan’s figures on the day and adds them up', () => {
    const toMarko = informalLoan({ id: recordIdOf(INFORMAL_LOAN_RECORDS, 'to-marko'), name: 'To Marko', direction: 'owed-to-you', openingBalance: euros(800), start: civil('2026-01-02') })

    // Before the first instalment the bank loan's 1,200.00 is owed, and Marko owes you 800.00.
    expect(owedOnDay({ bankLoans: [bankBook(bankLoan())], informalLoans: [informalBook(toMarko)] }, civil('2026-01-20'))).toEqual({
      owed: euros(1200),
      owedToYou: euros(800),
      loansYouOwe: 1,
      loansOwedToYou: 1,
    })
  })
})

describe('the net of what others owe you and what you owe', () => {
  it('is below zero while you owe more, as with a home loan and a small loan to a friend', () => {
    // 1,200.00 − 182,400.00.
    expect(netOwed({ owed: euros(182_400), owedToYou: euros(1_200) })).toEqual(euros(-181_200))
    expect(netDirection(euros(-181_200))).toBe('you-owe')
  })

  it('is above zero while others owe you more', () => {
    // 182,400.00 − 1,200.00.
    expect(netOwed({ owed: euros(1_200), owedToYou: euros(182_400) })).toEqual(euros(181_200))
    expect(netDirection(euros(181_200))).toBe('owed-to-you')
  })

  it('is zero with no direction when the two ways are even', () => {
    expect(netOwed({ owed: euros(500), owedToYou: euros(500) })).toEqual(euros(0))
    expect(netDirection(euros(0))).toBeNull()
  })
})

describe('what Loans adds to the sum on Net worth', () => {
  const toMarko = informalLoan({ id: recordIdOf(INFORMAL_LOAN_RECORDS, 'to-marko'), name: 'To Marko', direction: 'owed-to-you', openingBalance: euros(800), start: civil('2026-01-02') })

  it('adds what others owe you when they do, then what you owe', () => {
    expect(loansNetWorthParts({ bankLoans: [bankBook(bankLoan())], informalLoans: [informalBook(toMarko)] }, civil('2026-01-20'))).toEqual([
      { side: 'has', cents: euros(800) },
      { side: 'owes', cents: euros(1200) },
    ])
  })

  it('leaves out what others owe you when nobody does, and keeps what you owe at zero', () => {
    expect(loansNetWorthParts({ bankLoans: [], informalLoans: [] }, civil('2026-01-20'))).toEqual([{ side: 'owes', cents: euros(0) }])
  })
})
