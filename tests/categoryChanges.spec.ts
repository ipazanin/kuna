import { describe, expect, it } from 'vitest'

import { categoryChanges } from '../src/apps/company/period-review/domain/categoryChanges'
import { civil, euros, ledger, windowOf } from './fixtures/ledger'

const rows = ledger([
  { date: '2026-04-04', amount: 5000, category: 'revenue' },
  { date: '2026-04-09', amount: -300, category: 'travel' },
  { date: '2026-05-10', amount: -100, category: 'accounting' },
  { date: '2026-07-04', amount: 4000, category: 'revenue' },
  { date: '2026-07-10', amount: -900, category: 'travel' },
  { date: '2026-08-10', amount: -200, category: 'equipment' },
  { date: '2026-10-02', amount: 1, category: 'revenue' },
])
const window = windowOf('2026-04-01', '2026-10-02')
const q3 = { from: civil('2026-07-01'), to: civil('2026-09-30') }
const q2 = { from: civil('2026-04-01'), to: civil('2026-06-30') }

describe('categoryChanges', () => {
  it('sets each category against the stretch before and lists the biggest movers first', () => {
    const sections = categoryChanges(rows, q3, { range: q2, partial: false }, window)
    const costs = sections.find((section) => section.key === 'cost')?.rows ?? []

    // travel 900 against 300, equipment new at 200, accounting gone from 100.
    expect(costs.map((row) => [row.category, row.current?.amount ?? null, row.prior?.amount ?? null, row.change])).toEqual([
      ['travel', euros(900), euros(300), euros(600)],
      ['equipment', euros(200), null, euros(200)],
      ['accounting', null, euros(100), euros(-100)],
    ])
    expect(sections.find((section) => section.key === 'income')?.rows[0]?.change).toBe(euros(-1000))
  })

  it('shows no change against a partial stretch, and no prior without one', () => {
    expect(categoryChanges(rows, q3, { range: q2, partial: true }, window)[0]?.rows[0]?.change).toBeNull()
    expect(categoryChanges(rows, q3, null, window)[0]?.rows[0]).toMatchObject({ prior: null, change: null })
  })
})
