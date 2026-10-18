import { describe, expect, it } from 'vitest'

import { netOwed, ownerAdvances } from '../src/packs/hr-doo/domain/ownerAdvances'
import { ownerLoans } from '../src/packs/hr-doo/domain/ownerLoans'
import { bucketTotals } from '../src/features/workbook/domain/bucketTotals'
import { bookingOfAdvance } from '../src/features/workbook/domain/workbook'
import type { OwnerAdvance } from '../src/features/workbook/domain/workbook'
import { categoryTotals } from '../src/features/spending/domain/categoryTotals'
import { monthlyProfitAndLoss } from '../src/features/trends/domain/monthlyProfitAndLoss'
import { DEFAULT_FILTERS, EVERY_OWNER_ADVANCE } from '../src/features/filters/domain/filterState'
import type { FilterState } from '../src/features/filters/domain/filterState'
import { advancesLeftOutByBankFilters, scopeOwnerAdvances, scopeTransactions } from '../src/features/transactions/domain/filterTransactions'
import { PACK_CATEGORIES, withPackBuckets } from './fixtures/hrDooCategories'
import { civil, euros, ledger, windowOf } from './fixtures/ledger'
import type { RowSpec } from './fixtures/ledger'

let nextRow = 1

function advance(date: string, amount: number, category = 'travel', description = 'Paid privately'): OwnerAdvance {
  nextRow += 1
  const defined = PACK_CATEGORIES.find((candidate) => candidate.slug === category)!
  return { date: civil(date), amount: euros(amount), description, category, family: defined.family, bucket: defined.bucket, sheetRow: nextRow }
}

function rows(specs: readonly RowSpec[]) {
  return withPackBuckets(ledger(specs))
}

describe('owner advances', () => {
  it('repays advances oldest first from reimbursements to the owner, carrying one on into the next advance', () => {
    const book = ownerAdvances(
      [advance('2026-03-01', 50), advance('2026-01-10', 200), advance('2026-02-01', 100)],
      rows([
        { date: '2026-02-15', amount: -250, category: 'reimbursement-to-owner' },
        { date: '2026-03-20', amount: 30, category: 'reimbursement-from-owner' },
      ]),
      PACK_CATEGORIES,
    )

    expect(book.advances.map((line) => [line.advance.date, line.remaining, line.status, line.repaidOn])).toEqual([
      [civil('2026-01-10'), euros(0), 'repaid', civil('2026-02-15')],
      [civil('2026-02-01'), euros(50), 'open', null],
      [civil('2026-03-01'), euros(50), 'open', null],
    ])
    expect(book.advances[1]?.repayments.map((share) => share.applied)).toEqual([euros(50)])
    expect([book.advanced.amount, book.reimbursed.amount, book.outstanding.amount, book.openCount]).toEqual([euros(350), euros(250), euros(100), 2])
  })

  it('states a reimbursement no advance accounts for in the balance, signed', () => {
    const book = ownerAdvances([advance('2026-01-10', 80)], rows([{ date: '2026-02-15', amount: -200, category: 'reimbursement-to-owner' }]), PACK_CATEGORIES)

    expect(book.advances[0]?.status).toBe('repaid')
    expect(book.outstanding.amount).toBe(euros(-120))
  })

  it('nets the loans and the private costs the owner repaid against the advances the company owes, as one signed balance', () => {
    const ledgerRows = rows([
      { date: '2026-01-05', amount: -1000, category: 'owner-loan-out' },
      { date: '2026-02-05', amount: 400, category: 'owner-loan-repaid' },
      { date: '2026-02-15', amount: -100, category: 'reimbursement-to-owner' },
      { date: '2026-02-20', amount: 30, category: 'reimbursement-from-owner' },
    ])
    const loans = ownerLoans(ledgerRows, PACK_CATEGORIES)
    const advances = ownerAdvances([advance('2026-01-20', 250), advance('2026-03-01', 500)], ledgerRows, PACK_CATEGORIES)
    const owed = netOwed(loans, advances, ledgerRows, PACK_CATEGORIES)

    // The owner owes 600 on the loan less the 30 paid back for a private cost, and the company owes 650 of the 750 advanced.
    expect(owed).toMatchObject({ amount: euros(-80), loanBalance: euros(600), advancesOutstanding: euros(650) })
    expect(owed.privateCostsRepaid.amount).toBe(euros(30))
  })

  it('drills every advance figure to rows Transactions lists, the advances among them', () => {
    const ledgerRows = rows([
      { date: '2026-01-05', amount: -1000, category: 'owner-loan-out' },
      { date: '2026-01-06', amount: -80, category: 'travel' },
      { date: '2026-02-15', amount: -100, category: 'reimbursement-to-owner' },
      { date: '2026-02-20', amount: 30, category: 'reimbursement-from-owner' },
    ])
    const advances = [advance('2026-01-20', 250), advance('2026-03-01', 80)]
    const book = ownerAdvances(advances, ledgerRows, PACK_CATEGORIES)
    const owed = netOwed(ownerLoans(ledgerRows, PACK_CATEGORIES), book, ledgerRows, PACK_CATEGORIES)
    const listed = (filters: Partial<FilterState>) => {
      const applied = { ...DEFAULT_FILTERS, ...filters }
      return [...scopeTransactions(ledgerRows, applied).map((row) => `${row.category} ${row.amount}`), ...scopeOwnerAdvances(advances, applied).map((line) => `advance ${line.date}`)]
    }

    expect(listed(book.advanced.drill.filters)).toEqual(['advance 2026-01-20', 'advance 2026-03-01'])
    expect(listed(book.outstanding.drill.filters)).toEqual([`reimbursement-to-owner ${euros(-100)}`, 'advance 2026-01-20', 'advance 2026-03-01'])
    expect(listed(book.advances[1]!.drill.filters)).toEqual(['advance 2026-03-01'])
    expect(listed(owed.privateCostsRepaid.drill.filters)).toEqual([`reimbursement-from-owner ${euros(30)}`])
    expect(listed(owed.drill.filters)).toEqual([
      `reimbursement-from-owner ${euros(30)}`,
      `reimbursement-to-owner ${euros(-100)}`,
      `owner-loan-out ${euros(-1000)}`,
      'advance 2026-01-20',
      'advance 2026-03-01',
    ])
  })
})

describe('advances in profit and loss', () => {
  const ledgerRows = rows([
    { date: '2026-01-04', amount: 5000, category: 'revenue' },
    { date: '2026-01-10', amount: -300, category: 'accounting' },
    { date: '2026-02-11', amount: -120, category: 'reimbursement-to-owner' },
  ])
  const advances = [advance('2026-01-22', 120, 'travel'), advance('2026-02-03', 40, 'payroll-tax')]
  const bookings = [...ledgerRows, ...advances.map(bookingOfAdvance)]

  it('counts as a cost on its date, in its category, while the reimbursement stays financing', () => {
    expect(bucketTotals(bookings)).toMatchObject({ income: euros(5000), operating: euros(420), taxes: euros(40), net: euros(4540) })
    const window = windowOf('2026-01-04', '2026-03-02')
    expect(monthlyProfitAndLoss(bookings, window).map((month) => [month.month, month.lines.cost.amount])).toEqual([
      ['2026-01', euros(420)],
      ['2026-02', euros(40)],
      ['2026-03', euros(0)],
    ])
    expect(categoryTotals(bookings, { preset: 'all' }, window).find((total) => total.category === 'travel')?.amount.amount).toBe(euros(120))
  })

  it('follows the filters an advance can answer, and drops out of a filter on an account, a counterparty or review', () => {
    expect(scopeOwnerAdvances(advances, DEFAULT_FILTERS)).toHaveLength(2)
    expect(scopeOwnerAdvances(advances, { ...DEFAULT_FILTERS, buckets: ['taxes'] }).map((line) => line.category)).toEqual(['payroll-tax'])
    expect(scopeOwnerAdvances(advances, { ...DEFAULT_FILTERS, amount: { min: null, max: euros(-100) } }).map((line) => line.category)).toEqual(['travel'])
    expect(scopeOwnerAdvances(advances, { ...DEFAULT_FILTERS, text: 'privately' })).toHaveLength(2)
    expect(scopeOwnerAdvances(advances, { ...DEFAULT_FILTERS, accounts: ['main'] })).toEqual([])
    expect(scopeOwnerAdvances(advances, { ...DEFAULT_FILTERS, counterparties: ['name:SOMEBODY'] })).toEqual([])
    expect(scopeOwnerAdvances(advances, { ...DEFAULT_FILTERS, needsReview: true })).toEqual([])
    expect(scopeOwnerAdvances(advances, { ...DEFAULT_FILTERS, text: 'owner' })).toHaveLength(2)
    expect(scopeOwnerAdvances(advances, { ...DEFAULT_FILTERS, categories: ['accounting', EVERY_OWNER_ADVANCE] })).toHaveLength(2)
    expect(scopeTransactions(ledgerRows, { ...DEFAULT_FILTERS, categories: [EVERY_OWNER_ADVANCE] })).toEqual([])
  })

  it('counts the advances in the period that only an account, counterparty or review filter leaves out', () => {
    const window = windowOf('2026-01-04', '2026-03-02')
    const all = { ...DEFAULT_FILTERS, period: { preset: 'all' as const } }

    expect(advancesLeftOutByBankFilters(advances, all, window)).toBe(0)
    expect(advancesLeftOutByBankFilters(advances, { ...all, accounts: ['main'] }, window)).toBe(2)
    expect(advancesLeftOutByBankFilters(advances, { ...all, accounts: ['main'], buckets: ['taxes'] }, window)).toBe(1)
    expect(advancesLeftOutByBankFilters(advances, { ...all, needsReview: true, period: { preset: 'custom', range: { from: civil('2026-02-01'), to: civil('2026-02-28') } } }, window)).toBe(1)
  })
})
