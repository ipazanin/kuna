import { describe, expect, it } from 'vitest'

import type { ChartTokens } from '../src/shared/charts/chartTokens'
import { ownerTake } from '../src/packs/hr-doo/domain/ownerTake'
import { LOANS_NET_SERIES, ownerPaySeries, ownerTakeRing } from '../src/packs/hr-doo/presentation/packCharts'
import { PACK_CATEGORIES, withPackBuckets } from './fixtures/hrDooCategories'
import { euros, ledger, windowOf } from './fixtures/ledger'

const TOKENS = { series: ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'], deemphasis: 'grey' } as unknown as ChartTokens
const LOANS = ['owner-loan-out', 'owner-loan-repaid']
const name = (slug: string) => slug

const rows = withPackBuckets(
  ledger([
    { date: '2026-07-12', amount: -1100, category: 'salary-net' },
    { date: '2026-08-05', amount: -3000, category: 'owner-loan-out' },
    { date: '2026-09-02', amount: 2975, category: 'owner-loan-repaid' },
    { date: '2026-09-18', amount: -4000, category: 'dividend' },
    { date: '2026-09-20', amount: 300, category: 'rent-owner' },
  ]),
)
const period = { preset: 'l3' } as const
const take = ownerTake(rows, PACK_CATEGORIES, period, windowOf('2026-07-01', '2026-10-01'))

describe('ownerPaySeries', () => {
  it('puts the loans and their repayments in one series after the others, in the next slot', () => {
    const series = ownerPaySeries(['salary-net', 'dividend', 'owner-loan-out', 'owner-loan-repaid'], LOANS, TOKENS, name)

    expect(series.map((entry) => [entry.name, entry.categories, entry.token, entry.colour])).toEqual([
      ['salary-net', ['salary-net'], '--series-1', 's1'],
      ['dividend', ['dividend'], '--series-2', 's2'],
      [LOANS_NET_SERIES, LOANS, '--series-3', 's3'],
    ])
    expect(ownerPaySeries(['salary-net'], LOANS, TOKENS, name).map((entry) => entry.name)).toEqual(['salary-net'])
  })
})

describe('ownerTakeRing', () => {
  it('rings what was paid out, sets the loans and money handed back beside it, and adds up to the owner take', () => {
    const series = ownerPaySeries(['salary-net', 'dividend', 'rent-owner', ...LOANS], LOANS, TOKENS, name)
    const ring = ownerTakeRing(take, period, series, name)

    expect(ring.parts.map((part) => [part.key, part.value, part.colour])).toEqual([
      ['salary-net', euros(1100), '--series-1'],
      ['dividend', euros(4000), '--series-2'],
    ])
    // 3,000.00 lent less 2,975.00 repaid is 25.00, and 300.00 of rent came back.
    expect(ring.aside.map((line) => [line.label, line.amount])).toEqual([
      [LOANS_NET_SERIES, euros(25)],
      ['rent-owner', euros(-300)],
    ])
    expect(ring.ringTotal).toBe(euros(5100))
    // 5,100.00 in the ring, 25.00 of loans and 300.00 handed back make the 4,825.00 owner take.
    expect(ring.total).toBe(euros(4825))
    expect(ring.ringTotal + ring.aside.reduce((sum, line) => sum + line.amount, 0)).toBe(ring.total)
  })
})
