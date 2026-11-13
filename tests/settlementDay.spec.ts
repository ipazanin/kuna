import { describe, expect, it } from 'vitest'

import { estimatedSettlementDay, settlementOf } from '../src/apps/investments/tax/domain/settlementDay'
import { EURO } from '../src/shared/money/currencyCode'
import { USD } from './fixtures/investments'
import { civil } from './fixtures/ledger'

describe('the settlement day of a trade', () => {
  it('settles a dollar trade of Friday 2 Oct 2026 on Monday 5 Oct', () => {
    expect(estimatedSettlementDay(civil('2026-10-02'), USD)).toBe('2026-10-05')
  })

  it('settles a Xetra trade of Thursday 1 Oct 2026 on Monday 5 Oct', () => {
    expect(estimatedSettlementDay(civil('2026-10-01'), EURO)).toBe('2026-10-05')
  })

  it('settles a dollar trade of Friday 24 May 2024 in two weekdays, before the US moved to one', () => {
    expect(estimatedSettlementDay(civil('2024-05-24'), USD)).toBe('2024-05-28')
  })

  it('settles a Xetra trade of Wednesday 30 Dec 2026 in January, past the New Year holiday of TARGET', () => {
    expect(estimatedSettlementDay(civil('2026-12-30'), EURO)).toBe('2027-01-04')
  })

  it('settles a Xetra trade of Thursday 2 Apr 2026 past Good Friday and Easter Monday', () => {
    expect(estimatedSettlementDay(civil('2026-04-02'), EURO)).toBe('2026-04-08')
  })

  it('settles a Xetra trade of Friday 8 Oct 2027 in two TARGET days, before the EU moves to one', () => {
    expect(estimatedSettlementDay(civil('2027-10-08'), EURO)).toBe('2027-10-12')
  })

  it('settles a Xetra trade of Monday 11 Oct 2027 in one TARGET day, from the day the EU moves to one', () => {
    expect(estimatedSettlementDay(civil('2027-10-11'), EURO)).toBe('2027-10-12')
  })

  it("takes the day a broker's report gives over the estimate, and says which it is", () => {
    expect(settlementOf({ date: civil('2026-10-02'), settles: civil('2026-10-06') }, USD)).toEqual({ day: '2026-10-06', estimated: false })
    expect(settlementOf({ date: civil('2026-10-02') }, USD)).toEqual({ day: '2026-10-05', estimated: true })
  })
})
