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
import { advancesLeftOutByBankFilters, filterTransactions, scopeOwnerAdvances, scopeTransactions } from '../src/features/transactions/domain/filterTransactions'
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

  it('lists what a reimbursement pays beyond every cost on file, which net owed counts as paid to the owner until the cost is added', () => {
    const ledgerRows = rows([
      { date: '2026-01-05', amount: -1000, category: 'owner-loan-out' },
      { date: '2026-02-15', amount: -100, category: 'reimbursement-to-owner' },
      { date: '2026-03-28', amount: -45, category: 'reimbursement-to-owner', description: 'Refund of a parking fee' },
    ])
    const advances = [advance('2026-01-20', 80)]
    const book = ownerAdvances(advances, ledgerRows, PACK_CATEGORIES)

    expect(book.unaccounted.map((line) => [line.payment.date, line.payment.amount, line.amount])).toEqual([
      [civil('2026-02-15'), euros(-100), euros(20)],
      [civil('2026-03-28'), euros(-45), euros(45)],
    ])
    expect(book.unaccountedTotal).toBe(euros(65))
    expect(netOwed(ownerLoans(ledgerRows, PACK_CATEGORIES), book, ledgerRows, PACK_CATEGORIES).amount).toBe(euros(1065))

    // The costs the two payments repaid, added as the screen prefills them, settle the list and take net owed back to the loan.
    const settled = ownerAdvances([...advances, advance('2026-02-14', 20), advance('2026-03-27', 45)], ledgerRows, PACK_CATEGORIES)
    expect(settled.unaccounted).toEqual([])
    expect(netOwed(ownerLoans(ledgerRows, PACK_CATEGORIES), settled, ledgerRows, PACK_CATEGORIES).amount).toBe(euros(1000))
  })

  it('drills each unaccounted reimbursement to its own row', () => {
    const ledgerRows = rows([
      { date: '2026-02-15', amount: -100, category: 'reimbursement-to-owner' },
      { date: '2026-02-16', amount: -100, category: 'reimbursement-to-owner' },
    ])
    const book = ownerAdvances([advance('2026-01-20', 100)], ledgerRows, PACK_CATEGORIES)

    const window = windowOf('2026-02-01', '2026-02-28')

    expect(book.unaccounted.map((line) => filterTransactions(ledgerRows, { ...DEFAULT_FILTERS, ...line.drill.filters }, window).map((row) => row.date))).toEqual([[civil('2026-02-16')]])
  })

  it('reads a payment to the owner on a day the owner paid in as returning that payment first, so only the rest repays costs', () => {
    const ledgerRows = rows([
      { date: '2026-02-10', amount: 30, category: 'reimbursement-from-owner' },
      { date: '2026-02-10', amount: -50, category: 'reimbursement-to-owner' },
      { date: '2026-03-01', amount: -80, category: 'reimbursement-to-owner' },
    ])
    const book = ownerAdvances([advance('2026-01-20', 100)], ledgerRows, PACK_CATEGORIES)

    expect(book.advances[0]?.repayments.map((share) => [share.repaidOn, share.applied])).toEqual([
      [civil('2026-02-10'), euros(20)],
      [civil('2026-03-01'), euros(80)],
    ])
    expect(book.unaccounted).toEqual([])
    expect([book.reimbursed.amount, book.outstanding.amount]).toEqual([euros(130), euros(-30)])
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

  describe('a private share of a company payment', () => {
    // The company paid an order of 45.12 filed as office supplies, 9.71 of it private. The owner
    // paid back twice the share by mistake and the company returned the extra 9.71.
    const ledgerRows = rows([
      { date: '2025-08-08', amount: -45.12, category: 'office-supplies' },
      { date: '2025-09-05', amount: 19.42, category: 'reimbursement-from-owner' },
      { date: '2025-09-05', amount: -9.71, category: 'reimbursement-to-owner' },
    ])
    const privateShare = advance('2025-08-08', -9.71, 'office-supplies', 'Private share of the online order')

    it('counts as lent to the owner, so the order, the repayment and the return net to nothing owed', () => {
      const book = ownerAdvances([privateShare], ledgerRows, PACK_CATEGORIES)
      const owed = netOwed(ownerLoans(ledgerRows, PACK_CATEGORIES), book, ledgerRows, PACK_CATEGORIES)

      expect(book.advances).toEqual([])
      expect(book.unaccounted).toEqual([])
      expect(book.privateShares.map((line) => [line.advance.date, line.share])).toEqual([[civil('2025-08-08'), euros(9.71)]])
      expect([book.advanced.amount, book.privateShareTotal.amount, book.reimbursed.amount, book.outstanding.amount]).toEqual([euros(0), euros(9.71), euros(9.71), euros(-9.71)])
      // Lent 9.71 as the share less the 19.42 paid back, against the 9.71 the company returned.
      expect(owed).toMatchObject({ amount: euros(0), loanBalance: euros(0), privateShares: euros(9.71), advancesOutstanding: euros(-9.71) })
      expect(owed.privateCostsRepaid.amount).toBe(euros(19.42))
    })

    it('adds nothing to net owed beside a cost the owner paid, which stays owed in full', () => {
      const advances = [advance('2025-07-01', 100, 'travel'), privateShare]
      const owed = netOwed(ownerLoans(ledgerRows, PACK_CATEGORIES), ownerAdvances(advances, ledgerRows, PACK_CATEGORIES), ledgerRows, PACK_CATEGORIES)

      expect(owed.amount).toBe(euros(-100))
    })

    it('takes the share off the office supplies cost on the day of the order', () => {
      const bookings = [...ledgerRows, bookingOfAdvance(privateShare)]

      expect(bucketTotals(bookings)).toMatchObject({ operating: euros(35.41), net: euros(-35.41) })
      const window = windowOf('2025-08-01', '2025-09-30')
      const officeSupplies = categoryTotals(bookings, { preset: 'all' }, window).find((total) => total.category === 'office-supplies')
      expect(officeSupplies?.amount.amount).toBe(euros(35.41))
      expect(monthlyProfitAndLoss(bookings, window).map((month) => [month.month, month.lines.operating.amount])).toEqual([
        ['2025-08', euros(35.41)],
        ['2025-09', euros(0)],
      ])
    })

    it('drills apart from the costs the owner paid', () => {
      const advances = [advance('2025-07-01', 100, 'travel'), privateShare]
      const book = ownerAdvances(advances, ledgerRows, PACK_CATEGORIES)
      const listed = (filters: Partial<FilterState>) => scopeOwnerAdvances(advances, { ...DEFAULT_FILTERS, ...filters }).map((line) => `${line.category} ${line.date}`)

      expect(listed(book.advanced.drill.filters)).toEqual(['travel 2025-07-01'])
      expect(listed(book.privateShareTotal.drill.filters)).toEqual(['office-supplies 2025-08-08'])
      expect(listed(book.privateShares[0]!.drill.filters)).toEqual(['office-supplies 2025-08-08'])
      expect(listed(book.outstanding.drill.filters)).toEqual(['travel 2025-07-01'])
    })
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
