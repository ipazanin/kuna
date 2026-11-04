import { describe, expect, it } from 'vitest'

import { customsEstimate } from '../src/apps/assets/carValue/domain/customsTable'
import { valueCaption } from '../src/apps/assets/values/presentation/valueCaption'
import { civil, euros } from './fixtures/ledger'

describe('how an asset value was reached, in words', () => {
  it('reads a car bought used by the table share at its age, from the price paid at the age it was bought', () => {
    // First registered 15 Jan 2024, bought 15 Jan 2026 at 24 months (63.58%) for 20,000.00, seen at 36 months (55.06%).
    const { cents, onDay, whenBought } = customsEstimate(euros(20_000), civil('2026-01-15'), civil('2024-01-15'), civil('2027-01-15'))

    expect(cents).toBe(euros(17_319.91))
    expect(valueCaption({ cents, basis: { kind: 'customs', onDay, whenBought } })).toBe(
      'Estimate by the customs table: 55.06% at 36 months from first registration, from the price paid at 24 months, when the share was 63.58%',
    )
  })

  it('reads a car bought new by the share of its price', () => {
    expect(valueCaption({ cents: euros(17_370), basis: { kind: 'customs', onDay: { months: 33, share: 5790 }, whenBought: null } })).toBe(
      'Estimate by the customs table: 57.90% of the price after 33 months from first registration',
    )
    expect(valueCaption({ cents: euros(28_800), basis: { kind: 'customs', onDay: { months: 1, share: 9300 }, whenBought: null } })).toBe(
      'Estimate by the customs table: 93.00% of the price after 1 month from first registration',
    )
  })

  it('says a price kept until the index reaches its quarter is the price paid, and a valuation the valuation', () => {
    expect(valueCaption({ cents: euros(300_000), basis: { kind: 'index-not-out', base: 'price', date: civil('2026-08-01'), quarter: '2026Q3' } })).toBe(
      'The DZS index has no 2026 Q3 yet, so this is the price paid on 1 Aug 2026.',
    )
    expect(valueCaption({ cents: euros(250_000), basis: { kind: 'index-not-out', base: 'valuation', date: civil('2026-10-01'), quarter: '2026Q4' } })).toBe(
      'The DZS index has no 2026 Q4 yet, so this is the valuation of 1 Oct 2026.',
    )
  })

  it('says plainly that the index cannot carry a price paid before it starts', () => {
    expect(valueCaption({ cents: euros(50_000), basis: { kind: 'index-not-reached', base: 'price', date: civil('1998-06-01'), first: '2002Q1' } })).toBe(
      'The DZS index starts in 2002 Q1, so it cannot carry the price paid on 1 Jun 1998. Add a valuation.',
    )
  })
})
