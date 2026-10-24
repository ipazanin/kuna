import { describe, expect, it } from 'vitest'

import { loanMonths, ownerLoans } from '../src/packs/hr-doo/domain/ownerLoans'
import type { MonthKey } from '../src/shared/calendar/monthKey'
import type { Category } from '../src/features/workbook/domain/workbook'
import { DEFAULT_FILTERS } from '../src/features/filters/domain/filterState'
import type { FilterState } from '../src/features/filters/domain/filterState'
import { scopeTransactions } from '../src/features/transactions/domain/filterTransactions'
import { PACK_CATEGORIES, withPackBuckets } from './fixtures/hrDooCategories'
import { civil, euros, ledger, windowOf } from './fixtures/ledger'
import type { RowSpec } from './fixtures/ledger'
import { withSplit } from './fixtures/splits'
import { BUCKET_COLOUR } from '../src/features/workbook/domain/categoryColour'

function book(rows: readonly RowSpec[], categories: readonly Category[] = PACK_CATEGORIES) {
  return ownerLoans(withPackBuckets(ledger(rows), categories), categories)
}

/** A private cost the company paid for the owner, filed on a category that carries the loan-out role. */
const WITH_PRIVATE_COSTS: readonly Category[] = [
  ...PACK_CATEGORIES,
  { slug: 'private-cost-for-owner', family: 'owner-pay', bucket: 'owner-pay', colour: BUCKET_COLOUR, roles: ['owner-loan-out'], vat: 'none', ownerShare: null },
]

describe('owner loans', () => {
  it('matches repayments to loans first in, first out, carrying a repayment on into the next loan', () => {
    const loans = book([
      { date: '2026-01-10', amount: -1000, category: 'owner-loan-out' },
      { date: '2026-02-10', amount: -500, category: 'owner-loan-out' },
      { date: '2026-03-10', amount: 700, category: 'owner-loan-repaid' },
      { date: '2026-04-10', amount: -2000, category: 'owner-loan-out' },
      { date: '2026-05-10', amount: 1300, category: 'owner-loan-repaid' },
    ])

    expect(loans.loans.map((loan) => [loan.lentOn, loan.amount, loan.remaining, loan.status, loan.repaidOn])).toEqual([
      [civil('2026-01-10'), euros(1000), euros(0), 'repaid', civil('2026-05-10')],
      [civil('2026-02-10'), euros(500), euros(0), 'repaid', civil('2026-05-10')],
      [civil('2026-04-10'), euros(2000), euros(1500), 'open', null],
    ])
    expect(loans.loans[0]?.repayments.map((share) => [share.repaidOn, share.applied])).toEqual([
      [civil('2026-03-10'), euros(700)],
      [civil('2026-05-10'), euros(300)],
    ])
    expect(loans.loans[2]?.repayments.map((share) => share.applied)).toEqual([euros(500)])
    expect([loans.lent.amount, loans.repaid.amount, loans.outstanding.amount]).toEqual([euros(3500), euros(2000), euros(1500)])
    expect([loans.openCount, loans.oldestOpen]).toEqual([1, civil('2026-04-10')])
  })

  it('never closes more than was lent, while the balance states the excess, signed', () => {
    const loans = book([
      { date: '2026-01-05', amount: 800, category: 'owner-loan-repaid' },
      { date: '2026-02-05', amount: -300, category: 'owner-loan-out' },
    ])

    expect(loans.loans[0]?.repayments.map((share) => share.applied)).toEqual([euros(300)])
    expect(loans.loans[0]?.status).toBe('repaid')
    expect(loans.outstanding.amount).toBe(euros(-500))
    expect(loans.openCount).toBe(0)
  })

  it('lists a credit on a loan-out category with nothing lent, and lets it take no repayment', () => {
    const loans = book([
      { date: '2026-01-05', amount: 50, category: 'owner-loan-out' },
      { date: '2026-01-06', amount: -400, category: 'owner-loan-out' },
      { date: '2026-01-20', amount: 400, category: 'owner-loan-repaid' },
    ])

    expect(loans.loans.map((loan) => [loan.amount, loan.status, loan.repaidOn, loan.repayments.length])).toEqual([
      [euros(0), 'repaid', null, 0],
      [euros(400), 'repaid', civil('2026-01-20'), 1],
    ])
    expect(loans.lent.amount).toBe(euros(400))
  })

  it('orders loans booked on one day by the bank’s booking order', () => {
    const loans = book([
      { date: '2026-01-05', amount: -100, category: 'owner-loan-out' },
      { date: '2026-01-05', amount: -200, category: 'owner-loan-out' },
      { date: '2026-01-09', amount: 100, category: 'owner-loan-repaid' },
    ])

    expect(loans.loans.map((loan) => [loan.amount, loan.status])).toEqual([
      [euros(100), 'repaid'],
      [euros(200), 'open'],
    ])
  })

  it('finds loans by role, whatever the categories are called', () => {
    const categories: Category[] = [
      { slug: 'shareholder-loan', family: 'owner', bucket: 'owner-pay', colour: BUCKET_COLOUR, roles: ['owner-loan-out'], vat: 'none', ownerShare: null },
      { slug: 'shareholder-loan-back', family: 'owner', bucket: 'owner-pay', colour: BUCKET_COLOUR, roles: ['owner-loan-repaid'], vat: 'none', ownerShare: null },
      { slug: 'owner-loan-out', family: 'owner', bucket: 'owner-pay', colour: BUCKET_COLOUR, roles: [], vat: 'none', ownerShare: null },
    ]
    const loans = book(
      [
        { date: '2026-01-05', amount: -900, category: 'shareholder-loan' },
        { date: '2026-01-06', amount: -50, category: 'owner-loan-out' },
        { date: '2026-02-05', amount: 400, category: 'shareholder-loan-back' },
      ],
      categories,
    )

    expect([loans.lent.amount, loans.repaid.amount, loans.outstanding.amount]).toEqual([euros(900), euros(400), euros(500)])
    expect(loans.lent.drill.filters.categories).toEqual(['shareholder-loan'])
  })

  it('drills a loan and each of its repayments to the one row behind it', () => {
    const loans = book([
      { date: '2026-01-10', amount: -1000, category: 'owner-loan-out' },
      { date: '2026-03-10', amount: 1000, category: 'owner-loan-repaid' },
    ])

    expect(loans.loans[0]?.drill.filters).toEqual({
      period: { preset: 'custom', range: { from: '2026-01-10', to: '2026-01-10' } },
      categories: ['owner-loan-out'],
      amount: { min: euros(-1000), max: euros(-1000) },
    })
    expect(loans.loans[0]?.repayments[0]?.drill.filters.amount).toEqual({ min: euros(1000), max: euros(1000) })
  })

  it('gives each month what was lent and repaid, and the balance at its end since the ledger began', () => {
    const transactions = withPackBuckets(
      ledger([
        { date: '2026-01-10', amount: -1000, category: 'owner-loan-out' },
        { date: '2026-02-10', amount: 300, category: 'owner-loan-repaid' },
        { date: '2026-04-02', amount: 200, category: 'owner-loan-repaid' },
      ]),
    )
    const months = loanMonths(transactions, PACK_CATEGORIES, ['2026-02', '2026-03', '2026-04'] as MonthKey[], windowOf('2026-01-10', '2026-04-02'))

    expect(months.map((month) => [month.month, month.complete, month.lent.amount, month.repaid.amount, month.outstanding.amount])).toEqual([
      ['2026-02', true, euros(0), euros(300), euros(700)],
      ['2026-03', true, euros(0), euros(0), euros(700)],
      ['2026-04', false, euros(0), euros(200), euros(500)],
    ])
  })

  it('counts a payment from the owner on a reimbursement category as repaying the private costs it equals, so only the loans stay open', () => {
    const loans = book(
      [
        { date: '2026-03-26', amount: -1700, category: 'owner-loan-out' },
        { date: '2026-04-21', amount: -12.4, category: 'private-cost-for-owner' },
        { date: '2026-04-22', amount: -1700, category: 'owner-loan-out' },
        { date: '2026-04-23', amount: -30.1, category: 'private-cost-for-owner' },
        { date: '2026-04-24', amount: -18.25, category: 'private-cost-for-owner' },
        { date: '2026-05-12', amount: 42.5, category: 'reimbursement-from-owner' },
        { date: '2026-06-10', amount: 18.25, category: 'reimbursement-from-owner' },
      ],
      WITH_PRIVATE_COSTS,
    )

    expect(loans.loans.map((loan) => [loan.lentOn, loan.status, loan.repaidOn])).toEqual([
      [civil('2026-03-26'), 'open', null],
      [civil('2026-04-21'), 'repaid', civil('2026-05-12')],
      [civil('2026-04-22'), 'open', null],
      [civil('2026-04-23'), 'repaid', civil('2026-05-12')],
      [civil('2026-04-24'), 'repaid', civil('2026-06-10')],
    ])
    expect([loans.lent.amount, loans.repaid.amount, loans.outstanding.amount, loans.openCount]).toEqual([euros(3460.75), euros(60.75), euros(3400), 2])
  })

  it('still matches a repayment to the private costs it equals once many loans are open', () => {
    const openLoans = Array.from({ length: 17 }, (_, day): RowSpec => ({ date: `2025-01-${String(day + 1).padStart(2, '0')}`, amount: -2000, category: 'owner-loan-out' }))
    const loans = book(
      [
        ...openLoans,
        { date: '2026-04-21', amount: -12.4, category: 'private-cost-for-owner' },
        { date: '2026-04-23', amount: -30.1, category: 'private-cost-for-owner' },
        { date: '2026-05-12', amount: 42.5, category: 'reimbursement-from-owner' },
      ],
      WITH_PRIVATE_COSTS,
    )

    expect(loans.loans.filter((loan) => loan.status === 'repaid').map((loan) => [loan.lentOn, loan.repaidOn])).toEqual([
      [civil('2026-04-21'), civil('2026-05-12')],
      [civil('2026-04-23'), civil('2026-05-12')],
    ])
    expect(loans.openCount).toBe(17)
  })

  it('holds the owner’s part of a split company payment as lent, repaid by the owner less what the company sent back the same day', () => {
    // The owner paid the 8.40 part back twice and the company returned the extra.
    const rows = withSplit(
      withPackBuckets(
        ledger([
          { date: '2025-07-24', amount: -900, category: 'owner-loan-out' },
          { date: '2025-08-09', amount: -40, category: 'office-supplies', counterparty: 'Online shop' },
          { date: '2025-09-05', amount: 16.8, category: 'reimbursement-from-owner' },
          { date: '2025-09-05', amount: -8.4, category: 'reimbursement-to-owner' },
        ]),
        WITH_PRIVATE_COSTS,
      ),
      { date: '2025-08-09', amount: -40 },
      [
        [-31.6, 'office-supplies'],
        [-8.4, 'private-cost-for-owner', 'A book for the owner'],
      ],
      WITH_PRIVATE_COSTS,
    )
    const loans = ownerLoans(rows, WITH_PRIVATE_COSTS)

    expect(loans.loans.map((loan) => [loan.lentOn, loan.amount, loan.remaining, loan.repaidOn, loan.row.split?.note ?? null])).toEqual([
      [civil('2025-07-24'), euros(900), euros(900), null, null],
      [civil('2025-08-09'), euros(8.4), euros(0), civil('2025-09-05'), 'A book for the owner'],
    ])
    expect([loans.lent.amount, loans.repaid.amount, loans.outstanding.amount, loans.openCount]).toEqual([euros(908.4), euros(8.4), euros(900), 1])
  })

  it('lets a repayment close the fewest loans it equals exactly before the oldest open one', () => {
    const loans = book([
      { date: '2026-01-05', amount: -3000, category: 'owner-loan-out' },
      { date: '2026-02-01', amount: -100, category: 'owner-loan-out' },
      { date: '2026-02-02', amount: -60, category: 'owner-loan-out' },
      { date: '2026-02-03', amount: -40, category: 'owner-loan-out' },
      { date: '2026-03-01', amount: 140, category: 'owner-loan-repaid' },
    ])

    expect(loans.loans.map((loan) => [loan.amount, loan.remaining, loan.repaidOn])).toEqual([
      [euros(3000), euros(3000), null],
      [euros(100), euros(0), civil('2026-03-01')],
      [euros(60), euros(60), null],
      [euros(40), euros(0), civil('2026-03-01')],
    ])
  })

  it('leaves a loan a later repayment equals to that repayment, so an earlier one that fits no set does not take it', () => {
    const loans = book([
      { date: '2026-01-05', amount: -500, category: 'owner-loan-out' },
      { date: '2026-01-10', amount: -1500, category: 'owner-loan-out' },
      { date: '2026-03-01', amount: 1000, category: 'owner-loan-repaid' },
      { date: '2026-04-01', amount: 500, category: 'owner-loan-repaid' },
      { date: '2026-05-01', amount: 500, category: 'owner-loan-repaid' },
    ])

    expect(loans.loans.map((loan) => [loan.amount, loan.repaidOn, loan.repayments.map((share) => [share.repaidOn, share.applied])])).toEqual([
      [euros(500), civil('2026-04-01'), [[civil('2026-04-01'), euros(500)]]],
      [
        euros(1500),
        civil('2026-05-01'),
        [
          [civil('2026-03-01'), euros(1000)],
          [civil('2026-05-01'), euros(500)],
        ],
      ],
    ])
  })

  it('matches a repayment exactly only to loans lent by its day, and otherwise fills the oldest', () => {
    const loans = book([
      { date: '2026-01-05', amount: -500, category: 'owner-loan-out' },
      { date: '2026-01-10', amount: 300, category: 'owner-loan-repaid' },
      { date: '2026-01-20', amount: -300, category: 'owner-loan-out' },
    ])

    expect(loans.loans.map((loan) => loan.remaining)).toEqual([euros(200), euros(300)])
  })

  it('drills lent, repaid and the owner’s part of a split payment to the rows behind them', () => {
    const transactions = withSplit(
      withPackBuckets(
        ledger([
          { date: '2026-01-10', amount: -1000, category: 'owner-loan-out' },
          { date: '2026-02-02', amount: -50, category: 'office-supplies' },
          { date: '2026-02-20', amount: 400, category: 'owner-loan-repaid' },
          { date: '2026-02-21', amount: 15, category: 'reimbursement-from-owner' },
        ]),
        WITH_PRIVATE_COSTS,
      ),
      { date: '2026-02-02', amount: -50 },
      [
        [-35, 'office-supplies'],
        [-15, 'private-cost-for-owner'],
      ],
      WITH_PRIVATE_COSTS,
    )
    const loans = ownerLoans(transactions, WITH_PRIVATE_COSTS)
    const listed = (filters: Partial<FilterState>) => scopeTransactions(transactions, { ...DEFAULT_FILTERS, ...filters }).map((row) => `${row.category} ${row.amount}`)

    expect(listed(loans.lent.drill.filters)).toEqual([`private-cost-for-owner ${euros(-15)}`, `owner-loan-out ${euros(-1000)}`])
    expect(listed(loans.repaid.drill.filters)).toEqual([`reimbursement-from-owner ${euros(15)}`, `owner-loan-repaid ${euros(400)}`])
    expect(listed(loans.loans[1]!.drill.filters)).toEqual([`private-cost-for-owner ${euros(-15)}`])
  })
})
