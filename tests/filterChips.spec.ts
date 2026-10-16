import { describe, expect, it } from 'vitest'

import { filterChips, withoutChip, withoutChips } from '../src/features/filters/domain/filterChips'
import { DEFAULT_FILTERS } from '../src/features/filters/domain/filterState'
import type { FilterState } from '../src/features/filters/domain/filterState'
import { euros } from './fixtures/ledger'

const narrowed: FilterState = {
  ...DEFAULT_FILTERS,
  period: { preset: 'l3' },
  accounts: ['main'],
  buckets: ['operating'],
  categories: ['travel', 'ai-services'],
  counterparties: ['iban:XX00FAKE0010'],
  text: 'kava',
  amount: { min: null, max: euros(-0.01) },
  needsReview: true,
}

const labels = {
  counterparty: (key: string): string => (key === 'iban:XX00FAKE0010' ? 'NORTHWIND ANALYTICS LTD' : key),
  bucket: (bucket: string): string => (bucket === 'operating' ? 'Operating cost' : bucket),
}

describe('filterChips', () => {
  it('names every narrowing beyond the period and the accounts', () => {
    expect(filterChips(narrowed, labels).map((chip) => chip.label)).toEqual([
      'Bucket: Operating cost',
      'Category: travel',
      'Category: ai-services',
      'Counterparty: NORTHWIND ANALYTICS LTD',
      'Text: “kava”',
      'Amount: at most −€0.01',
      'Needs review',
    ])
  })

  it('shows nothing for the default filters', () => {
    expect(filterChips(DEFAULT_FILTERS, labels)).toEqual([])
  })
})

describe('withoutChip', () => {
  it('takes off one value of a list and leaves the rest', () => {
    expect(withoutChip(narrowed, 'categories:travel').categories).toEqual(['ai-services'])
    expect(withoutChip(narrowed, 'counterparties:iban:XX00FAKE0010').counterparties).toEqual([])
  })

  it('clears the text, the amount range and the review flag', () => {
    expect(withoutChip(narrowed, 'text').text).toBe('')
    expect(withoutChip(narrowed, 'amount').amount).toEqual({ min: null, max: null })
    expect(withoutChip(narrowed, 'needsReview').needsReview).toBe(false)
  })

  it('keeps the filters when the chip is unknown', () => {
    expect(withoutChip(narrowed, 'period:l3')).toEqual(narrowed)
  })
})

describe('withoutChips', () => {
  it('clears every chip and keeps the period and accounts', () => {
    expect(withoutChips(narrowed)).toEqual({ ...DEFAULT_FILTERS, period: { preset: 'l3' }, accounts: ['main'] })
  })
})
