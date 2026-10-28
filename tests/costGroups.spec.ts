import { describe, expect, it } from 'vitest'

import { categoryTotals } from '../src/apps/company/spending/domain/categoryTotals'
import { costGroups } from '../src/apps/company/spending/domain/costGroups'
import { euros, ledger, windowOf } from './fixtures/ledger'

const rows = ledger([
  { date: '2026-04-09', amount: -300, category: 'travel' },
  { date: '2026-04-12', amount: -100, category: 'payroll-tax' },
  { date: '2026-04-20', amount: 0, category: 'accounting' },
  { date: '2026-07-10', amount: -510, category: 'travel' },
  { date: '2026-07-12', amount: -200, category: 'equipment' },
  { date: '2026-07-20', amount: 3000, category: 'owner-loan-repaid' },
  { date: '2026-08-12', amount: -100, category: 'payroll-tax' },
  { date: '2026-10-02', amount: 1, category: 'revenue' },
])
const window = windowOf('2026-04-01', '2026-10-02')
const q3 = categoryTotals(rows, { preset: 'quarter', year: 2026, quarter: 3 }, window)
const q2 = categoryTotals(rows, { preset: 'quarter', year: 2026, quarter: 2 }, window)

describe('costGroups', () => {
  const groups = costGroups(q3, q2)

  it('puts each cost under its bucket, money that came back in its own group, and leaves out what is zero in both periods', () => {
    expect(groups.map((group) => [group.key, group.rows.map((row) => row.category), group.total, group.priorTotal])).toEqual([
      ['operating', ['travel', 'equipment'], euros(710), euros(300)],
      ['taxes', ['payroll-tax'], euros(100), euros(100)],
      ['money-back', ['owner-loan-repaid'], euros(3000), euros(0)],
    ])
  })

  it('reads money back as a positive amount, so its bar grows from zero', () => {
    expect(groups.at(-1)?.rows[0]?.current?.amount).toBe(euros(3000))
  })

  it('states the change as a fraction of the period before, or as new', () => {
    // travel 510 against 300 is 70% more.
    expect(groups[0]?.rows.map((row) => row.change)).toEqual([0.7, 'new'])
    expect(groups[1]?.rows[0]?.change).toBe(0)
    expect(groups[0]?.change).toBeCloseTo(410 / 300)
  })

  it('has no change and no prior totals without a period before', () => {
    const alone = costGroups(q3, null)
    expect(alone[0]).toMatchObject({ priorTotal: null })
    expect(alone[0]?.rows[0]?.change).toBeNull()
  })
})
