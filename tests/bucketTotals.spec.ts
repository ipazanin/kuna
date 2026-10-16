import { describe, expect, it } from 'vitest'

import { monthKey } from '../src/shared/calendar/monthKey'
import { averagePerMonth, bucketTotals, monthlyBucketTotals } from '../src/features/workbook/domain/bucketTotals'
import { euros, ledger } from './fixtures/ledger'

const rows = ledger([
  { date: '2026-07-04', amount: 7200, category: 'revenue' },
  { date: '2026-07-05', amount: -150, category: 'accounting' },
  { date: '2026-07-12', amount: -460, category: 'payroll-contributions' },
  { date: '2026-07-12', amount: -1100, category: 'salary-net' },
  { date: '2026-07-20', amount: 3000, category: 'owner-loan-repaid' },
  { date: '2026-07-21', amount: -212.5, category: 'reimbursement-to-owner' },
  { date: '2026-07-22', amount: -5000, category: 'internal-transfer' },
  { date: '2026-07-23', amount: -95.49, category: 'zzz-test' },
  { date: '2026-09-01', amount: -10, category: 'ai-services' },
])

describe('bucketTotals', () => {
  it('sums the four profit and loss buckets, costs read positive, everything else left out', () => {
    expect(bucketTotals(rows)).toEqual({
      income: euros(7200),
      operating: euros(160),
      taxes: euros(460),
      // A repayment is pay handed back, so it lowers owner pay.
      ownerPay: euros(-1900),
      cost: euros(-1280),
      net: euros(8480),
      ownerEarns: euros(6580),
    })
  })

  it('reads a month with no rows as zero', () => {
    const byMonth = monthlyBucketTotals(rows, [monthKey(2026, 7), monthKey(2026, 8), monthKey(2026, 9)])

    expect(byMonth.get(monthKey(2026, 8))?.net).toBe(0)
    expect(byMonth.get(monthKey(2026, 9))?.operating).toBe(euros(10))
  })

  it('averages each line separately, to the cent', () => {
    const average = averagePerMonth(bucketTotals(rows), 3)

    // 7200 / 3 = 2400, 8480 / 3 = 2826.666…
    expect(average.income).toBe(euros(2400))
    expect(average.net).toBe(euros(2826.67))
  })
})
