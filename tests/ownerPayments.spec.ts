import { describe, expect, it } from 'vitest'

import { hrDooWorkbook } from '../src/apps/company/packs/hr-doo/domain/hrDooPart'
import type { HrDooWorkbook } from '../src/apps/company/packs/hr-doo/domain/hrDooPart'
import { ownerPayments } from '../src/apps/company/packs/hr-doo/domain/ownerPayments'
import { fakeStaffOf } from '../src/apps/company/packs/hr-doo/infrastructure/fake/fakeStaff'
import { installedPack, shownPack } from '../src/apps/company/packs/packContribution'
import { presentedWorkbook } from '../src/apps/company/transactions/domain/presentedWorkbook'
import { readDocument } from '../src/apps/company/workbook/infrastructure/companyDocument'
import { FAKE_OWNER, fakeWorkbookDocument, fakeWorkbookDocumentBeforeItems } from '../src/apps/company/workbook/infrastructure/fake/fakeWorkbook'
import type { WorkbookDocument } from '../src/shared/storage/infrastructure/documentFormat'
import { civil, euros } from './fixtures/ledger'

const SYNCED = '2026-10-16T08:00:00.000Z'

function booksOf(document: WorkbookDocument): HrDooWorkbook {
  return hrDooWorkbook(readDocument({ id: 'fake', source: 'browser', title: 'Fake workbook', syncedAt: SYNCED }, document).workbook)
}

const withStaff = booksOf(fakeWorkbookDocument(SYNCED, 'browser', fakeStaffOf('one-employee')))
const owner = booksOf(fakeWorkbookDocument(SYNCED, 'browser'))

function paymentOf(books: HrDooWorkbook, description: string) {
  const row = books.transactions.find((candidate) => candidate.description === description && candidate.counterpartyIban === FAKE_OWNER.iban)!
  return ownerPayments(books).find((payment) => payment.rowId === row.rowId)
}

describe('the money between the company and the owner', () => {
  it('gives each kind of payment to the owner, and money from the owner the other way', () => {
    expect(paymentOf(owner, 'Home office rent 2026-08')?.parts).toEqual([{ kind: 'rent', amount: euros(300) }])
    expect(paymentOf(owner, 'Dividend 2025')?.parts).toEqual([{ kind: 'dividend', amount: euros(4000) }])
    expect(paymentOf(owner, 'Refund of a parking fee')?.parts).toEqual([{ kind: 'reimbursement', amount: euros(38.5) }])
    expect(paymentOf(owner, 'Loan to owner')).toMatchObject({ direction: 'to-owner', amount: euros(3000), parts: [{ kind: 'owner-loan', amount: euros(3000) }] })
    expect(paymentOf(owner, 'Loan repaid')).toMatchObject({ direction: 'from-owner', amount: euros(3000), parts: [{ kind: 'owner-loan', amount: euros(3000) }] })
  })

  it('names the row, its day and both IBANs', () => {
    const rent = owner.transactions.find((row) => row.description === 'Home office rent 2026-08')!
    const account = owner.accounts.find((candidate) => candidate.slug === rent.account)!

    expect(paymentOf(owner, 'Home office rent 2026-08')).toMatchObject({ rowId: rent.rowId, date: civil('2026-09-12'), companyIban: account.iban, ownerIban: FAKE_OWNER.iban })
  })

  it('counts share capital as other money', () => {
    expect(paymentOf(owner, 'Share capital paid in')).toMatchObject({ direction: 'from-owner', parts: [{ kind: 'other', amount: euros(2500) }] })
  })

  it('publishes a salary row whole as salary, whatever it carries, and a split one as one part per kind with a tax-free part apart', () => {
    expect(paymentOf(owner, 'Salary for 2026-07')?.parts).toEqual([{ kind: 'salary', amount: euros(1100) }])
    expect(paymentOf(owner, 'Salary for 2026-06')?.parts).toEqual([{ kind: 'salary', amount: euros(1100) }])
    const bonusTaxFree = { ...owner, categories: owner.categories.map((category) => (category.slug === 'salary-bonus' ? { ...category, roles: ['tax-free:results-bonus'] } : category)) }

    expect(paymentOf(bonusTaxFree, 'Salary for 2026-06')?.parts).toEqual([
      { kind: 'salary', amount: euros(900) },
      { kind: 'tax-free', payment: 'results-bonus', amount: euros(200) },
    ])
  })

  it('splits a trip payout into its tax-free payments and the trip costs it pays back', () => {
    expect(paymentOf(withStaff, 'Travel order 1/2026')).toMatchObject({
      amount: euros(383.4),
      parts: [
        { kind: 'tax-free', payment: 'private-car-business-travel', amount: euros(285) },
        { kind: 'tax-free', payment: 'domestic-per-diem-over-12-hours', amount: euros(51) },
        { kind: 'reimbursement', amount: euros(47.4) },
      ],
    })
  })

  it('gives the same payments before the move to items, and as the screens count the ledger', () => {
    const before = booksOf(fakeWorkbookDocumentBeforeItems(SYNCED, 'browser', fakeStaffOf('one-employee')))

    expect(ownerPayments(before)).toEqual(ownerPayments(withStaff))
    expect(ownerPayments(hrDooWorkbook(presentedWorkbook(withStaff)))).toEqual(ownerPayments(withStaff))
  })

  it('leaves out a row with no row id, a row to anyone else, and the costs the owner paid privately', () => {
    const paidToOwner = owner.transactions.filter((row) => row.counterpartyIban === FAKE_OWNER.iban).sort((earlier, later) => earlier.sequence - later.sequence)
    const withoutId = { ...owner, transactions: owner.transactions.map((row) => (row.description === 'Dividend 2025' ? { ...row, rowId: null } : row)) }

    expect(owner.ownerAdvances.length).toBeGreaterThan(0)
    expect(ownerPayments(owner).map((payment) => payment.rowId)).toEqual(paidToOwner.map((row) => row.rowId))
    expect(ownerPayments(withoutId)).toHaveLength(paidToOwner.length - 1)
  })

  it('has every payment add up its parts to the row, oldest first', () => {
    const payments = ownerPayments(withStaff)

    expect(payments.every((payment) => payment.parts.reduce((sum, part) => sum + part.amount, 0) === payment.amount)).toBe(true)
    expect(payments.map((payment) => payment.date)).toEqual(payments.map((payment) => payment.date).sort())
  })

  it('publishes the payments to core in its own words for salary and costs paid back, and none without the pack', () => {
    const published = installedPack().moneyWithOwner(withStaff)

    expect(published.map((payment) => payment.rowId)).toEqual(ownerPayments(withStaff).map((payment) => payment.rowId))
    expect(published.find((payment) => payment.date === civil('2026-07-12') && payment.parts[0]?.kind === 'net-salary')).toBeDefined()
    expect(published.find((payment) => payment.date === civil('2026-03-20'))?.parts.map((part) => part.kind)).toEqual(['tax-free', 'tax-free', 'cost-refund'])
    expect(shownPack({ ownerPayModule: false }).moneyWithOwner(owner)).toEqual([])
  })
})
