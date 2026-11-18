import { describe, expect, it } from 'vitest'

import { loanPlan } from '../src/apps/loans/bankLoans/domain/loanPlan'
import { loansHomeFigures } from '../src/apps/loans/home/presentation/loansHomeFigures'
import type { BankLoan } from '../src/apps/loans/workbook/domain/bankLoan'
import type { InformalLoan } from '../src/apps/loans/workbook/domain/informalLoan'
import { INFORMAL_LOAN_RECORDS } from '../src/apps/loans/workbook/domain/loanKinds'
import { fakeLoansDocument } from '../src/apps/loans/workbook/infrastructure/fake/fakeLoans'
import { LOANS_DOCUMENT } from '../src/apps/loans/workbook/infrastructure/loansDocument'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { civil, euros } from './fixtures/ledger'
import { bankLoan, informalLoan, ratePeriod } from './fixtures/loans'

// Before the first instalment, the bank loan's whole 1,200.00 is still owed.
const DAY = civil('2026-01-20')

function bankBook(loan: BankLoan) {
  const periods = [ratePeriod(loan, loan.firstInstalment, '12')]
  return { loan, ratePeriods: periods, extraPayments: [], shares: [], lateInstalments: [], plan: loanPlan(loan, periods, []) }
}

function informalBook(loan: InformalLoan) {
  return { loan, movements: [] }
}

const TO_MARKO = informalLoan({ id: recordIdOf(INFORMAL_LOAN_RECORDS, 'to-marko'), name: 'To Marko', direction: 'owed-to-you', openingBalance: euros(800), start: civil('2026-01-02') })

describe("Loans' card on the Kuna home", () => {
  it('shows the net and what you owe for a bank loan alone', () => {
    expect(loansHomeFigures({ bankLoans: [bankBook(bankLoan())], informalLoans: [] }, DAY)).toEqual({
      amounts: [
        { label: 'Net', cents: euros(-1200), tone: 'outcome' },
        { label: 'You owe in all', cents: euros(1200) },
      ],
      waiting: null,
    })
  })

  it('shows the net and what is owed to you for money lent alone', () => {
    expect(loansHomeFigures({ bankLoans: [], informalLoans: [informalBook(TO_MARKO)] }, DAY).amounts).toEqual([
      { label: 'Net', cents: euros(800), tone: 'outcome' },
      { label: 'Owed to you', cents: euros(800) },
    ])
  })

  it("shows a net above zero on the fake build's lending set", () => {
    const at = '2026-11-04T09:00:00.000Z'
    const meta = { id: 'lending', source: 'browser', title: 'lending', syncedAt: at, lastExportedAt: null, unexportedSince: null } as const
    const book = LOANS_DOCUMENT.read({ meta, revision: '1', document: fakeLoansDocument(at, 'lending') }).workbook

    // Petra owes 6,000.00 less two repayments of 500.00 and 500.00 in kind, and you owe Dora 4,000.00 less two of 250.00.
    expect(loansHomeFigures(book, civil('2026-11-04')).amounts).toEqual([
      { label: 'Net', cents: euros(1000), tone: 'outcome' },
      { label: 'You owe in all', cents: euros(3500) },
      { label: 'Owed to you', cents: euros(4500) },
    ])
  })

  it('shows both sides under the net while each is above zero', () => {
    // 800.00 owed to you less 1,200.00 you owe.
    expect(loansHomeFigures({ bankLoans: [bankBook(bankLoan())], informalLoans: [informalBook(TO_MARKO)] }, DAY).amounts).toEqual([
      { label: 'Net', cents: euros(-400), tone: 'outcome' },
      { label: 'You owe in all', cents: euros(1200) },
      { label: 'Owed to you', cents: euros(800) },
    ])
  })

  it('shows the net alone when nothing is owed either way', () => {
    expect(loansHomeFigures({ bankLoans: [], informalLoans: [] }, DAY).amounts).toEqual([{ label: 'Net', cents: euros(0), tone: 'outcome' }])
  })
})
