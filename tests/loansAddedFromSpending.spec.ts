import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { BANK_LOAN_WRITES, RATE_PERIOD_WRITES } from '../src/apps/loans/bankLoans/application/bankLoanWrites'
import { addExtraPayment, addMovement } from '../src/apps/loans/facts'
import { INFORMAL_LOAN_WRITES } from '../src/apps/loans/informalLoans/application/informalLoanWrites'
import { EXTRA_PAYMENT_RECORDS } from '../src/apps/loans/workbook/domain/loanKinds'
import type { LoansBooks } from '../src/apps/loans/workbook/domain/loansBooks'
import { emptyLoansDocument } from '../src/apps/loans/workbook/infrastructure/loansDocument'
import type { WorkbookStore } from '../src/shared/storage/application/createWorkbookStore'
import { keyOfRecordId } from '../src/shared/storage/domain/recordId'
import { civil, euros } from './fixtures/ledger'
import { LOAN_UUID, OTHER_UUID, bankLoan, informalLoan, ratePeriod } from './fixtures/loans'
import { LOANS, browserHarness, forgetCaches } from './fixtures/writeBack'

const loans = vi.hoisted(() => ({ store: null as unknown }))
vi.mock('../src/apps/loans/workbook/application/loansStore', () => ({
  useLoansBooks: () => loans.store ?? { state: { workbook: null, status: 'opening' } },
}))

const LOAN = bankLoan()
const FRIEND = informalLoan()

describe('the records Spending adds in Loans', () => {
  const used = new Set<string>()
  afterEach(async () => {
    loans.store = null
    await forgetCaches(used)
  })

  async function openLoans(): Promise<WorkbookStore<LoansBooks>> {
    const { store } = await browserHarness(used, emptyLoansDocument('2026-10-16T09:00:00.000Z'), LOANS)
    await store.write('Added', (unit) => {
      unit.of(BANK_LOAN_WRITES).add(LOAN)
      unit.of(RATE_PERIOD_WRITES).add(ratePeriod(LOAN, '2026-02-05', '12'))
      unit.of(INFORMAL_LOAN_WRITES).add(FRIEND)
    })
    loans.store = store
    return store
  }

  it('refuses a movement dated before its informal loan starts, as the movement dialog does, and writes nothing', async () => {
    const store = await openLoans()
    await expect(addMovement({ loan: OTHER_UUID, day: civil('2026-02-28'), kind: 'repaid', amount: euros(100), note: '' }, 'Movement added from Spending')).rejects.toThrow(
      'is before "From Ana" starts on 2026-03-01',
    )
    expect(store.state.workbook!.informalLoans[0]!.movements).toEqual([])
  })

  it('adds an extra payment to a bank loan in a write of its own, names it by the link a row stores, and Undo takes it back', async () => {
    const store = await openLoans()
    const added = await addExtraPayment({ loan: LOAN_UUID, day: civil('2026-06-10'), amount: euros(300), effect: 'shorter-term' }, 'Extra payment added from Spending')

    const [payment] = store.state.workbook!.bankLoans[0]!.extraPayments
    expect(payment).toMatchObject({ date: civil('2026-06-10'), amount: euros(300), effect: 'shorter-term' })
    expect(added.link).toEqual({ app: 'loans', kind: EXTRA_PAYMENT_RECORDS.name, key: keyOfRecordId(EXTRA_PAYMENT_RECORDS, payment!.id), due: null })
    await added.undo()
    expect(store.state.workbook!.bankLoans[0]!.extraPayments).toEqual([])
  })
})
