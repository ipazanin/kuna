import { reactive } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import { loanPlan } from '../src/apps/loans/bankLoans/domain/loanPlan'
import { bankLoansOf, publishedBankLoans } from '../src/apps/loans/facts'
import { owedOnDay } from '../src/apps/loans/overview/domain/owedTotals'
import type { BankLoan } from '../src/apps/loans/workbook/domain/bankLoan'
import type { BankLoanBook } from '../src/apps/loans/workbook/domain/readLoanBook'
import { fakeLoansDocument } from '../src/apps/loans/workbook/infrastructure/fake/fakeLoans'
import { LOANS_DOCUMENT } from '../src/apps/loans/workbook/infrastructure/loansDocument'
import type { WorkbookStatus } from '../src/shared/storage/application/createWorkbookStore'
import { civil, euros } from './fixtures/ledger'
import { bankLoan, LOAN_UUID, ratePeriod } from './fixtures/loans'

const loans = vi.hoisted(() => ({ state: null as unknown as { workbook: unknown; status: WorkbookStatus } }))
vi.mock('../src/apps/loans/workbook/application/loansStore', async () => {
  const { reactive: made } = await import('vue')
  loans.state = made({ workbook: null, status: 'opening' })
  return { useLoansBooks: () => ({ state: loans.state }) }
})

const AT = '2026-11-04T09:00:00.000Z'
const DAY = civil('2026-11-04')

function sample() {
  return LOANS_DOCUMENT.read({ meta: { id: 'facts', source: 'browser', title: 'facts', syncedAt: AT, lastExportedAt: null, unexportedSince: null }, revision: '1', document: fakeLoansDocument(AT) })
    .workbook
}

function bookOf(loan: BankLoan, planned = true): BankLoanBook {
  const periods = [ratePeriod(loan, loan.firstInstalment, '6')]
  return { loan, ratePeriods: periods, extraPayments: [], lateInstalments: [], plan: planned ? loanPlan(loan, periods, []) : null }
}

describe('the bank loans Loans publishes', () => {
  it("gives the sample's home loan by its bare UUID with what you owe on it today and a link to its page", () => {
    const book = sample()
    const home = book.bankLoans.find((entry) => entry.loan.name === 'Home loan')!

    const [published] = bankLoansOf({ bankLoans: [home] }, DAY)

    expect(published).toEqual({
      key: 'fa4e0000-0000-4000-8000-000000000001',
      name: 'Home loan',
      owed: owedOnDay({ bankLoans: [home], informalLoans: [] }, DAY).owed,
      to: { path: '/loans/bank-loan', query: { loan: 'fa4e0000-0000-4000-8000-000000000001' } },
    })
    expect(published!.owed).toBeGreaterThan(0)
  })

  it('gives a loan with no rate period at its first instalment with nothing owed known', () => {
    expect(bankLoansOf({ bankLoans: [bookOf(bankLoan(), false)] }, DAY)).toEqual([expect.objectContaining({ key: LOAN_UUID, owed: null })])
  })

  it('gives a loan paid off by the day at nothing owed', () => {
    // The car loan's twelfth and last instalment falls due on 5 Jan 2027.
    expect(bankLoansOf({ bankLoans: [bookOf(bankLoan())] }, civil('2027-02-01'))).toEqual([expect.objectContaining({ owed: euros(0) })])
  })

  it('waits while the Loans file opens, fails with it, and is null while Loans is not set up', () => {
    loans.state.status = 'opening'
    expect(publishedBankLoans(DAY)).toBe('opening')
    loans.state.status = 'error'
    expect(publishedBankLoans(DAY)).toBe('failed')
    loans.state.status = 'ready'
    expect(publishedBankLoans(DAY)).toBeNull()
    loans.state.workbook = reactive(sample())
    expect(publishedBankLoans(DAY)).toHaveLength(sample().bankLoans.length)
  })
})
