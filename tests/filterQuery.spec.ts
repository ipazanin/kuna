import { describe, expect, it } from 'vitest'

import { DEFAULT_FILTERS } from '../src/features/filters/domain/filterState'
import type { FilterState } from '../src/features/filters/domain/filterState'
import { decodeFilters, encodeFilters, hasFilterKeys, withoutFilterKeys } from '../src/features/filters/domain/filterQuery'
import { civil, euros } from './fixtures/ledger'

const EVERY_FIELD: FilterState = {
  period: { preset: 'custom', range: { from: civil('2025-07-01'), to: civil('2026-09-30') } },
  accounts: ['erste', 'otp'],
  buckets: ['operating', 'unclassified'],
  families: ['owner'],
  categories: ['travel', 'ai-services'],
  counterparties: ['iban:XX00FAKE0001', 'name:SATIS-MG, VL. EXAMPLE'],
  text: 'čaj & kava',
  amount: { min: euros(-1999.99), max: euros(-0.01) },
  needsReview: true,
}

describe('filter query', () => {
  it('round-trips every field', () => {
    expect(decodeFilters(encodeFilters(EVERY_FIELD))).toEqual(EVERY_FIELD)
  })

  it.each([
    { preset: 'l3' },
    { preset: 'l12' },
    { preset: 'all' },
    { preset: 'year', year: 2025 },
    { preset: 'quarter', year: 2026, quarter: 3 },
  ] as const)('round-trips the $preset period', (period) => {
    const filters = { ...DEFAULT_FILTERS, period }

    expect(decodeFilters(encodeFilters(filters))).toEqual(filters)
  })

  it('uses compact keys and leaves defaults out', () => {
    expect(encodeFilters(DEFAULT_FILTERS)).toEqual({})
    expect(encodeFilters({ ...DEFAULT_FILTERS, period: { preset: 'quarter', year: 2026, quarter: 3 }, accounts: ['erste'], buckets: ['operating'] })).toEqual({
      p: '2026q3',
      acc: 'erste',
      b: 'operating',
    })
    expect(encodeFilters(EVERY_FIELD)).toMatchObject({ p: '2025-07-01..2026-09-30', min: '-1999.99', max: '-0.01' })
  })

  it('writes the default period only when asked to', () => {
    expect(encodeFilters(DEFAULT_FILTERS, { explicitPeriod: true })).toEqual({ p: 'l12' })
  })

  it('repeats a key for a list, so a comma inside a value survives', () => {
    expect(encodeFilters(EVERY_FIELD).cp).toEqual(['iban:XX00FAKE0001', 'name:SATIS-MG, VL. EXAMPLE'])
  })

  it('falls back to the default for values that do not parse', () => {
    expect(decodeFilters({ p: '2026q5', b: ['operating', 'expenses', null], min: 'abc', acc: ['', 'erste', 'erste'] })).toEqual({
      ...DEFAULT_FILTERS,
      buckets: ['operating'],
      accounts: ['erste'],
    })
    expect(decodeFilters({ p: '2026-09-30..2026-07-01' }).period).toEqual(DEFAULT_FILTERS.period)
  })

  it('tells its own keys from the ones that belong to something else', () => {
    expect(hasFilterKeys({ theme: 'dark' })).toBe(false)
    expect(hasFilterKeys({ theme: 'dark', p: 'l3' })).toBe(true)
    expect(withoutFilterKeys({ theme: 'dark', p: 'l3', cp: ['a', 'b'] })).toEqual({ theme: 'dark' })
  })
})
