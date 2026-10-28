import { describe, expect, it } from 'vitest'

import type { ChartTokens } from '../src/shared/charts/chartTokens'
import { ownerTake } from '../src/apps/company/packs/hr-doo/domain/ownerTake'
import { LOANS_NET_SERIES, RENT_TAX_LABEL, ownerPaySeries, ownerTakeRing } from '../src/apps/company/packs/hr-doo/presentation/packCharts'
import { PACK_CATEGORIES, withPackBuckets } from './fixtures/hrDooCategories'
import { euros, ledger, windowOf } from './fixtures/ledger'

const TOKENS = { series: ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'], deemphasis: 'grey' } as unknown as ChartTokens
const LOANS = ['owner-loan-out', 'owner-loan-repaid']
const PAY = PACK_CATEGORIES.filter((category) => category.bucket === 'owner-pay')
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
  it('puts the loans and their repayments in one series in the slot after every other owner pay category', () => {
    const series = ownerPaySeries(PAY, ['salary-net', 'dividend', 'owner-loan-out', 'owner-loan-repaid'], LOANS, false, TOKENS, name)

    // rent-owner did not move, but keeps the third slot, so the loans take the fourth.
    expect(series.map((entry) => [entry.name, entry.categories, entry.token, entry.colour])).toEqual([
      ['salary-net', ['salary-net'], '--series-1', 's1'],
      ['dividend', ['dividend'], '--series-2', 's2'],
      [LOANS_NET_SERIES, LOANS, '--series-4', 's4'],
    ])
    expect(ownerPaySeries(PAY, ['salary-net'], LOANS, false, TOKENS, name).map((entry) => entry.name)).toEqual(['salary-net'])
  })

  it('adds the rent tax as a series of no category in the slot after the loans, kept when the loans did not move', () => {
    const series = ownerPaySeries(PAY, ['salary-net', 'rent-owner'], LOANS, true, TOKENS, name)
    const withoutLoans = ownerPaySeries(
      PAY.filter((category) => !LOANS.includes(category.slug)),
      ['salary-net', 'rent-owner'],
      [],
      true,
      TOKENS,
      name,
    )

    // salary-net, dividend and rent-owner hold the first three slots and the loans the fourth, so the rent tax takes the fifth.
    expect(series.map((entry) => [entry.name, entry.categories, entry.token])).toEqual([
      ['salary-net', ['salary-net'], '--series-1'],
      ['rent-owner', ['rent-owner'], '--series-3'],
      [RENT_TAX_LABEL, [], '--series-5'],
    ])
    expect(withoutLoans.at(-1)?.token).toBe('--series-4')
    expect(ownerPaySeries(PAY, ['salary-net', 'rent-owner'], LOANS, false, TOKENS, name).map((entry) => entry.name)).not.toContain(RENT_TAX_LABEL)
  })
})

describe('ownerTakeRing', () => {
  it('rings what was paid out, sets the loans and money handed back beside it, and adds up to the owner take', () => {
    const series = ownerPaySeries(PAY, ['salary-net', 'dividend', 'rent-owner', ...LOANS], LOANS, false, TOKENS, name)
    const ring = ownerTakeRing(take, period, series, name)

    expect(ring.parts.map((part) => [part.key, part.value, part.colour])).toEqual([
      ['salary-net', euros(1100), '--series-1'],
      ['dividend', euros(4000), '--series-2'],
    ])
    // 3,000.00 lent less 2,975.00 repaid is 25.00, and 300.00 of rent came back with its 25.20 rent tax.
    expect(ring.aside.map((line) => [line.label, line.amount])).toEqual([
      [LOANS_NET_SERIES, euros(25)],
      ['rent-owner', euros(-300)],
      [RENT_TAX_LABEL, euros(25.2)],
    ])
    expect(ring.ringTotal).toBe(euros(5100))
    // 5,100.00 in the ring, 25.00 of loans, 300.00 handed back and its 25.20 tax make the 4,850.20 owner take.
    expect(ring.total).toBe(euros(4850.2))
    expect(ring.ringTotal + ring.aside.reduce((sum, line) => sum + line.amount, 0)).toBe(ring.total)
  })

  it('rings the rent as paid and sets the rent tax the owner pays beside it', () => {
    const paid = withPackBuckets(ledger([{ date: '2026-09-12', amount: -1100, category: 'salary-net' }, { date: '2026-09-12', amount: -300, category: 'rent-owner' }]))
    const rentTake = ownerTake(paid, PACK_CATEGORIES, period, windowOf('2026-07-01', '2026-10-01'))
    const ring = ownerTakeRing(rentTake, period, ownerPaySeries(PAY, ['salary-net', 'rent-owner'], LOANS, true, TOKENS, name), name)

    expect(ring.parts.map((part) => [part.key, part.value])).toEqual([
      ['salary-net', euros(1100)],
      ['rent-owner', euros(300)],
    ])
    expect(ring.aside.map((line) => [line.label, line.amount, line.drill.filters.categories])).toEqual([[RENT_TAX_LABEL, euros(-25.2), ['rent-owner']]])
    // 1,400.00 paid out less the 25.20 rent tax is the 1,374.80 the owner keeps.
    expect(ring.total).toBe(euros(1374.8))
  })
})
