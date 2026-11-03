import { describe, expect, it } from 'vitest'

import { taxLink, yearNamed } from '../src/apps/investments/tax/presentation/taxLinks'
import { civil } from './fixtures/ledger'

describe('the Tax screen address', () => {
  it('opens on 2026 on 15 Feb 2027 and on 2027 on 2 Mar 2027 without a year asked', () => {
    expect(yearNamed([2026, 2025], undefined, civil('2027-02-15'))).toBe(2026)
    expect(yearNamed([2026, 2025], undefined, civil('2027-03-02'))).toBe(2027)
  })

  it('opens the year asked when it is offered, and otherwise the year due next', () => {
    expect(yearNamed([2026, 2025], '2025', civil('2027-02-15'))).toBe(2025)
    expect(yearNamed([2026, 2025], '2019', civil('2027-02-15'))).toBe(2026)
  })

  it('leaves the Year tab out of a link', () => {
    expect(taxLink(2026, 'year')).toEqual({ path: '/investments/tax', query: { year: '2026' } })
    expect(taxLink(2026, 'sales')).toEqual({ path: '/investments/tax', query: { year: '2026', tab: 'sales' } })
  })
})
