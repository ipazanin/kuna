import { describe, expect, it } from 'vitest'

import { fakeStaffOf } from '../src/apps/company/packs/hr-doo/infrastructure/fake/fakeStaff'
import { publishedMoneyWithOwner } from '../src/apps/company/transactions/application/publishedMoneyWithOwner'
import { readDocument } from '../src/apps/company/workbook/infrastructure/companyDocument'
import { fakeWorkbookDocument } from '../src/apps/company/workbook/infrastructure/fake/fakeWorkbook'
import { companyTargetsFrom } from '../src/apps/spending/links/application/companyTargets'
import { companyRolesAsk, likelyCategoryOf } from '../src/apps/spending/links/domain/companyRoles'
import { ownerPaymentOffers, pastOwnerPayments } from '../src/apps/spending/links/domain/ownerPaymentOffers'
import type { LinkTarget } from '../src/apps/spending/links/domain/linkTarget'
import { SPENDING_DOCUMENT } from '../src/apps/spending/workbook/infrastructure/spendingDocument'
import { fakeSpendingDocument } from '../src/apps/spending/workbook/infrastructure/fake/fakeSpending'
import { accountMoneyFromAmount } from '../src/shared/money/accountMoney'
import { civil } from './fixtures/ledger'

const SYNCED = '2026-11-18T08:00:00.000Z'
const meta = { id: 'fake', source: 'browser' as const, title: 'Fake', syncedAt: SYNCED, lastExportedAt: null, unexportedSince: null }
const company = readDocument(meta, fakeWorkbookDocument(SYNCED, 'browser', fakeStaffOf('one-employee'))).workbook
const book = SPENDING_DOCUMENT.read({ meta, revision: '1', document: fakeSpendingDocument(SYNCED, 'company', civil('2026-11-18')) }).workbook
const payments: readonly LinkTarget[] = companyTargetsFrom([{ app: 'company', money: publishedMoneyWithOwner(company) }]).flatMap(({ targets }) => (Array.isArray(targets) ? targets : []))
const descriptionOf = (id: string) => book.transactions.find((row) => row.id === id)?.description

describe('the rows To review offers as payments between your company and you', () => {
  it('matches each payment no row is linked to with a row of its amount on the account the payment names, the way the money went, and leaves out the rows on other accounts', () => {
    const offers = ownerPaymentOffers(book, payments)

    expect(offers.map(({ row, suggested, difference }) => [descriptionOf(row.id), suggested, difference])).toEqual([
      ['Travel order 2026-03', true, accountMoneyFromAmount(0)],
      ['Loan repayment', true, accountMoneyFromAmount(0)],
      ['Salary 2026-07', true, accountMoneyFromAmount(0)],
    ])
    expect(offers.every(({ row }) => book.accounts.find((account) => account.id === row.account)?.iban === 'XX00FAKE0000000000000020')).toBe(true)
  })

  it('puts the rows filed already on one card, and none on or before the day you said Not now', () => {
    const offers = ownerPaymentOffers(book, payments)
    expect(pastOwnerPayments(book, offers, null).map(({ row }) => descriptionOf(row.id))).toEqual(['Loan repayment', 'Salary 2026-07'])
    expect(pastOwnerPayments(book, offers, civil('2026-05-19')).map(({ row }) => descriptionOf(row.id))).toEqual(['Salary 2026-07'])
  })

  it('offers a near amount inside the window without suggesting it', () => {
    const near = { ...book, transactions: book.transactions.map((row) => (row.description === 'Salary 2026-07' ? { ...row, amount: accountMoneyFromAmount(1_000) } : row)) }
    const offer = ownerPaymentOffers(near, payments).find(({ row }) => descriptionOf(row.id) === 'Salary 2026-07')
    expect([offer?.suggested, offer?.difference]).toEqual([false, accountMoneyFromAmount(-36.26)])
  })
})

describe('the card asking where Kuna files payments from your company', () => {
  const owner = payments.filter((target) => target.kind === 'owner-payment')

  it('asks nothing of a file whose categories hold every role a payment since the account opened needs', () => {
    expect(companyRolesAsk(book, owner)).toBeNull()
  })

  it('asks for the roles no category holds, in a file from before roles, and preselects the income category named as the starter', () => {
    const beforeRoles = { ...book, categories: book.categories.filter((category) => category.role !== 'travel-allowance').map((category) => ({ ...category, role: null })) }
    const ask = companyRolesAsk(beforeRoles, owner)

    expect(ask).toEqual({ roles: ['salary', 'rental-income', 'profit-payout', 'travel-allowance'], through: civil('2026-09-12') })
    expect(likelyCategoryOf(beforeRoles.categories, 'salary')).toBe(book.categories.find((category) => category.name === 'Salary')?.id)
    expect(likelyCategoryOf(beforeRoles.categories, 'travel-allowance')).toBeNull()
    expect(companyRolesAsk({ ...beforeRoles, settings: { ...beforeRoles.settings, companyRolesPutOff: civil('2026-09-12') } }, owner)).toBeNull()
  })

  it('preselects no category the card does not list, one hidden or holding a role already', () => {
    const salary = book.categories.find((category) => category.name === 'Salary')?.id
    const shaped = (shape: { readonly hidden: boolean; readonly role: 'rental-income' | null }) =>
      book.categories.map((category) => (category.id === salary ? { ...category, ...shape } : { ...category, role: null }))

    expect(likelyCategoryOf(shaped({ hidden: true, role: null }), 'salary')).toBeNull()
    expect(likelyCategoryOf(shaped({ hidden: false, role: 'rental-income' }), 'salary')).toBeNull()
  })
})
