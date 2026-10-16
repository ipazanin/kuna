import { describe, expect, it } from 'vitest'

import { applyDrill } from '../src/features/filters/domain/drillTarget'
import { DEFAULT_FILTERS } from '../src/features/filters/domain/filterState'
import { euros } from './fixtures/ledger'

describe('applyDrill', () => {
  it('narrows the current filters and takes the drill’s period', () => {
    const current = { ...DEFAULT_FILTERS, accounts: ['erste'], text: 'hosting' }

    expect(applyDrill(current, { period: { preset: 'l3' }, buckets: ['operating'] })).toEqual({
      ...current,
      period: { preset: 'l3' },
      buckets: ['operating'],
    })
  })

  it('intersects a list both sides narrow', () => {
    const current = { ...DEFAULT_FILTERS, buckets: ['operating', 'taxes'] as const }

    expect(applyDrill(current, { buckets: ['income', 'operating', 'taxes', 'owner-pay'] })?.buckets).toEqual(['operating', 'taxes'])
  })

  it('returns null when the drill and the filters cannot both hold, since no row is behind the figure', () => {
    expect(applyDrill({ ...DEFAULT_FILTERS, buckets: ['taxes'] }, { buckets: ['income'] })).toBeNull()
    expect(applyDrill({ ...DEFAULT_FILTERS, amount: { min: euros(10), max: null } }, { amount: { min: null, max: euros(-0.01) } })).toBeNull()
  })

  it('intersects amount ranges', () => {
    const current = { ...DEFAULT_FILTERS, amount: { min: euros(-500), max: null } }

    expect(applyDrill(current, { amount: { min: null, max: euros(-0.01) } })?.amount).toEqual({ min: euros(-500), max: euros(-0.01) })
  })

  it('keeps the review queue on once either side asks for it', () => {
    expect(applyDrill(DEFAULT_FILTERS, { needsReview: true })?.needsReview).toBe(true)
    expect(applyDrill({ ...DEFAULT_FILTERS, needsReview: true }, { buckets: ['income'] })?.needsReview).toBe(true)
  })
})
