import { describe, expect, it } from 'vitest'

import { ledgerWindowOf, newestBookingOf } from '../src/apps/company/workbook/domain/workbook'
import type { OwnerAdvance } from '../src/apps/company/workbook/domain/workbook'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { readDocument } from '../src/apps/company/workbook/infrastructure/companyDocument'
import { fakeWorkbookDocument } from '../src/apps/company/workbook/infrastructure/fake/fakeWorkbook'
import { presentedWorkbook } from '../src/apps/company/transactions/application/presentedWorkbook'
import { hrDooWorkbook } from '../src/apps/company/packs/hr-doo/domain/hrDooPart'
import { OWNER_ADVANCE_RECORDS } from '../src/apps/company/packs/hr-doo/domain/hrDooKinds'
import { owedInPeriod } from '../src/apps/company/packs/hr-doo/domain/owedInPeriod'
import type { PeriodBalance } from '../src/apps/company/packs/hr-doo/domain/owedInPeriod'
import { ownerLoans } from '../src/apps/company/packs/hr-doo/domain/ownerLoans'
import { PACK_CATEGORIES, withPackBuckets } from './fixtures/hrDooCategories'
import { civil, euros, ledger, windowOf } from './fixtures/ledger'

const SYNCED = '2026-10-16T08:00:00.000Z'
const books = hrDooWorkbook(presentedWorkbook(readDocument({ id: 'fake', source: 'drive', title: 'Fake workbook', syncedAt: SYNCED }, fakeWorkbookDocument(SYNCED, 'drive')).workbook))
const window = ledgerWindowOf(books.transactions)!
const newest = newestBookingOf(books.transactions)!

const figures = (balance: PeriodBalance) => [balance.start.amount, balance.added.amount, balance.settled.amount, balance.end.amount]

describe('who owes whom over a period, on the fake workbook', () => {
  it('reads 2025 from the books as they stood on 31 December', () => {
    const owed = owedInPeriod(books, { preset: 'year', year: 2025 }, window, newest)

    // Nothing was owed before the ledger began in May. 13.45 lent on 2 Oct and 3,000.00 on 3 Dec, none of it repaid by the year's end.
    expect(owed.on).toBe(civil('2025-12-31'))
    expect(figures(owed.loans)).toEqual([euros(0), euros(3013.45), euros(0), euros(3013.45)])
    expect(owed.net.amount).toBe(euros(3013.45))
    expect(owed.loanList.map((loan) => [loan.lentOn, loan.status])).toEqual([
      [civil('2025-10-02'), 'open'],
      [civil('2025-12-03'), 'open'],
    ])
    expect(figures(owed.advances)).toEqual([euros(0), euros(0), euros(0), euros(0)])
    expect(owed.advanceList).toEqual([])
  })

  it('reads a period that ends on 30 September 2026 on that day, before the reimbursements of 5 October', () => {
    const owed = owedInPeriod(books, { preset: 'custom', range: { from: civil('2025-10-01'), to: civil('2026-09-30') } }, window, newest)

    // The loan book holds 3,038.45 lent less 3,000.00 repaid. The owner paid 335.70 of costs and had 212.50 back by 30 September,
    // so the company owed 123.20: 38.45 − 123.20 = −84.75, which the tile shows as −€85.
    expect(owed.on).toBe(civil('2026-09-30'))
    expect(owed.net.amount).toBe(euros(-84.75))
    expect(figures(owed.loans)).toEqual([euros(0), euros(3038.45), euros(3000), euros(38.45)])
    expect(figures(owed.advances)).toEqual([euros(0), euros(335.7), euros(212.5), euros(123.2)])
    expect(owed.unaccountedTotal).toBe(euros(0))
  })

  it('reads the last 12 months on the newest booking, the reimbursements of 5 October included', () => {
    const owed = owedInPeriod(books, { preset: 'l12' }, window, newest)

    expect(owed.on).toBe(newest)
    expect(owed.net.amount).toBe(euros(76.95))
  })

  it('reads all time on the newest booking, as the page did before it had a period', () => {
    const owed = owedInPeriod(books, { preset: 'all' }, window, newest)

    expect(owed.on).toBe(newest)
    expect(owed.net.amount).toBe(euros(76.95))
    expect(owed.loans.start.drill).toBeNull()
  })
})

describe('owedInPeriod', () => {
  const rows = withPackBuckets(
    ledger([
      { date: '2025-03-10', amount: -1000, category: 'owner-loan-out' },
      { date: '2025-11-20', amount: -400, category: 'owner-loan-out' },
      { date: '2026-02-15', amount: 400, category: 'owner-loan-repaid' },
      { date: '2026-05-04', amount: 1000, category: 'owner-loan-repaid' },
    ]),
  )
  const workbook = { transactions: rows, ownerAdvances: [], categories: PACK_CATEGORIES }
  const span = windowOf('2025-03-10', '2026-05-04')
  const newestRow = civil('2026-05-04')

  it('lists a loan as open in a past period though the whole ledger shows it repaid', () => {
    const in2025 = owedInPeriod(workbook, { preset: 'year', year: 2025 }, span, newestRow)

    expect(ownerLoans(rows, PACK_CATEGORIES).loans.map((loan) => loan.status)).toEqual(['repaid', 'repaid'])
    expect(in2025.loanList.map((loan) => [loan.lentOn, loan.status, loan.remaining])).toEqual([
      [civil('2025-03-10'), 'open', euros(1000)],
      [civil('2025-11-20'), 'open', euros(400)],
    ])
  })

  it('carries what was owed into the next period and lists only the loans with a balance in it', () => {
    const owed = owedInPeriod(workbook, { preset: 'quarter', year: 2026, quarter: 2 }, span, newestRow)

    // 1,400.00 lent in 2025, 400.00 repaid in February, so 1,000.00 owed on 31 March. The May repayment closes it, and the quarter stops at the newest booking.
    expect(owed.on).toBe(civil('2026-05-04'))
    expect(figures(owed.loans)).toEqual([euros(1000), euros(0), euros(1000), euros(0)])
    expect(owed.loans.start.drill?.filters.period).toEqual({ preset: 'custom', range: { from: civil('2025-03-10'), to: civil('2026-03-31') } })
    expect(owed.loanList.map((loan) => [loan.lentOn, loan.repaidOn])).toEqual([[civil('2025-03-10'), civil('2026-05-04')]])
  })

  it('counts a cost the owner paid after the newest bank row, on its own day, under all time and the year that holds it', () => {
    const travel = PACK_CATEGORIES.find((category) => category.slug === 'travel')!
    const late: OwnerAdvance = {
      date: civil('2026-05-20'),
      amount: euros(200),
      description: 'Train tickets',
      category: 'travel',
      family: travel.family,
      bucket: travel.bucket,
      ownerShare: null,
      id: recordIdOf(OWNER_ADVANCE_RECORDS, 'row-2'),
    }
    const withLate = { ...workbook, ownerAdvances: [late] }

    for (const period of [{ preset: 'all' as const }, { preset: 'year' as const, year: 2026 }]) {
      const owed = owedInPeriod(withLate, period, span, newestRow)

      // Every loan is repaid by 4 May, so the 200.00 the company owes the owner is all that is left.
      expect(owed.on).toBe(civil('2026-05-20'))
      expect(owed.net.amount).toBe(euros(-200))
      expect(owed.advanceList.map((line) => line.advance.date)).toEqual([civil('2026-05-20')])
    }
  })
})
