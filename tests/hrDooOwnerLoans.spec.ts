import { describe, expect, it } from 'vitest'

import { loanMonths, ownerLoans } from '../src/packs/hr-doo/domain/ownerLoans'
import type { MonthKey } from '../src/shared/calendar/monthKey'
import type { Category } from '../src/features/workbook/domain/workbook'
import { PACK_CATEGORIES, withPackBuckets } from './fixtures/hrDooCategories'
import { civil, euros, ledger, windowOf } from './fixtures/ledger'
import type { RowSpec } from './fixtures/ledger'

function book(rows: readonly RowSpec[], categories: readonly Category[] = PACK_CATEGORIES) {
  return ownerLoans(withPackBuckets(ledger(rows), categories), categories)
}

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
      { slug: 'shareholder-loan', family: 'owner', bucket: 'owner-pay', colour: '', roles: ['owner-loan-out'] },
      { slug: 'shareholder-loan-back', family: 'owner', bucket: 'owner-pay', colour: '', roles: ['owner-loan-repaid'] },
      { slug: 'owner-loan-out', family: 'owner', bucket: 'owner-pay', colour: '', roles: [] },
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
})
